import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser } from "../../lib/currentUser";
import { logAuditEvent } from "../audit/_lib";
import { clubUnitJoinPolicyValidator } from "../validators";
import { NO_CLUB_PERMISSIONS } from "./rolePermissions";
import { getClubContext, getViewerContext } from "./access";
import {
  MAX_CLUB_UNITS,
  MAX_CLUB_UNIT_DESCRIPTION_LENGTH,
  MAX_CLUB_UNIT_KIND_LENGTH,
  MAX_CLUB_UNIT_NAME_LENGTH,
  assertDistinctSiblingName,
  assertHierarchyDepth,
  normalizeOptionalLabel,
  normalizeRequiredLabel,
} from "./hierarchyRules";
import { toClubUserRef } from "./serialize";
import { adjustClubCounts, recountClub } from "./counts";

const unitSummaryValidator = v.object({
  _id: v.id("clubUnits"),
  parentUnitId: v.union(v.id("clubUnits"), v.null()),
  name: v.string(),
  kind: v.union(v.string(), v.null()),
  description: v.union(v.string(), v.null()),
  joinPolicy: clubUnitJoinPolicyValidator,
  joinCode: v.union(v.string(), v.null()),
  joinCodeUpdatedAt: v.union(v.number(), v.null()),
  position: v.number(),
  viewerIsMember: v.boolean(),
});

const unitMemberValidator = v.object({
  _id: v.id("clubUnitMembers"),
  userId: v.id("users"),
  joinedAt: v.number(),
  user: v.object({
    _id: v.id("users"),
    uniqueId: v.string(),
    firstName: v.string(),
    lastName: v.string(),
    roles: v.array(v.string()),
    avatarUrl: v.union(v.string(), v.null()),
  }),
});

const memberUnitOptionValidator = v.object({
  _id: v.id("clubUnits"),
  parentUnitId: v.union(v.id("clubUnits"), v.null()),
  name: v.string(),
  kind: v.union(v.string(), v.null()),
  disabled: v.boolean(),
  disabledReason: v.union(v.literal("ALREADY_ASSIGNED"), v.null()),
});

const memberUnitOptionsValidator = v.object({
  canManage: v.boolean(),
  directMemberships: v.array(v.object({
    unitId: v.id("clubUnits"),
  })),
  units: v.array(memberUnitOptionValidator),
});

const MAX_BULK_UNIT_ASSIGNMENTS = 100;
const MAX_DIRECT_UNIT_MEMBERSHIPS_PER_IMPORTED_MEMBER = 50;
const bulkUnitAssignmentValidator = v.object({
  memberId: v.id("users"),
  unitId: v.id("clubUnits"),
});
const bulkStructureUnitValidator = v.object({
  name: v.string(),
  parentName: v.union(v.string(), v.null()),
  kind: v.optional(v.string()),
});
const bulkRoleAssignmentValidator = v.object({
  memberId: v.id("users"),
  roleName: v.string(),
});

type ClubUnitCtx = QueryCtx | MutationCtx;

async function requireUnit(
  ctx: ClubUnitCtx,
  clubId: Id<"clubs">,
  unitId: Id<"clubUnits">,
) {
  const unit = await ctx.db.get(unitId);
  if (!unit || unit.clubId !== clubId || !unit.isActive) {
    throw new ConvexError("Club unit not found");
  }
  return unit;
}

async function requireHierarchyManager(
  ctx: ClubUnitCtx,
  clubId: Id<"clubs">,
  user: Doc<"users">,
) {
  const context = await getClubContext(ctx, clubId, user);
  if (!context.permissions.manageClubStructure) {
    throw new ConvexError("Not authorized to manage this club structure");
  }
  return context;
}

async function getParentDepth(
  ctx: ClubUnitCtx,
  clubId: Id<"clubs">,
  parentUnitId: Id<"clubUnits"> | undefined,
) {
  let depth = 1;
  let currentId = parentUnitId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) throw new ConvexError("Club hierarchy contains a cycle");
    visited.add(currentId);
    const current = await requireUnit(ctx, clubId, currentId);
    depth += 1;
    assertHierarchyDepth(depth);
    currentId = current.parentUnitId;
  }

  return depth;
}

