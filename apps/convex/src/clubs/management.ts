import { ConvexError, v } from "convex/values";
import { internalMutation, mutation, query } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { getCurrentAppUser, getMaybeCurrentAppUser, requireAnyRole } from "../../lib/currentUser";
import { logAuditEvent } from "../audit/_lib";
import { getClubContext, getViewerContext } from "./access";
import { clubSummaryValidator, clubSummaryWithCounts, toViewerState } from "./serialize";
import type { AppRole } from "../../lib/roles";
import {
  clubRolePermissionValidator,
  clubRolePermissionsValidator,
} from "../validators";
import {
  NO_CLUB_PERMISSIONS,
  createInitialClubRoles,
  getDefaultClubRole,
} from "./rolePermissions";

const CLUB_CREATION_ROLES = ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF", "TEACHER"] as const satisfies readonly AppRole[];

export function canCreateClub(roles: readonly AppRole[]) {
  return roles.some((role) => (CLUB_CREATION_ROLES as readonly AppRole[]).includes(role));
}

export function canPermanentlyDeleteClub(roles: readonly AppRole[]) {
  return roles.includes("SUPER_ADMIN");
}

export const getAll = query({
  args: {},
  returns: v.array(clubSummaryValidator),
  handler: async (ctx) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];
    const clubs = await ctx.db
      .query("clubs")
      .withIndex("by_isActive_and_name", (q) => q.eq("isActive", true))
      .collect();
    return Promise.all(clubs.map((club) => clubSummaryWithCounts(ctx, club)));
  },
});

export const getOne = query({
  args: { clubId: v.id("clubs") },
  returns: v.union(v.object({
    ...clubSummaryValidator.fields,
    viewer: v.any(),
    members: v.array(v.object({ _id: v.id("clubMembers"), userId: v.id("users"), role: v.optional(v.string()), joinedAt: v.number() })),
  }), v.null()),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return null;
    const club = await ctx.db.get(args.clubId);
    if (!club) return null;
    const context = await getViewerContext(ctx, args.clubId, user);
    if (!context.canAccessWorkspace) return null;

    const members = await ctx.db
      .query("clubMembers")
      .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
      .collect();

    return {
      ...(await clubSummaryWithCounts(ctx, club)),
      viewer: toViewerState(context),
      members: members.map((member) => ({ _id: member._id, userId: member.userId, role: member.role, joinedAt: member.joinedAt })),
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    joinPolicy: v.union(v.literal("OPEN"), v.literal("REQUEST")),
    memberLimit: v.optional(v.number()),
    sponsorIds: v.optional(v.array(v.id("users"))),
  },
  returns: v.id("clubs"),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireAnyRole(user, [...CLUB_CREATION_ROLES]);

    const name = args.name.trim();
    if (!name) throw new ConvexError("Club name is required");

    const clubId = await ctx.db.insert("clubs", {
      name,
      description: args.description?.trim() || undefined,
      joinPolicy: args.joinPolicy,
      memberLimit: args.memberLimit,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await createInitialClubRoles(ctx, clubId, user._id);

    for (const sponsorId of args.sponsorIds ?? []) {
      const existing = await ctx.db
        .query("clubSponsors")
        .withIndex("by_clubId_and_userId", (q) =>
          q.eq("clubId", clubId).eq("userId", sponsorId),
        )
        .first();
      if (!existing) {
        await ctx.db.insert("clubSponsors", {
          clubId,
          userId: sponsorId,
          addedAt: Date.now(),
        });
      }
    }

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_CREATED",
      entityType: "Club",
      entityId: clubId,
    });

    return clubId;
  },
});

