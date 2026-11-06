import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { normalizeLabel } from "./hierarchyRules";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  clubRolePermissionsValidator,
  type ClubRolePermissions,
} from "../validators";

type ClubPermission = keyof ClubRolePermissions;
type ClubDbCtx = QueryCtx | MutationCtx;

const PERMISSION_KEYS = Object.keys(
  clubRolePermissionsValidator.fields,
) as ClubPermission[];

function allPermissions(enabled: boolean) {
  return Object.fromEntries(
    PERMISSION_KEYS.map((key) => [key, enabled]),
  ) as Record<ClubPermission, boolean>;
}

export const NO_CLUB_PERMISSIONS: ClubRolePermissions = allPermissions(false);

export const LEADER_CLUB_PERMISSIONS: ClubRolePermissions = allPermissions(true);

export const MAX_CLUB_ROLES = 100;
const MAX_CLUB_ROLE_NAME_LENGTH = 64;

export function permissionsForRole(role: Doc<"clubRoles"> | null | undefined) {
  return role?.permissions ?? NO_CLUB_PERMISSIONS;
}

export async function getDefaultClubRole(ctx: ClubDbCtx, clubId: Id<"clubs">) {
  return ctx.db
    .query("clubRoles")
    .withIndex("by_clubId_and_isDefault", (q) =>
      q.eq("clubId", clubId).eq("isDefault", true),
    )
    .first();
}

export async function createInitialClubRoles(
  ctx: MutationCtx,
  clubId: Id<"clubs">,
  actorId: Id<"users">,
) {
  const existing = await ctx.db
    .query("clubRoles")
    .withIndex("by_clubId_and_name", (q) => q.eq("clubId", clubId))
    .take(MAX_CLUB_ROLES);

  const now = Date.now();
  let member = existing.find((role) => role.isDefault) ?? existing.find(
    (role) => role.name.toLocaleLowerCase() === "member",
  );
  if (!member) {
    const memberId = await ctx.db.insert("clubRoles", {
      clubId,
      name: "Member",
      permissions: NO_CLUB_PERMISSIONS,
      isDefault: true,
      position: 0,
      createdById: actorId,
      createdAt: now,
      updatedAt: now,
    });
    member = await ctx.db.get(memberId) ?? undefined;
  }

  let leader = existing.find(
    (role) => role.name.toLocaleLowerCase() === "leader",
  );
  if (!leader) {
    const leaderId = await ctx.db.insert("clubRoles", {
      clubId,
      name: "Leader",
      permissions: LEADER_CLUB_PERMISSIONS,
      isDefault: false,
      position: 1,
      createdById: actorId,
      createdAt: now,
      updatedAt: now,
    });
    leader = await ctx.db.get(leaderId) ?? undefined;
  }

  let nextPosition = 2;
  for (const role of existing) {
    await ctx.db.patch(role._id, {
      permissions: role.permissions ?? (role._id === member?._id
        ? NO_CLUB_PERMISSIONS
        : LEADER_CLUB_PERMISSIONS),
      isDefault: role._id === member?._id,
      position: role._id === member?._id ? 0 : role._id === leader?._id ? 1 : role.position ?? nextPosition++,
      updatedAt: now,
    });
  }

  return [member, leader, ...existing.filter((role) => role._id !== member?._id && role._id !== leader?._id)].filter(
    (role): role is Doc<"clubRoles"> => role !== null && role !== undefined,
  );
}

export const clubRoleSummaryValidator = v.object({
  _id: v.id("clubRoles"),
  name: v.string(),
  permissions: clubRolePermissionsValidator,
  isDefault: v.boolean(),
  showInDirectory: v.boolean(),
  position: v.number(),
});

export function toClubRoleSummary(role: Doc<"clubRoles">) {
  return {
    _id: role._id,
    name: role.name,
    permissions: role.permissions ?? NO_CLUB_PERMISSIONS,
    isDefault: role.isDefault ?? false,
    showInDirectory: role.showInDirectory ?? false,
    position: role.position ?? 0,
  };
}

/** The club's roles, in display order, capped at `MAX_CLUB_ROLES`. */
export async function listClubRoles(ctx: ClubDbCtx, clubId: Id<"clubs">) {
  return await ctx.db
    .query("clubRoles")
    .withIndex("by_clubId_and_position", (q) => q.eq("clubId", clubId))
    .take(MAX_CLUB_ROLES);
}

export async function requireClubRole(
  ctx: ClubDbCtx,
  clubId: Id<"clubs">,
  roleId: Id<"clubRoles">,
) {
  const role = await ctx.db.get(roleId);
  if (!role || role.clubId !== clubId) {
    throw new ConvexError("Club role not found");
  }
  return role;
}

/**
 * Inserts a permissionless role after `existingRoles`. `createdSoFar` counts
 * roles a bulk caller has already added in this transaction on top of the
 * `existingRoles` snapshot it loaded.
 */
export async function createClubRole(
  ctx: MutationCtx,
  input: {
    clubId: Id<"clubs">;
    name: string;
    actorId: Id<"users">;
    existingRoles: Doc<"clubRoles">[];
    createdSoFar?: number;
    now: number;
  },
) {
  const createdSoFar = input.createdSoFar ?? 0;
  if (input.existingRoles.length + createdSoFar >= MAX_CLUB_ROLES) {
    throw new ConvexError(`A club can have up to ${MAX_CLUB_ROLES} roles`);
  }
  return await ctx.db.insert("clubRoles", {
    clubId: input.clubId,
    name: input.name,
    permissions: NO_CLUB_PERMISSIONS,
    isDefault: false,
    showInDirectory: false,
    position: input.existingRoles.reduce(
      (position, role) => Math.max(position, (role.position ?? -1) + 1),
      createdSoFar,
    ),
    createdById: input.actorId,
    createdAt: input.now,
    updatedAt: input.now,
  });
}

/** Role names typed in the settings UI; CSV imports only normalize (see `normalizeLabel`). */
export function normalizeClubRoleName(name: string) {
  const normalized = normalizeLabel(name);
  if (!normalized) throw new ConvexError("Role name is required");
  if (normalized.length > MAX_CLUB_ROLE_NAME_LENGTH) {
    throw new ConvexError(
      `Role names must be ${MAX_CLUB_ROLE_NAME_LENGTH} characters or fewer`,
    );
  }
  return normalized;
}