async function getActiveSiblings(
  ctx: ClubUnitCtx,
  clubId: Id<"clubs">,
  parentUnitId: Id<"clubUnits"> | undefined,
) {
  return ctx.db
    .query("clubUnits")
    .withIndex("by_clubId_and_parentUnitId_and_position", (q) =>
      q.eq("clubId", clubId).eq("parentUnitId", parentUnitId),
    )
    .take(MAX_CLUB_UNITS);
}

function createJoinCode() {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

export const list = query({
  args: { clubId: v.id("clubs") },
  returns: v.object({
    canManage: v.boolean(),
    units: v.array(unitSummaryValidator),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    // A live query can outlast a membership change. Keep the authorization
    // boundary intact, but settle that stale subscription to an empty result
    // instead of surfacing a client error.
    const context = await getViewerContext(ctx, args.clubId, user);
    if (!context.canAccessWorkspace) return { canManage: false, units: [] };
    const [units, viewerMemberships] = await Promise.all([
      ctx.db
        .query("clubUnits")
        .withIndex("by_clubId_and_isActive_and_position", (q) =>
          q.eq("clubId", args.clubId).eq("isActive", true),
        )
        .take(MAX_CLUB_UNITS),
      ctx.db
        .query("clubUnitMembers")
        .withIndex("by_userId_and_clubId", (q) =>
          q.eq("userId", user._id).eq("clubId", args.clubId),
        )
        .take(MAX_CLUB_UNITS),
    ]);
    const viewerUnitIds = new Set(
      viewerMemberships.map((membership) => membership.unitId),
    );

    return {
      canManage: context.permissions.manageClubStructure,
      units: units.map((unit) => {
        return {
          _id: unit._id,
          parentUnitId: unit.parentUnitId ?? null,
          name: unit.name,
          kind: unit.kind ?? null,
          description: unit.description ?? null,
          joinPolicy: unit.joinPolicy,
          joinCode: context.permissions.manageClubStructure ? unit.joinCode ?? null : null,
          joinCodeUpdatedAt: context.permissions.manageClubStructure
            ? unit.joinCodeUpdatedAt ?? null
            : null,
          position: unit.position,
          viewerIsMember: viewerUnitIds.has(unit._id),
        };
      }),
    };
  },
});

export const create = mutation({
  args: {
    clubId: v.id("clubs"),
    parentUnitId: v.optional(v.id("clubUnits")),
    name: v.string(),
    kind: v.optional(v.string()),
    description: v.optional(v.string()),
    joinPolicy: clubUnitJoinPolicyValidator,
  },
  returns: v.id("clubUnits"),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await requireHierarchyManager(ctx, args.clubId, user);
    if (args.parentUnitId) await requireUnit(ctx, args.clubId, args.parentUnitId);
    await getParentDepth(ctx, args.clubId, args.parentUnitId);

    const allUnits = await ctx.db
      .query("clubUnits")
      .withIndex("by_clubId_and_isActive_and_position", (q) =>
        q.eq("clubId", args.clubId).eq("isActive", true),
      )
      .take(MAX_CLUB_UNITS + 1);
    if (allUnits.length >= MAX_CLUB_UNITS) {
      throw new ConvexError(`A club can have up to ${MAX_CLUB_UNITS} active units`);
    }

    const name = normalizeRequiredLabel(args.name, "Unit name", MAX_CLUB_UNIT_NAME_LENGTH);
    const siblings = await getActiveSiblings(ctx, args.clubId, args.parentUnitId);
    assertDistinctSiblingName(
      siblings.filter((sibling) => sibling.isActive).map((sibling) => sibling.name),
      name,
    );
    const position = siblings.reduce(
      (maximum, sibling) => Math.max(maximum, sibling.position + 1),
      0,
    );
    const now = Date.now();
    const unitId = await ctx.db.insert("clubUnits", {
      clubId: args.clubId,
      parentUnitId: args.parentUnitId,
      name,
      kind: normalizeOptionalLabel(args.kind, MAX_CLUB_UNIT_KIND_LENGTH),
      description: normalizeOptionalLabel(
        args.description,
        MAX_CLUB_UNIT_DESCRIPTION_LENGTH,
      ),
      joinPolicy: args.joinPolicy,
      position,
      isActive: true,
      createdById: user._id,
      createdAt: now,
      updatedAt: now,
    });
    const club = await ctx.db.get(args.clubId);
    if (club?.autoCreateUnitChannels) {
      await adjustClubCounts(ctx, args.clubId, { channels: 1 });
      await ctx.db.insert("clubChannels", {
        clubId: args.clubId,
        ownerUnitId: unitId,
        position: 0,
        accessPolicyVersion: 2,
        accessUnitId: unitId,
        postingPolicy: "AUDIENCE",
        name,
        description: undefined,
        visibility: "PRIVATE",
        createdById: user._id,
        createdAt: now,
        updatedAt: now,
      });
    }

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_UNIT_CREATED",
      entityType: "ClubUnit",
      entityId: unitId,
      meta: { clubId: args.clubId, parentUnitId: args.parentUnitId ?? null },
    });
    return unitId;
  },
});