export const update = mutation({
  args: {
    clubId: v.id("clubs"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    overview: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    joinPolicy: v.optional(v.union(v.literal("OPEN"), v.literal("REQUEST"))),
    memberLimit: v.optional(v.union(v.number(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const { clubId, memberLimit, ...updates } = args;
    const context = await getClubContext(ctx, clubId, user);
    if (!context.permissions.manageClubSettings) {
      throw new ConvexError("Not authorized to update this club");
    }

    const cleanUpdates = {
      ...updates,
      ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
      ...(updates.description !== undefined
        ? { description: updates.description?.trim() || undefined }
        : {}),
      ...(updates.overview !== undefined
        ? { overview: updates.overview?.trim() || undefined }
        : {}),
      ...(updates.accentColor !== undefined
        ? { accentColor: updates.accentColor || undefined }
        : {}),
    };

    if (cleanUpdates.name !== undefined && !cleanUpdates.name) {
      throw new ConvexError("Club name is required");
    }
    if (cleanUpdates.accentColor !== undefined && cleanUpdates.accentColor && !/^#[0-9a-fA-F]{6}$/.test(cleanUpdates.accentColor)) {
      throw new ConvexError("Accent color must be a six-digit hex color");
    }

    if (
      memberLimit !== undefined &&
      memberLimit !== null &&
      (!Number.isInteger(memberLimit) || memberLimit < 1)
    ) {
      throw new ConvexError("Member limit must be a positive whole number.");
    }

    await ctx.db.patch(clubId, {
      ...cleanUpdates,
      ...(memberLimit !== undefined
        ? { memberLimit: memberLimit ?? undefined }
        : {}),
      updatedAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_UPDATED",
      entityType: "Club",
      entityId: clubId,
    });
    return null;
  },
});

export const deactivate = mutation({
  args: { clubId: v.id("clubs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireAnyRole(user, ["ADMIN", "SUPER_ADMIN"]);

    await ctx.db.patch(args.clubId, { isActive: false, updatedAt: Date.now() });

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_DEACTIVATED",
      entityType: "Club",
      entityId: args.clubId,
    });
    return null;
  },
});

export const deletePermanently = mutation({
  args: {
    clubId: v.id("clubs"),
    confirmationName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const user = await getCurrentAppUser(ctx);
    if (!canPermanentlyDeleteClub(user.roles)) {
      throw new ConvexError("Only superadmins can permanently delete clubs");
    }

    const club = await ctx.db.get(args.clubId);
    if (!club) throw new ConvexError("Club not found");
    if (args.confirmationName !== club.name) {
      throw new ConvexError("Enter the club name exactly to confirm deletion");
    }

    await ctx.db.patch(club._id, { isActive: false, updatedAt: Date.now() });
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_DELETION_STARTED",
      entityType: "Club",
      entityId: club._id,
      meta: { name: club.name },
    });
    await ctx.scheduler.runAfter(
      0,
      internal.clubs.clubDeletion.cleanupDeletedClub,
      { clubId: club._id, actorId: user._id, clubName: club.name },
    );
    return null;
  },
});

export const setMemberRole = mutation({
  args: {
    clubId: v.id("clubs"),
    memberId: v.id("users"),
    roleId: v.id("clubRoles"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);

    if (!context.permissions.assignRoles) {
      throw new ConvexError("You do not have permission to assign club roles");
    }

    const role = await ctx.db.get(args.roleId);
    if (!role || role.clubId !== args.clubId) {
      throw new ConvexError("Club role not found");
    }

    const member = await ctx.db
      .query("clubMembers")
      .withIndex("by_clubId_and_userId", (q) =>
        q.eq("clubId", args.clubId).eq("userId", args.memberId),
      )
      .first();

    if (member) {
      await ctx.db.patch(member._id, {
        roleId: args.roleId,
        role: undefined,
        customRoleId: undefined,
      });
    }

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_MEMBER_ROLE_SET",
      entityType: "Club",
      entityId: args.clubId,
      meta: { memberId: args.memberId, roleId: args.roleId },
    });
    return null;
  },
});

const bulkMemberRoleAssignmentValidator = v.object({
  memberId: v.id("users"),
  roleName: v.string(),
});

