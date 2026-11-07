import { isAdmin } from "../../../shared/roles";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { ClubRolePermissions } from "../validators";
import {
  LEADER_CLUB_PERMISSIONS,
  NO_CLUB_PERMISSIONS,
  permissionsForRole,
} from "./rolePermissions";
import { getMembershipRole, grantsAnyPermission } from "./membership";

type ClubDbCtx = QueryCtx | MutationCtx;

export interface ClubContext {
  club: Doc<"clubs">;
  membership: Doc<"clubMembers"> | null;
  role: Doc<"clubRoles"> | null;
  permissions: ClubRolePermissions;
  isMember: boolean;
  hasClubRole: boolean;
  isSponsor: boolean;
  isAdmin: boolean;
  canAccessWorkspace: boolean;
  canManageChannels: boolean;
  canManageMembership: boolean;
  canApproveJoinRequests: boolean;
  canSeePrivateChannels: boolean;
  hasPendingJoinRequest: boolean;
}

async function loadMembershipAndSponsor(
  ctx: ClubDbCtx,
  clubId: Id<"clubs">,
  userId: Id<"users">,
) {
  return await Promise.all([
    ctx.db
      .query("clubMembers")
      .withIndex("by_clubId_and_userId", (q) =>
        q.eq("clubId", clubId).eq("userId", userId),
      )
      .first(),
    ctx.db
      .query("clubSponsors")
      .withIndex("by_clubId_and_userId", (q) =>
        q.eq("clubId", clubId).eq("userId", userId),
      )
      .first(),
  ]);
}

/** Loads the club and the viewer's standing in it, including a pending join request. */
export async function getViewerContext(
  ctx: ClubDbCtx,
  clubId: Id<"clubs">,
  user: Doc<"users">
): Promise<ClubContext> {
  const club = await ctx.db.get(clubId);
  if (!club) throw new ConvexError("Club not found");

  const [[membership, sponsor], pendingJoinRequest] = await Promise.all([
    loadMembershipAndSponsor(ctx, clubId, user._id),
    ctx.db
      .query("clubJoinRequests")
      .withIndex("by_clubId_and_requesterId_and_status", (q) =>
        q.eq("clubId", clubId).eq("requesterId", user._id).eq("status", "PENDING")
      )
      .first(),
  ]);

  const role = await getMembershipRole(ctx, membership);
  return buildClubContext({
    club,
    user,
    membership,
    role,
    sponsor,
    hasPendingJoinRequest: !!pendingJoinRequest,
  });
}

/** Same context for callers that already hold the club; skips the join-request read. */
export async function getChannelViewerContext(
  ctx: ClubDbCtx,
  club: Doc<"clubs">,
  user: Doc<"users">,
): Promise<ClubContext> {
  const [membership, sponsor] = await loadMembershipAndSponsor(
    ctx,
    club._id,
    user._id,
  );
  const role = await getMembershipRole(ctx, membership);
  return buildClubContext({
    club,
    user,
    membership,
    role,
    sponsor,
    hasPendingJoinRequest: false,
  });
}

function buildClubContext({
  club,
  user,
  membership,
  role,
  sponsor,
  hasPendingJoinRequest,
}: {
  club: Doc<"clubs">;
  user: Doc<"users">;
  membership: Doc<"clubMembers"> | null;
  role: Doc<"clubRoles"> | null;
  sponsor: Doc<"clubSponsors"> | null;
  hasPendingJoinRequest: boolean;
}): ClubContext {
  const userIsAdmin = isAdmin(user);
  const isMember = !!membership;
  const isSponsor = !!sponsor;
  // Legacy enum rows are supported only until the role backfill assigns a
  // concrete club role. New authorization is always permission-driven.
  const permissions = userIsAdmin || isSponsor
    ? LEADER_CLUB_PERMISSIONS
    : role
      ? permissionsForRole(role)
      : membership?.role === "LEADER" || membership?.role === "SPONSOR"
        ? LEADER_CLUB_PERMISSIONS
        : NO_CLUB_PERMISSIONS;
  const hasClubRole = grantsAnyPermission(permissions);
  const canAccessWorkspace = isMember || isSponsor || userIsAdmin;
  const canManageChannels = permissions.createChannels || permissions.editChannels || permissions.deleteChannels;
  const canManageMembership = permissions.inviteMembers || permissions.removeMembers || permissions.assignRoles;
  const canApproveJoinRequests = permissions.manageJoinRequests;
  const canSeePrivateChannels = permissions.viewPrivateChannels;

  return {
    club,
    membership,
    role,
    permissions,
    isMember,
    hasClubRole,
    isSponsor,
    isAdmin: userIsAdmin,
    canAccessWorkspace,
    canManageChannels,
    canManageMembership,
    canApproveJoinRequests,
    canSeePrivateChannels,
    hasPendingJoinRequest,
  };
}

export async function getClubContext(
  ctx: ClubDbCtx,
  clubId: Id<"clubs">,
  user: Doc<"users">
): Promise<ClubContext> {
  const context = await getViewerContext(ctx, clubId, user);
  if (!context.canAccessWorkspace) {
    throw new ConvexError("Not a club member");
  }
  return context;
}