/** Creates the missing nodes from a bounded parent/name structure CSV. */
export const bulkCreate = mutation({
  args: {
    clubId: v.id("clubs"),
    units: v.array(bulkStructureUnitValidator),
  },
  returns: v.object({ created: v.number(), existing: v.number() }),
  handler: async (ctx, args) => {
    if (args.units.length === 0) throw new ConvexError("Add at least one unit");
    if (args.units.length > MAX_CLUB_UNITS) {
      throw new ConvexError(`A structure CSV can contain up to ${MAX_CLUB_UNITS} rows`);
    }
    const user = await getCurrentAppUser(ctx);
    await requireHierarchyManager(ctx, args.clubId, user);
    const existingUnits = await ctx.db
      .query("clubUnits")
      .withIndex("by_clubId_and_isActive_and_position", (q) =>
        q.eq("clubId", args.clubId).eq("isActive", true),
      )
      .take(MAX_CLUB_UNITS + 1);
    if (existingUnits.length + args.units.length > MAX_CLUB_UNITS) {
      throw new ConvexError(`A club can have up to ${MAX_CLUB_UNITS} active units`);
    }

    const normalize = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
    const byName = new Map<string, Doc<"clubUnits">[]>();
    for (const unit of existingUnits) {
      const matches = byName.get(normalize(unit.name)) ?? [];
      matches.push(unit);
      byName.set(normalize(unit.name), matches);
    }
    const pending = args.units.map((unit) => ({
      name: unit.name.trim().replace(/\s+/g, " "),
      parentName: unit.parentName?.trim().replace(/\s+/g, " ") ?? "",
      kind: unit.kind?.trim().replace(/\s+/g, " ") || undefined,
    }));
    let created = 0;
    let existing = 0;
    let createdChannels = 0;
    while (pending.length) {
      let progressed = false;
      for (let index = pending.length - 1; index >= 0; index -= 1) {
        const row = pending[index];
        if (!row.name) throw new ConvexError("Every structure row needs a name");
        const parentMatches = row.parentName
          ? byName.get(normalize(row.parentName)) ?? []
          : [];
        if (row.parentName && parentMatches.length === 0) continue;
        if (parentMatches.length > 1) {
          throw new ConvexError(`Parent unit name is ambiguous: ${row.parentName}`);
        }
        const parentUnitId = parentMatches[0]?._id;
        const siblings = await getActiveSiblings(ctx, args.clubId, parentUnitId);
        const duplicate = siblings.some(
          (sibling) => normalize(sibling.name) === normalize(row.name),
        );
        pending.splice(index, 1);
        progressed = true;
        if (duplicate) {
          existing += 1;
          continue;
        }
        await getParentDepth(ctx, args.clubId, parentUnitId);
        const position = siblings.reduce(
          (maximum, sibling) => Math.max(maximum, sibling.position + 1),
          0,
        );
        const now = Date.now();
        const unitId = await ctx.db.insert("clubUnits", {
          clubId: args.clubId,
          parentUnitId,
          name: row.name,
          kind: row.kind,
          joinPolicy: "ASSIGN_ONLY",
          position,
          isActive: true,
          createdById: user._id,
          createdAt: now,
          updatedAt: now,
        });
        const club = await ctx.db.get(args.clubId);
        if (club?.autoCreateUnitChannels) {
          await ctx.db.insert("clubChannels", {
            clubId: args.clubId,
            ownerUnitId: unitId,
            position: 0,
            accessPolicyVersion: 2,
            accessUnitId: unitId,
            postingPolicy: "AUDIENCE",
            name: row.name,
            description: undefined,
            visibility: "PRIVATE",
            createdById: user._id,
            createdAt: now,
            updatedAt: now,
          });
          createdChannels += 1;
        }
        const matches = byName.get(normalize(row.name)) ?? [];
        matches.push({
          _id: unitId,
          _creationTime: now,
          clubId: args.clubId,
          parentUnitId,
          name: row.name,
          kind: row.kind,
          joinPolicy: "ASSIGN_ONLY",
          position,
          isActive: true,
          createdById: user._id,
          createdAt: now,
          updatedAt: now,
        });
        byName.set(normalize(row.name), matches);
        created += 1;
      }
      if (!progressed) {
        throw new ConvexError("Structure CSV has a missing or circular parent");
      }
    }
    // The import resolves parents as it goes, so how many channels it will
    // auto-create is only known once it finishes — too late for a delta, whose
    // one-time fallback count would then include the rows it is about to add.
    // Deriving both counters from the rows is exact whatever the order.
    if (createdChannels > 0) await recountClub(ctx, args.clubId);
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_UNITS_BULK_CREATED",
      entityType: "Club",
      entityId: args.clubId,
      meta: { clubId: args.clubId, created, existing },
    });
    return { created, existing };
  },
});