export const bulkSetMemberRoles = mutation({
  args: {
    clubId: v.id("clubs"),
    assignments: v.array(bulkMemberRoleAssignmentValidator),
  },
  returns: v.object({ assigned: v.number(), skipped: v.number(), createdRoles: v.number() }),
  handler: async (ctx, args) => {
    if (args.assignments.length === 0) throw new ConvexError("Add at least one role assignment");
    if (args.assignments.length > 100) throw new ConvexError("A role CSV can contain up to 100 rows");
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    if (!context.permissions.assignRoles) {
      throw new ConvexError("You do not have permission to assign club roles");
    }
    const memberships = await Promise.all(
      args.assignments.map((assignment) =>
        ctx.db.query("clubMembers").withIndex("by_clubId_and_userId", (q) =>
          q.eq("clubId", args.clubId).eq("userId", assignment.memberId),
        ).unique(),
      ),
    );
    const roles = await ctx.db.query("clubRoles")
      .withIndex("by_clubId_and_position", (q) => q.eq("clubId", args.clubId))
      .take(100);
    const roleByName = new Map(
      roles.map((role) => [role.name.trim().toLocaleLowerCase(), role._id]),
    );
    const now = Date.now();
    let createdRoles = 0;
    for (const assignment of args.assignments) {
      const name = normalizedRoleName(assignment.roleName);
      if (!name) throw new ConvexError("Every role assignment needs a role");
      if (roleByName.has(name.toLocaleLowerCase())) continue;
      if (!context.permissions.manageRoles) {
        throw new ConvexError(`Role does not exist: ${name}`);
      }
      await assertRoleNameAvailable(ctx, args.clubId, name);
      if (roles.length + createdRoles >= 100) throw new ConvexError("A club can have up to 100 roles");
      const roleId = await ctx.db.insert("clubRoles", {
        clubId: args.clubId,
        name,
        permissions: NO_CLUB_PERMISSIONS,
        isDefault: false,
        showInDirectory: false,
        position: roles.reduce((position, role) => Math.max(position, (role.position ?? -1) + 1), createdRoles),
        createdById: user._id,
        createdAt: now,
        updatedAt: now,
      });
      roleByName.set(name.toLocaleLowerCase(), roleId);
      createdRoles += 1;
    }
    let assigned = 0;
    let skipped = 0;
    for (let index = 0; index < args.assignments.length; index += 1) {
      const membership = memberships[index];
      if (!membership) {
        skipped += 1;
        continue;
      }
      const role = roleByName.get(normalizedRoleName(args.assignments[index].roleName).toLocaleLowerCase());
      if (!role) throw new ConvexError("Role could not be resolved");
      await ctx.db.patch(membership._id, {
        roleId: role,
        role: undefined,
        customRoleId: undefined,
      });
      assigned += 1;
    }
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_MEMBER_ROLES_BULK_SET",
      entityType: "Club",
      entityId: args.clubId,
      meta: { clubId: args.clubId, assigned, skipped, createdRoles },
    });
    return { assigned, skipped, createdRoles };
  },
});

const clubRoleValidator = v.object({
  _id: v.id("clubRoles"),
  name: v.string(),
  permissions: clubRolePermissionsValidator,
  isDefault: v.boolean(),
  showInDirectory: v.boolean(),
  position: v.number(),
});

const ROLE_CASCADE_BATCH_SIZE = 450;
const ROLE_CHANNEL_ACCESS_UPDATE_LIMIT = 450;

type ChannelRoleAccessContext = QueryCtx | MutationCtx;

async function channelsUsingRoleForAccess(
  ctx: ChannelRoleAccessContext,
  clubId: Id<"clubs">,
  roleId: Id<"clubRoles">,
) {
  const channels = await ctx.db
    .query("clubChannels")
    .withIndex("by_clubId_and_visibility", (q) => q.eq("clubId", clubId))
    .take(ROLE_CHANNEL_ACCESS_UPDATE_LIMIT);
  return channels.filter((channel) => channel.accessRoleIds?.includes(roleId));
}

