import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { ClubRolePermissions } from "../validators";

export type ClubPermission = keyof ClubRolePermissions;
type ClubDbCtx = QueryCtx | MutationCtx;

export const NO_CLUB_PERMISSIONS: ClubRolePermissions = {
  createAnnouncementDrafts: false,
  createChannels: false,
  editChannels: false,
  deleteChannels: false,
  createPolls: false,
  pinMessages: false,
  moderateMessages: false,
  mentionEveryone: false,
  postToReadOnlyChannels: false,
  viewPrivateChannels: false,
  inviteMembers: false,
  manageJoinRequests: false,
  removeMembers: false,
  assignRoles: false,
  manageRoles: false,
  manageMemberTags: false,
  manageClubSettings: false,
  manageClubStructure: false,
  manageJoinCodes: false,
  createEvents: false,
  reviewVolunteerHours: false,
};

export const LEADER_CLUB_PERMISSIONS: ClubRolePermissions = {
  createAnnouncementDrafts: true,
  createChannels: true,
  editChannels: true,
  deleteChannels: true,
  createPolls: true,
  pinMessages: true,
  moderateMessages: true,
  mentionEveryone: true,
  postToReadOnlyChannels: true,
  viewPrivateChannels: true,
  inviteMembers: true,
  manageJoinRequests: true,
  removeMembers: true,
  assignRoles: true,
  manageRoles: true,
  manageMemberTags: true,
  manageClubSettings: true,
  manageClubStructure: true,
  manageJoinCodes: true,
  createEvents: true,
  reviewVolunteerHours: true,
};

export function permissionsForRole(role: Doc<"clubRoles"> | null | undefined) {
  return role?.permissions ?? NO_CLUB_PERMISSIONS;
}

export async function getMembershipRole(
  ctx: ClubDbCtx,
  membership: Doc<"clubMembers"> | null,
) {
  if (!membership) return null;
  const roleId = membership.roleId ?? membership.customRoleId;
  if (roleId) return ctx.db.get(roleId);
  return null;
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
    .take(100);

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