export const update = mutation({
  args: {
    clubId: v.id("clubs"),
    unitId: v.id("clubUnits"),
    name: v.optional(v.string()),
    kind: v.optional(v.string()),
    description: v.optional(v.string()),
    joinPolicy: v.optional(clubUnitJoinPolicyValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await requireHierarchyManager(ctx, args.clubId, user);
    const unit = await requireUnit(ctx, args.clubId, args.unitId);
    const name = args.name === undefined
      ? undefined
      : normalizeRequiredLabel(args.name, "Unit name", MAX_CLUB_UNIT_NAME_LENGTH);
    if (name && name.toLocaleLowerCase() !== unit.name.toLocaleLowerCase()) {
      const siblings = await getActiveSiblings(ctx, args.clubId, unit.parentUnitId);
      assertDistinctSiblingName(
        siblings
          .filter((sibling) => sibling.isActive && sibling._id !== unit._id)
          .map((sibling) => sibling.name),
        name,
      );
    }

    await ctx.db.patch(unit._id, {
      ...(name !== undefined ? { name } : {}),
      ...(args.kind !== undefined
        ? { kind: normalizeOptionalLabel(args.kind, MAX_CLUB_UNIT_KIND_LENGTH) }
        : {}),
      ...(args.description !== undefined
        ? {
            description: normalizeOptionalLabel(
              args.description,
              MAX_CLUB_UNIT_DESCRIPTION_LENGTH,
            ),
          }
        : {}),
      ...(args.joinPolicy !== undefined ? { joinPolicy: args.joinPolicy } : {}),
      updatedAt: Date.now(),
    });
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_UNIT_UPDATED",
      entityType: "ClubUnit",
      entityId: unit._id,
      meta: { clubId: args.clubId },
    });
    return null;
  },
});

export const archive = mutation({
  args: { clubId: v.id("clubs"), unitId: v.id("clubUnits") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await requireHierarchyManager(ctx, args.clubId, user);
    const unit = await requireUnit(ctx, args.clubId, args.unitId);
    const [child, member, channels] = await Promise.all([
      ctx.db
        .query("clubUnits")
        .withIndex("by_parentUnitId_and_isActive_and_position", (q) =>
          q.eq("parentUnitId", unit._id).eq("isActive", true),
        )
        .first(),
      ctx.db
        .query("clubUnitMembers")
        .withIndex("by_clubId_and_unitId", (q) =>
          q.eq("clubId", args.clubId).eq("unitId", unit._id),
        )
        .first(),
      ctx.db
        .query("clubChannels")
        .withIndex("by_clubId_and_visibility", (q) =>
          q.eq("clubId", args.clubId),
        )
        .take(500),
    ]);
    if (child) throw new ConvexError("Remove this unit's child units first");
    if (member) throw new ConvexError("Remove this unit's members first");
    if (
      channels.some(
        (channel) =>
          channel.ownerUnitId === unit._id ||
          channel.accessUnitId === unit._id ||
          channel.audienceUnitId === unit._id,
      )
    ) {
      throw new ConvexError(
        "Move or update this unit's channels before archiving it",
      );
    }

    await ctx.db.patch(unit._id, { isActive: false, updatedAt: Date.now() });
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_UNIT_ARCHIVED",
      entityType: "ClubUnit",
      entityId: unit._id,
      meta: { clubId: args.clubId },
    });
    return null;
  },
});