export function roleRemovalChannelAccessUpdate(
  channel: Pick<
    Doc<"clubChannels">,
    "accessRoleIds" | "accessUnitId" | "postingPolicy" | "visibility"
  >,
  roleId: Id<"clubRoles">,
) {
  const accessRoleIds = (channel.accessRoleIds ?? []).filter(
    (accessRoleId) => accessRoleId !== roleId,
  );
  const broadensAccess = accessRoleIds.length === 0 && !channel.accessUnitId;

  return {
    accessRoleIds,
    broadensAccess,
    visibility: broadensAccess
      ? channel.postingPolicy === "CLUB_MANAGERS"
        ? "MEMBER_READONLY" as const
        : "PUBLIC" as const
      : channel.visibility,
  };
}

async function reassignRoleMembers(
  ctx: MutationCtx,
  clubId: Id<"clubs">,
  roleId: Id<"clubRoles">,
  defaultRoleId: Id<"clubRoles"> | null,
) {
  const [roleMembers, legacyRoleMembers] = await Promise.all([
    ctx.db
      .query("clubMembers")
      .withIndex("by_clubId_and_roleId", (q) =>
        q.eq("clubId", clubId).eq("roleId", roleId),
      )
      .take(ROLE_CASCADE_BATCH_SIZE),
    ctx.db
      .query("clubMembers")
      .withIndex("by_clubId_and_customRoleId", (q) =>
        q.eq("clubId", clubId).eq("customRoleId", roleId),
      )
      .take(ROLE_CASCADE_BATCH_SIZE),
  ]);

  const members = new Map(
    [...roleMembers, ...legacyRoleMembers].map((member) => [member._id, member]),
  );
  for (const member of members.values()) {
    await ctx.db.patch(member._id, {
      roleId: defaultRoleId ?? undefined,
      role: undefined,
      customRoleId: undefined,
    });
  }

  return {
    changed: members.size,
    hasMore:
      roleMembers.length === ROLE_CASCADE_BATCH_SIZE ||
      legacyRoleMembers.length === ROLE_CASCADE_BATCH_SIZE,
  };
}

function normalizedRoleName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

async function assertRoleNameAvailable(
  ctx: Parameters<typeof getClubContext>[0],
  clubId: Parameters<typeof getClubContext>[1],
  name: string,
  exceptRoleId?: string,
) {
  const existing = await ctx.db
    .query("clubRoles")
    .withIndex("by_clubId_and_name", (q) => q.eq("clubId", clubId))
    .take(100);
  if (existing.some((role) => role._id !== exceptRoleId && role.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    throw new ConvexError("A role with that name already exists");
  }
}

export const listRoles = query({
  args: { clubId: v.id("clubs") },
  returns: v.array(clubRoleValidator),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    if (!context.canAccessWorkspace) return [];
    const roles = await ctx.db
      .query("clubRoles")
      .withIndex("by_clubId_and_position", (q) => q.eq("clubId", args.clubId))
      .take(100);
    return roles
      .filter((role) => role.position !== undefined)
      .map((role) => ({
        _id: role._id,
        name: role.name,
        permissions: role.permissions ?? NO_CLUB_PERMISSIONS,
        isDefault: role.isDefault ?? false,
        showInDirectory: role.showInDirectory ?? false,
        position: role.position ?? 0,
      }));
  },
});

export const initializeRoles = mutation({
  args: { clubId: v.id("clubs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    if (!context.permissions.assignRoles && !context.permissions.manageRoles) {
      throw new ConvexError("You do not have permission to initialize club roles");
    }
    await createInitialClubRoles(ctx, args.clubId, user._id);
    return null;
  },
});

