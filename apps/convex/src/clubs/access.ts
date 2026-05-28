import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";


// Define our own app role union type for internal checks
type AppRoleType = "STUDENT" | "STUDENT_LEADER" | "STUDENT_ADMIN" | "TEACHER" | "SPONSOR" | "SUPPORT_STAFF" | "ADMIN" | "SUPER_ADMIN";

export interface ClubContext {
  club: Doc<"clubs">;
  membership: Doc<"clubMembers"> | null;
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

export function anonymousClubContext(club: Doc<"clubs">): ClubContext {
  return {
    club,
    membership: null,
    isMember: false,
    hasClubRole: false,
    isSponsor: false,
    isAdmin: false,
    canAccessWorkspace: false,
    canManageChannels: false,
    canManageMembership: false,
    canApproveJoinRequests: false,
    canSeePrivateChannels: false,
    hasPendingJoinRequest: false,
  };
}

export function isAdmin(roles: string[]) {
  return roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
}

export function isStaff(roles: string[]) {
  return (
    roles.includes("TEACHER") ||
    roles.includes("SPONSOR") ||
    roles.includes("SUPPORT_STAFF") ||
    roles.includes("ADMIN") ||
    roles.includes("SUPER_ADMIN")
  );
}

export async function getViewerContext(
  ctx: QueryCtx,
  clubId: Id<"clubs">,
  user: Doc<"users">
): Promise<ClubContext> {
  const club = await ctx.db.get(clubId);
  if (!club) throw new ConvexError("Club not found");

  const [membership, sponsor, pendingJoinRequest] = await Promise.all([
    ctx.db
      .query("clubMembers")
      .withIndex("by_clubId", (q) => q.eq("clubId", clubId))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first(),
    ctx.db
      .query("clubSponsors")
      .filter((q) => q.eq(q.field("clubId"), clubId))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first(),
    ctx.db
      .query("clubJoinRequests")
      .withIndex("by_clubId_and_status", (q) =>
        q.eq("clubId", clubId).eq("status", "PENDING")
      )
      .filter((q) => q.eq(q.field("requesterId"), user._id))
      .first(),
  ]);

  const userIsAdmin = isAdmin(user.roles as string[]);
  const isMember = !!membership;
  const hasClubRole = !!membership?.role;
  const isSponsor = !!sponsor;
  const canAccessWorkspace = isMember || isSponsor || userIsAdmin;
  const canManageChannels = isSponsor || hasClubRole || userIsAdmin;
  const canManageMembership = canManageChannels;
  const canApproveJoinRequests = isSponsor || userIsAdmin;
  const canSeePrivateChannels = isSponsor || userIsAdmin;

  return {
    club,
    membership,
    isMember,
    hasClubRole,
    isSponsor,
    isAdmin: userIsAdmin,
    canAccessWorkspace,
    canManageChannels,
    canManageMembership,
    canApproveJoinRequests,
    canSeePrivateChannels,
    hasPendingJoinRequest: !!pendingJoinRequest,
  };
}

export async function getClubContext(
  ctx: QueryCtx,
  clubId: Id<"clubs">,
  user: Doc<"users">
): Promise<ClubContext> {
  const context = await getViewerContext(ctx, clubId, user);
  if (!context.canAccessWorkspace) {
    throw new ConvexError("Not a club member");
  }
  return context;
}

export function canReadChannel(
  channel: Doc<"clubChannels"> & { memberships: Doc<"clubChannelMemberships">[] },
  context: ClubContext,
  userId: Id<"users">
) {
  if (channel.visibility === "PRIVATE") {
    return (
      context.canSeePrivateChannels ||
      channel.memberships.some((m) => m.userId === userId)
    );
  }
  return context.canAccessWorkspace;
}

export function canPostInChannel(
  channel: Doc<"clubChannels"> & { memberships: Doc<"clubChannelMemberships">[] },
  context: ClubContext,
  userId: Id<"users">
) {
  if (channel.visibility === "MEMBER_READONLY") {
    return context.hasClubRole || context.isSponsor || context.isAdmin;
  }
  return canReadChannel(channel, context, userId);
}
