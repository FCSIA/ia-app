import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser } from "../../lib/currentUser";
import { logAuditEvent } from "../audit/_lib";
import {
  clubUnitJoinPolicyValidator,
  clubUnitMemberRoleValidator,
} from "../validators";
import { getClubContext } from "./access";
import {
  MAX_CLUB_UNITS,
  MAX_CLUB_UNIT_DESCRIPTION_LENGTH,
  MAX_CLUB_UNIT_KIND_LENGTH,
  MAX_CLUB_UNIT_NAME_LENGTH,
  MAX_CLUB_UNIT_TITLE_LENGTH,
  assertDistinctSiblingName,
  assertHierarchyDepth,
  normalizeOptionalLabel,
  normalizeRequiredLabel,
} from "./hierarchyRules";
import { toClubUserRef } from "./serialize";

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
  viewerRole: v.union(clubUnitMemberRoleValidator, v.null()),
  viewerTitle: v.union(v.string(), v.null()),
});

const unitMemberValidator = v.object({
  _id: v.id("clubUnitMembers"),
  userId: v.id("users"),
  role: clubUnitMemberRoleValidator,
  title: v.union(v.string(), v.null()),
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
    const context = await getClubContext(ctx, args.clubId, user);
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
    const viewerMembershipByUnit = new Map(
      viewerMemberships.map((membership) => [membership.unitId, membership]),
    );

    return {
      canManage: context.permissions.manageClubStructure,
      units: units.map((unit) => {
        const viewerMembership = viewerMembershipByUnit.get(unit._id);
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
          viewerRole: viewerMembership?.role ?? null,
          viewerTitle: viewerMembership?.title ?? null,
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
    const [child, member] = await Promise.all([
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
    ]);
    if (child) throw new ConvexError("Remove this unit's child units first");
    if (member) throw new ConvexError("Remove this unit's members first");

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
              role: membership.role,
              title: membership.title ?? null,
              joinedAt: membership.joinedAt,
              user: toClubUserRef(member),
            }
          : null;
      }),
    );
    return hydrated.filter((row): row is NonNullable<typeof row> => row !== null);
  },
});

export const setMember = mutation({
  args: {
    clubId: v.id("clubs"),
    unitId: v.id("clubUnits"),
    memberId: v.id("users"),
    role: clubUnitMemberRoleValidator,
    title: v.optional(v.string()),
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

    const title = args.role === "LEADER"
      ? normalizeOptionalLabel(args.title, MAX_CLUB_UNIT_TITLE_LENGTH)
      : undefined;
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
      role: args.role,
      title,
      joinedAt: now,
      updatedAt: now,
    });
    if (existing) {
      await ctx.db.patch(existing._id, { role: args.role, title, updatedAt: now });
    }
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_UNIT_MEMBER_SET",
      entityType: "ClubUnit",
      entityId: args.unitId,
      meta: { clubId: args.clubId, memberId: args.memberId, role: args.role, title },
    });
    return membershipId;
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
        role: "MEMBER",
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
