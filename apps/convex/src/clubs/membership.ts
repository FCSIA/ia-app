import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { ClubRolePermissions } from "../validators";
import { NO_CLUB_PERMISSIONS } from "./rolePermissions";

type ClubDbCtx = QueryCtx | MutationCtx;
type MemberRoleFields = {
  roleId?: Id<"clubRoles"> | null;
  customRoleId?: Id<"clubRoles"> | null;
};
type LegacyMemberRole = { role?: Doc<"clubMembers">["role"] | null };

/** Members hold a role in `roleId`; rows written before it existed use `customRoleId`. */
export function memberRoleId(member: MemberRoleFields) {
  return member.roleId ?? member.customRoleId ?? undefined;
}

export async function getMembershipRole(
  ctx: ClubDbCtx,
  membership: Doc<"clubMembers"> | null,
) {
  if (!membership) return null;
  const roleId = memberRoleId(membership);
  if (roleId) return ctx.db.get(roleId);
  return null;
}

/**
 * Members holding a role through either field, each capped at `limit`. The two
 * lists can overlap and are returned separately so callers can tell whether
 * either hit its cap.
 */
export async function queryRoleHolders(
  ctx: ClubDbCtx,
  clubId: Id<"clubs">,
  roleId: Id<"clubRoles">,
  limit: number,
) {
  const [current, legacy] = await Promise.all([
    ctx.db
      .query("clubMembers")
      .withIndex("by_clubId_and_roleId", (q) =>
        q.eq("clubId", clubId).eq("roleId", roleId),
      )
      .take(limit),
    ctx.db
      .query("clubMembers")
      .withIndex("by_clubId_and_customRoleId", (q) =>
        q.eq("clubId", clubId).eq("customRoleId", roleId),
      )
      .take(limit),
  ]);
  return { current, legacy };
}

export function grantsAnyPermission(
  permissions: ClubRolePermissions | undefined,
) {
  return Object.values(permissions ?? NO_CLUB_PERMISSIONS).some(Boolean);
}

/*
 * "Leader" means three different things to three features. They are kept as
 * separate predicates because merging them would change who is included.
 */

/** `@leaders` mentions: holders of any role with a permission, else legacy LEADER rows. */
export function isLeadersMentionTarget(
  member: MemberRoleFields & LegacyMemberRole,
  elevatedRoleIds: ReadonlySet<Id<"clubRoles">>,
) {
  const roleId = memberRoleId(member);
  return roleId ? elevatedRoleIds.has(roleId) : member.role === "LEADER";
}

/** The club directory's leader list, given the member's resolved role (legacy rows included). */
export function isDirectoryLeader(
  member: LegacyMemberRole,
  role: Doc<"clubRoles"> | null,
) {
  return role ? grantsAnyPermission(role.permissions) : member.role === "LEADER";
}

/** Members who can see and manage every channel, for channel audiences. */
export function hasElevatedChannelAccess(
  member: LegacyMemberRole,
  role: Doc<"clubRoles"> | undefined,
) {
  const permissions = role?.permissions ?? NO_CLUB_PERMISSIONS;
  return (
    member.role === "LEADER" ||
    member.role === "SPONSOR" ||
    permissions.viewPrivateChannels ||
    permissions.createChannels ||
    permissions.editChannels ||
    permissions.deleteChannels
  );
}