export const createRole = mutation({
  args: { clubId: v.id("clubs"), name: v.string() },
  returns: clubRoleValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    if (!context.permissions.manageRoles) {
      throw new ConvexError("You do not have permission to manage club roles");
    }
    const name = normalizedRoleName(args.name);
    if (!name) throw new ConvexError("Role name is required");
    if (name.length > 64) throw new ConvexError("Role names must be 64 characters or fewer");
    await assertRoleNameAvailable(ctx, args.clubId, name);
    const roles = await ctx.db
      .query("clubRoles")
      .withIndex("by_clubId_and_position", (q) => q.eq("clubId", args.clubId))
      .take(100);
    if (roles.length >= 100) throw new ConvexError("A club can have up to 100 roles");
    const now = Date.now();
    const roleId = await ctx.db.insert("clubRoles", {
      clubId: args.clubId,
      name,
      permissions: NO_CLUB_PERMISSIONS,
      isDefault: false,
      showInDirectory: false,
      position: roles.reduce((position, role) => Math.max(position, (role.position ?? -1) + 1), 0),
      createdById: user._id,
      createdAt: now,
      updatedAt: now,
    });
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_ROLE_CREATED",
      entityType: "Club",
      entityId: args.clubId,
      meta: { roleId, name },
    });
    const role = await ctx.db.get(roleId);
    if (!role) throw new ConvexError("Could not create role");
    return {
      _id: role._id,
      name: role.name,
      permissions: role.permissions ?? NO_CLUB_PERMISSIONS,
      isDefault: role.isDefault ?? false,
      showInDirectory: role.showInDirectory ?? false,
      position: role.position ?? 0,
    };
  },
});

export const renameRole = mutation({
  args: { clubId: v.id("clubs"), roleId: v.id("clubRoles"), name: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    if (!context.permissions.manageRoles) {
      throw new ConvexError("You do not have permission to manage club roles");
    }
    const role = await ctx.db.get(args.roleId);
    if (!role || role.clubId !== args.clubId) throw new ConvexError("Club role not found");
    const name = normalizedRoleName(args.name);
    if (!name) throw new ConvexError("Role name is required");
    if (name.length > 64) throw new ConvexError("Role names must be 64 characters or fewer");
    await assertRoleNameAvailable(ctx, args.clubId, name, args.roleId);
    await ctx.db.patch(role._id, { name, updatedAt: Date.now() });
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_ROLE_RENAMED",
      entityType: "Club",
      entityId: args.clubId,
      meta: { roleId: role._id, name },
    });
    return null;
  },
});

export const removeRole = mutation({
  args: {
    clubId: v.id("clubs"),
    roleId: v.id("clubRoles"),
    confirmChannelAccessUpdates: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    if (!context.permissions.manageRoles) {
      throw new ConvexError("You do not have permission to manage club roles");
    }

    const role = await ctx.db.get(args.roleId);
    if (!role || role.clubId !== args.clubId) {
      throw new ConvexError("Club role not found");
    }
    const affectedChannels = await channelsUsingRoleForAccess(
      ctx,
      args.clubId,
      role._id,
    );
    if (affectedChannels.length > 0 && !args.confirmChannelAccessUpdates) {
      throw new ConvexError(
        "Confirm the channel access updates before deleting this role",
      );
    }

    const broadenedChannelCount = affectedChannels.filter((channel) =>
      roleRemovalChannelAccessUpdate(channel, role._id).broadensAccess,
    ).length;
    for (const channel of affectedChannels) {
      const update = roleRemovalChannelAccessUpdate(channel, role._id);
      await ctx.db.patch(channel._id, {
        accessRoleIds: update.accessRoleIds,
        visibility: update.visibility,
        updatedAt: Date.now(),
      });
    }

    const defaultRole = role.isDefault
      ? null
      : await getDefaultClubRole(ctx, args.clubId);
    if (!role.isDefault && !defaultRole) {
      throw new ConvexError("This club does not have a fallback role");
    }

    const cascade = await reassignRoleMembers(
      ctx,
      args.clubId,
      args.roleId,
      defaultRole?._id ?? null,
    );
    await ctx.db.delete(role._id);

    if (cascade.hasMore) {
      await ctx.scheduler.runAfter(0, internal.clubs.management.finishRoleRemoval, {
        clubId: args.clubId,
        roleId: args.roleId,
        ...(defaultRole ? { defaultRoleId: defaultRole._id } : {}),
      });
    }

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_ROLE_REMOVED",
      entityType: "Club",
      entityId: args.clubId,
      meta: {
        roleId: role._id,
        reassignedImmediately: cascade.changed,
        reassignedToDefault: !!defaultRole,
        channelAccessRulesUpdated: affectedChannels.length,
        channelsBroadened: broadenedChannelCount,
      },
    });
    return null;
  },
});