export const listMembers = query({
  args: { clubId: v.id("clubs"), unitId: v.id("clubUnits") },
  returns: v.array(unitMemberValidator),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await getClubContext(ctx, args.clubId, user);
    await requireUnit(ctx, args.clubId, args.unitId);
    const memberships = await ctx.db
      .query("clubUnitMembers")
      .withIndex("by_clubId_and_unitId", (q) =>
        q.eq("clubId", args.clubId).eq("unitId", args.unitId),
      )
      .take(500);

    const hydrated = await Promise.all(
      memberships.map(async (membership) => {
        const member = await ctx.db.get(membership.userId);
        return member
          ? {
              _id: membership._id,
              userId: membership.userId,
              joinedAt: membership.joinedAt,
              user: toClubUserRef(member),
            }
          : null;
      }),
    );
    return hydrated.filter((row): row is NonNullable<typeof row> => row !== null);
  },
});

/**
 * Bounded, manager-facing unit choices for assigning a person from People.
 * A direct membership is never duplicated.
 */
export const listMemberUnitOptions = query({
  args: { clubId: v.id("clubs"), memberId: v.id("users") },
  returns: memberUnitOptionsValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    const [units, directMemberships] = await Promise.all([
      ctx.db
        .query("clubUnits")
        .withIndex("by_clubId_and_isActive_and_position", (q) =>
          q.eq("clubId", args.clubId).eq("isActive", true),
        )
        .take(MAX_CLUB_UNITS),
      ctx.db
        .query("clubUnitMembers")
        .withIndex("by_userId_and_clubId", (q) =>
          q.eq("userId", args.memberId).eq("clubId", args.clubId),
        )
        .take(MAX_CLUB_UNITS),
    ]);
    const directUnitIds = new Set(
      directMemberships.map((membership) => membership.unitId),
    );

    return {
      canManage: context.permissions.manageClubStructure,
      directMemberships: directMemberships.map((membership) => ({
        unitId: membership.unitId,
      })),
      units: units.map((unit) => {
        const assigned = directUnitIds.has(unit._id);
        return {
          _id: unit._id,
          parentUnitId: unit.parentUnitId ?? null,
          name: unit.name,
          kind: unit.kind ?? null,
          disabled: assigned,
          disabledReason: assigned ? "ALREADY_ASSIGNED" as const : null,
        };
      }),
    };
  },
});

export const setMember = mutation({
  args: {
    clubId: v.id("clubs"),
    unitId: v.id("clubUnits"),
    memberId: v.id("users"),
  },
  returns: v.id("clubUnitMembers"),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await requireHierarchyManager(ctx, args.clubId, user);
    await requireUnit(ctx, args.clubId, args.unitId);
    const clubMembership = await ctx.db
      .query("clubMembers")
      .withIndex("by_clubId_and_userId", (q) =>
        q.eq("clubId", args.clubId).eq("userId", args.memberId),
      )
      .unique();
    if (!clubMembership) {
      throw new ConvexError("Only club members can be assigned within its structure");
    }

    const existing = await ctx.db
      .query("clubUnitMembers")
      .withIndex("by_unitId_and_userId", (q) =>
        q.eq("unitId", args.unitId).eq("userId", args.memberId),
      )
      .unique();
    const now = Date.now();
    const membershipId = existing?._id ?? await ctx.db.insert("clubUnitMembers", {
      clubId: args.clubId,
      unitId: args.unitId,
      userId: args.memberId,
      joinedAt: now,
      updatedAt: now,
    });
    if (existing) {
      await ctx.db.patch(existing._id, {
        role: undefined,
        title: undefined,
        updatedAt: now,
      });
    }
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_UNIT_MEMBER_SET",
      entityType: "ClubUnit",
      entityId: args.unitId,
      meta: { clubId: args.clubId, memberId: args.memberId },
    });
    return membershipId;
  },
});

