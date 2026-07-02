import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { ClubContext } from "./access";
import { canReadChannel } from "./access";

/** Public user slice for club UIs — uses Convex `_id`, not legacy REST `id`. */
export function toClubUserRef(user: Doc<"users">) {
  return {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    directoryOptOut: user.directoryOptOut ?? false,
    avatarUrl: user.avatarUrl ?? null,
  };
}

export function toViewerState(context: ClubContext) {
  return {
    isMember: context.isMember,
    hasClubRole: context.hasClubRole,
    isSponsor: context.isSponsor,
    isAdmin: context.isAdmin,
    canAccessWorkspace: context.canAccessWorkspace,
    canManageChannels: context.canManageChannels,
    canManageMembership: context.canManageMembership,
    canApproveJoinRequests: context.canApproveJoinRequests,
    hasPendingJoinRequest: context.hasPendingJoinRequest,
  };
}

export async function clubSummaryWithCounts(
  ctx: QueryCtx,
  club: Doc<"clubs">,
  role?: string | null,
) {
  const members = await ctx.db
    .query("clubMembers")
    .withIndex("by_clubId", (q) => q.eq("clubId", club._id))
    .collect();
  const channels = await ctx.db
    .query("clubChannels")
    .withIndex("by_clubId_and_visibility", (q) => q.eq("clubId", club._id))
    .collect();

  return {
    ...club,
    role: role ?? null,
    _count: {
      members: members.length,
      channels: channels.length,
    },
  };
}

export async function getVisibleChannels(
  ctx: QueryCtx,
  clubId: Id<"clubs">,
  context: ClubContext,
  userId: Id<"users">,
) {
  const channels = await ctx.db
    .query("clubChannels")
    .withIndex("by_clubId_and_visibility", (q) => q.eq("clubId", clubId))
    .collect();

  const result = [];
  for (const channel of channels) {
    const memberships = await ctx.db
      .query("clubChannelMemberships")
      .withIndex("by_channelId_and_userId", (q) => q.eq("channelId", channel._id))
      .collect();
    const channelDoc = { ...channel, memberships };
    if (!canReadChannel(channelDoc, context, userId)) continue;

    const messages = await ctx.db
      .query("clubChannelMessages")
      .withIndex("by_channelId_and_parentMessageId_and_createdAt", (q) =>
        q.eq("channelId", channel._id).eq("parentMessageId", undefined),
      )
      .take(500);

    result.push({
      ...channel,
      viewerCanRead: true,
      viewerCanPost: context.hasClubRole || context.isSponsor || context.isAdmin,
      memberships: memberships.map((m) => ({ userId: m.userId })),
      _count: { messages: messages.length },
    });
  }
  return result;
}