export const getRoleRemovalImpact = query({
  args: { clubId: v.id("clubs"), roleId: v.id("clubRoles") },
  returns: v.object({
    channels: v.array(
      v.object({
        _id: v.id("clubChannels"),
        name: v.string(),
        broadensAccess: v.boolean(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    if (!context.permissions.manageRoles) {
      throw new ConvexError("You do not have permission to manage club roles");
    }
    const role = await ctx.db.get(args.roleId);
    if (!role || role.clubId !== args.clubId) {
      throw new ConvexError("Club role not found");
    }

    const channels = await channelsUsingRoleForAccess(ctx, args.clubId, role._id);
    return {
      channels: channels.map((channel) => ({
        _id: channel._id,
        name: channel.name,
        broadensAccess: roleRemovalChannelAccessUpdate(channel, role._id)
          .broadensAccess,
      })),
    };
  },
});

export const finishRoleRemoval = internalMutation({
  args: {
    clubId: v.id("clubs"),
    roleId: v.id("clubRoles"),
    defaultRoleId: v.optional(v.id("clubRoles")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const cascade = await reassignRoleMembers(
      ctx,
      args.clubId,
      args.roleId,
      args.defaultRoleId ?? null,
    );
    if (cascade.hasMore) {
      await ctx.scheduler.runAfter(0, internal.clubs.management.finishRoleRemoval, {
        clubId: args.clubId,
        roleId: args.roleId,
        ...(args.defaultRoleId ? { defaultRoleId: args.defaultRoleId } : {}),
      });
    }
    return null;
  },
});

export const setRolePermission = mutation({
  args: {
    clubId: v.id("clubs"),
    roleId: v.id("clubRoles"),
    permission: clubRolePermissionValidator,
    enabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    if (!context.permissions.manageRoles) {
      throw new ConvexError("You do not have permission to manage club roles");
    }
    const role = await ctx.db.get(args.roleId);
    if (!role || role.clubId !== args.clubId) throw new ConvexError("Club role not found");
    await ctx.db.patch(role._id, {
      permissions: {
        ...(role.permissions ?? NO_CLUB_PERMISSIONS),
        [args.permission]: args.enabled,
      },
      updatedAt: Date.now(),
    });
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_ROLE_PERMISSIONS_UPDATED",
      entityType: "Club",
      entityId: args.clubId,
      meta: { roleId: role._id },
    });
    return null;
  },
});

/**
 * Kept for clients from the previous web release. New code uses the field and
 * group mutations above so concurrent switch changes cannot send stale role
 * snapshots back to the server.
 */
export const updateRolePermissions = mutation({
  args: {
    clubId: v.id("clubs"),
    roleId: v.id("clubRoles"),
    permissions: clubRolePermissionsValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    if (!context.permissions.manageRoles) {
      throw new ConvexError("You do not have permission to manage club roles");
    }
    const role = await ctx.db.get(args.roleId);
    if (!role || role.clubId !== args.clubId) throw new ConvexError("Club role not found");
    await ctx.db.patch(role._id, { permissions: args.permissions, updatedAt: Date.now() });
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_ROLE_PERMISSIONS_UPDATED",
      entityType: "Club",
      entityId: args.clubId,
      meta: { roleId: role._id },
    });
    return null;
  },
});

export const setRolePermissionGroup = mutation({
  args: {
    clubId: v.id("clubs"),
    roleId: v.id("clubRoles"),
    permissions: v.array(clubRolePermissionValidator),
    enabled: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    if (!context.permissions.manageRoles) {
      throw new ConvexError("You do not have permission to manage club roles");
    }
    const role = await ctx.db.get(args.roleId);
    if (!role || role.clubId !== args.clubId) throw new ConvexError("Club role not found");
    await ctx.db.patch(role._id, {
      permissions: {
        ...(role.permissions ?? NO_CLUB_PERMISSIONS),
        ...Object.fromEntries(
          args.permissions.map((permission) => [permission, args.enabled]),
        ),
      },
      updatedAt: Date.now(),
    });
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_ROLE_PERMISSIONS_UPDATED",
      entityType: "Club",
      entityId: args.clubId,
      meta: { roleId: role._id, permissions: args.permissions },
    });
    return null;
  },
});