/** Atomically replaces or adds direct unit memberships for a bounded CSV import. */
export const bulkSetMembers = mutation({
  args: {
    clubId: v.id("clubs"),
    assignments: v.array(bulkUnitAssignmentValidator),
    replaceExisting: v.boolean(),
  },
  returns: v.object({ assigned: v.number(), removed: v.number() }),
  handler: async (ctx, args) => {
    if (args.assignments.length === 0) {
      throw new ConvexError("Add at least one assignment");
    }
    if (args.assignments.length > MAX_BULK_UNIT_ASSIGNMENTS) {
      throw new ConvexError(
        `A CSV import can assign up to ${MAX_BULK_UNIT_ASSIGNMENTS} rows at a time`,
      );
    }

    const user = await getCurrentAppUser(ctx);
    await requireHierarchyManager(ctx, args.clubId, user);

    const uniqueAssignments = new Map<
      string,
      (typeof args.assignments)[number]
    >();
    for (const assignment of args.assignments) {
      uniqueAssignments.set(
        `${assignment.memberId}:${assignment.unitId}`,
        assignment,
      );
    }
    const assignments = [...uniqueAssignments.values()];
    const memberIds = [
      ...new Set(assignments.map((assignment) => assignment.memberId)),
    ];
    const unitIds = [
      ...new Set(assignments.map((assignment) => assignment.unitId)),
    ];

    const memberships = await Promise.all(
      memberIds.map((memberId) =>
        ctx.db
          .query("clubMembers")
          .withIndex("by_clubId_and_userId", (q) =>
            q.eq("clubId", args.clubId).eq("userId", memberId),
          )
          .unique(),
      ),
    );
    await Promise.all(
      unitIds.map((unitId) => requireUnit(ctx, args.clubId, unitId)),
    );
    if (memberships.some((membership) => membership === null)) {
      throw new ConvexError("Every imported person must be a club member");
    }
    let removed = 0;
    if (args.replaceExisting) {
      for (const memberId of memberIds) {
        const current = await ctx.db
          .query("clubUnitMembers")
          .withIndex("by_userId_and_clubId", (q) =>
            q.eq("userId", memberId).eq("clubId", args.clubId),
          )
          .take(MAX_DIRECT_UNIT_MEMBERSHIPS_PER_IMPORTED_MEMBER + 1);
        if (current.length > MAX_DIRECT_UNIT_MEMBERSHIPS_PER_IMPORTED_MEMBER) {
          throw new ConvexError(
            "An imported member has too many direct unit assignments to replace in one CSV import",
          );
        }
        for (const membership of current) {
          await ctx.db.delete(membership._id);
          removed += 1;
        }
      }
    }

    const now = Date.now();
    for (const assignment of assignments) {
      const existing = await ctx.db
        .query("clubUnitMembers")
        .withIndex("by_unitId_and_userId", (q) =>
          q.eq("unitId", assignment.unitId).eq("userId", assignment.memberId),
        )
        .unique();
      if (!existing) {
        await ctx.db.insert("clubUnitMembers", {
          clubId: args.clubId,
          unitId: assignment.unitId,
          userId: assignment.memberId,
          joinedAt: now,
          updatedAt: now,
        });
      }
    }

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_UNIT_MEMBERS_BULK_SET",
      entityType: "Club",
      entityId: args.clubId,
      meta: {
        clubId: args.clubId,
        assigned: assignments.length,
        removed,
        replaceExisting: args.replaceExisting,
      },
    });
    return { assigned: assignments.length, removed };
  },
});

/** Applies unit memberships and club roles in one bounded transaction. */
export const bulkImportMembers = mutation({
  args: {
    clubId: v.id("clubs"),
    unitAssignments: v.array(bulkUnitAssignmentValidator),
    roleAssignments: v.array(bulkRoleAssignmentValidator),
    replaceExisting: v.boolean(),
  },
  returns: v.object({
    assignedUnits: v.number(),
    assignedRoles: v.number(),
    skippedRoles: v.number(),
    removed: v.number(),
    createdRoles: v.number(),
  }),
  handler: async (ctx, args) => {
    if (!args.unitAssignments.length && !args.roleAssignments.length) {
      throw new ConvexError("Add at least one assignment");
    }
    if (args.unitAssignments.length + args.roleAssignments.length > MAX_BULK_UNIT_ASSIGNMENTS) {
      throw new ConvexError(
        `A CSV import can process up to ${MAX_BULK_UNIT_ASSIGNMENTS} assignments at a time`,
      );
    }
    const user = await getCurrentAppUser(ctx);
    const context = await requireHierarchyManager(ctx, args.clubId, user);
    if (args.roleAssignments.length && !context.permissions.assignRoles) {
      throw new ConvexError("You do not have permission to assign club roles");
    }

    const uniqueUnitAssignments = new Map<string, (typeof args.unitAssignments)[number]>();
    for (const assignment of args.unitAssignments) {
      uniqueUnitAssignments.set(`${assignment.memberId}:${assignment.unitId}`, assignment);
    }
    const unitAssignments = [...uniqueUnitAssignments.values()];
    const memberIds = [...new Set([
      ...unitAssignments.map((assignment) => assignment.memberId),
      ...args.roleAssignments.map((assignment) => assignment.memberId),
    ])];
    const unitIds = [...new Set(unitAssignments.map((assignment) => assignment.unitId))];
    const memberships = await Promise.all(
      memberIds.map((memberId) =>
        ctx.db.query("clubMembers").withIndex("by_clubId_and_userId", (q) =>
          q.eq("clubId", args.clubId).eq("userId", memberId),
        ).unique(),
      ),
    );
    await Promise.all(unitIds.map((unitId) => requireUnit(ctx, args.clubId, unitId)));
    const joinedMemberIds = new Set(
      memberships.filter((membership): membership is NonNullable<typeof membership> => membership !== null)
        .map((membership) => membership.userId),
    );

    const roles = await ctx.db.query("clubRoles")
      .withIndex("by_clubId_and_position", (q) => q.eq("clubId", args.clubId))
      .take(100);
    const roleByName = new Map(
      roles.map((role) => [role.name.trim().toLocaleLowerCase(), role._id]),
    );
    const now = Date.now();
    let createdRoles = 0;
    for (const assignment of args.roleAssignments) {
      const name = assignment.roleName.trim().replace(/\s+/g, " ");
      if (!name) throw new ConvexError("Every role assignment needs a role");
      const key = name.toLocaleLowerCase();
      if (roleByName.has(key)) continue;
      if (!context.permissions.manageRoles) {
        throw new ConvexError(`Role does not exist: ${name}`);
      }
      if (roles.length + createdRoles >= 100) {
        throw new ConvexError("A club can have up to 100 roles");
      }
      const roleId = await ctx.db.insert("clubRoles", {
        clubId: args.clubId,
        name,
        permissions: NO_CLUB_PERMISSIONS,
        isDefault: false,
        showInDirectory: false,
        position: roles.reduce(
          (position, role) => Math.max(position, (role.position ?? -1) + 1),
          createdRoles,
        ),
        createdById: user._id,
        createdAt: now,
        updatedAt: now,
      });
      roleByName.set(key, roleId);
      createdRoles += 1;
    }

    let removed = 0;
    if (args.replaceExisting && unitAssignments.length) {
      for (const memberId of joinedMemberIds) {
        const current = await ctx.db.query("clubUnitMembers")
          .withIndex("by_userId_and_clubId", (q) =>
            q.eq("userId", memberId).eq("clubId", args.clubId),
          )
          .take(MAX_DIRECT_UNIT_MEMBERSHIPS_PER_IMPORTED_MEMBER + 1);
        if (current.length > MAX_DIRECT_UNIT_MEMBERSHIPS_PER_IMPORTED_MEMBER) {
          throw new ConvexError("An imported member has too many direct unit assignments to replace");
        }
        for (const membership of current) {
          await ctx.db.delete(membership._id);
          removed += 1;
        }
      }
    }

    for (const assignment of unitAssignments) {
      const member = memberships.find((candidate) => candidate?.userId === assignment.memberId);
      if (!member) continue;
      const existing = await ctx.db.query("clubUnitMembers")
        .withIndex("by_unitId_and_userId", (q) =>
          q.eq("unitId", assignment.unitId).eq("userId", assignment.memberId),
        )
        .unique();
      if (!existing) {
        await ctx.db.insert("clubUnitMembers", {
          clubId: args.clubId,
          unitId: assignment.unitId,
          userId: assignment.memberId,
          joinedAt: now,
          updatedAt: now,
        });
      }
    }

    let assignedRoles = 0;
    let skippedRoles = 0;
    for (const assignment of args.roleAssignments) {
      const member = memberships.find((candidate) => candidate?.userId === assignment.memberId);
      if (!member) {
        skippedRoles += 1;
        continue;
      }
      const roleId = roleByName.get(assignment.roleName.trim().replace(/\s+/g, " ").toLocaleLowerCase());
      if (!roleId) throw new ConvexError("Role could not be resolved");
      await ctx.db.patch(member._id, {
        roleId,
        role: undefined,
        customRoleId: undefined,
      });
      assignedRoles += 1;
    }

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_BULK_STRUCTURE_ASSIGNMENTS_APPLIED",
      entityType: "Club",
      entityId: args.clubId,
      meta: {
        clubId: args.clubId,
        assignedUnits: unitAssignments.length,
        assignedRoles,
        skippedRoles,
        removed,
        createdRoles,
      },
    });
    return {
      assignedUnits: unitAssignments.length,
      assignedRoles,
      skippedRoles,
      removed,
      createdRoles,
    };
  },
});