export const setRoleDirectoryVisibility = mutation({
  args: { clubId: v.id("clubs"), roleId: v.id("clubRoles"), showInDirectory: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    if (!context.permissions.manageRoles) {
      throw new ConvexError("You do not have permission to manage club roles");
    }
    const role = await ctx.db.get(args.roleId);
    if (!role || role.clubId !== args.clubId) throw new ConvexError("Club role not found");
    await ctx.db.patch(role._id, { showInDirectory: args.showInDirectory, updatedAt: Date.now() });
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_ROLE_DIRECTORY_VISIBILITY_UPDATED",
      entityType: "Club",
      entityId: args.clubId,
      meta: { roleId: role._id, showInDirectory: args.showInDirectory },
    });
    return null;
  },
});

export const removeMember = mutation({
  args: { clubId: v.id("clubs"), memberId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);

    if (!context.permissions.removeMembers) {
      throw new ConvexError("You do not have permission to remove club members");
    }

    const member = await ctx.db
      .query("clubMembers")
      .withIndex("by_clubId_and_userId", (q) =>
        q.eq("clubId", args.clubId).eq("userId", args.memberId),
      )
      .first();

    if (member) {
      await ctx.db.delete(member._id);
    }

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_MEMBER_REMOVED",
      entityType: "Club",
      entityId: args.clubId,
      meta: { memberId: args.memberId },
    });
    return null;
  },
});

export const getMyClubs = query({
  args: {},
  returns: v.object({ memberOf: v.array(clubSummaryValidator), sponsoring: v.array(clubSummaryValidator) }),
  handler: async (ctx) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return { memberOf: [], sponsoring: [] };
    const memberships = await ctx.db
      .query("clubMembers")
      .withIndex("by_userId_and_joinedAt", (q) => q.eq("userId", user._id))
      .collect();
    const memberOf = (
      await Promise.all(
        memberships.map(async (m) => {
          const club = await ctx.db.get(m.clubId);
          if (!club?.isActive) return null;
          return clubSummaryWithCounts(ctx, club, m.role ?? null);
        }),
      )
    ).filter((club): club is NonNullable<typeof club> => !!club);

    const sponsors = await ctx.db
      .query("clubSponsors")
      .withIndex("by_userId_and_clubId", (q) => q.eq("userId", user._id))
      .collect();
    const sponsoring = (
      await Promise.all(
        sponsors.map(async (s) => {
          const club = await ctx.db.get(s.clubId);
          if (!club?.isActive) return null;
          return clubSummaryWithCounts(ctx, club, "SPONSOR");
        }),
      )
    ).filter((club): club is NonNullable<typeof club> => !!club);

    return { memberOf, sponsoring };
  },
});

export const listMyInvites = query({
  args: {},
  returns: v.array(v.object({
    _id: v.id("clubInvites"),
    club: v.object({ _id: v.id("clubs"), name: v.string(), description: v.union(v.string(), v.null()) }),
    sender: v.object({ _id: v.id("users"), firstName: v.string(), lastName: v.string() }),
  })),
  handler: async (ctx) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];
    const invites = await ctx.db
      .query("clubInvites")
      .withIndex("by_recipientId_and_status_and_updatedAt", (q) =>
        q.eq("recipientId", user._id).eq("status", "PENDING"),
      )
      .order("desc")
      .collect();

    return Promise.all(
      invites.map(async (invite) => {
        const club = await ctx.db.get(invite.clubId);
        const sender = await ctx.db.get(invite.senderId);
        if (!club || !sender) return null;
        return {
          _id: invite._id,
          club: {
            _id: club._id,
            name: club.name,
            description: club.description ?? null,
          },
          sender: {
            _id: sender._id,
            firstName: sender.firstName,
            lastName: sender.lastName,
          },
        };
      }),
    ).then((rows) => rows.filter((r): r is NonNullable<typeof r> => !!r));
  },
});