export const removeMember = mutation({
  args: {
    clubId: v.id("clubs"),
    unitId: v.id("clubUnits"),
    memberId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await requireHierarchyManager(ctx, args.clubId, user);
    await requireUnit(ctx, args.clubId, args.unitId);
    const membership = await ctx.db
      .query("clubUnitMembers")
      .withIndex("by_unitId_and_userId", (q) =>
        q.eq("unitId", args.unitId).eq("userId", args.memberId),
      )
      .unique();
    if (membership) await ctx.db.delete(membership._id);
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_UNIT_MEMBER_REMOVED",
      entityType: "ClubUnit",
      entityId: args.unitId,
      meta: { clubId: args.clubId, memberId: args.memberId },
    });
    return null;
  },
});

export const generateJoinCode = mutation({
  args: { clubId: v.id("clubs"), unitId: v.id("clubUnits") },
  returns: v.string(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await requireHierarchyManager(ctx, args.clubId, user);
    const unit = await requireUnit(ctx, args.clubId, args.unitId);
    const code = createJoinCode();
    await ctx.db.patch(unit._id, {
      joinPolicy: "CODE",
      joinCode: code,
      joinCodeUpdatedAt: Date.now(),
      updatedAt: Date.now(),
    });
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_UNIT_JOIN_CODE_ROTATED",
      entityType: "ClubUnit",
      entityId: unit._id,
      meta: { clubId: args.clubId },
    });
    return code;
  },
});

export const join = mutation({
  args: {
    clubId: v.id("clubs"),
    unitId: v.id("clubUnits"),
    code: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    if (!context.isMember) {
      throw new ConvexError("Join the club before joining one of its groups");
    }
    const unit = await requireUnit(ctx, args.clubId, args.unitId);
    if (unit.joinPolicy === "ASSIGN_ONLY") {
      throw new ConvexError("This unit is assigned by a club manager");
    }
    if (
      unit.joinPolicy === "CODE" &&
      (!unit.joinCode || unit.joinCode !== args.code?.trim().toUpperCase())
    ) {
      throw new ConvexError("Invalid unit join code");
    }
    const existing = await ctx.db
      .query("clubUnitMembers")
      .withIndex("by_unitId_and_userId", (q) =>
        q.eq("unitId", unit._id).eq("userId", user._id),
      )
      .unique();
    if (!existing) {
      const now = Date.now();
      await ctx.db.insert("clubUnitMembers", {
        clubId: args.clubId,
        unitId: unit._id,
        userId: user._id,
        joinedAt: now,
        updatedAt: now,
      });
      await logAuditEvent(ctx, {
        actorId: user._id,
        action: "CLUB_UNIT_JOINED",
        entityType: "ClubUnit",
        entityId: unit._id,
        meta: { clubId: args.clubId },
      });
    }
    return null;
  },
});
