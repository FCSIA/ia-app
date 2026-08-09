import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { ClubContext } from "./access";
import { canPostInChannel, canReadChannel } from "./access";

/** Public user slice for club UIs — uses Convex `_id`, not legacy REST `id`. */
export function toClubUserRef(user: Doc<"users">) {
  return {
    _id: user._id,
    uniqueId: user.uniqueId,
    firstName: user.firstName,
    lastName: user.lastName,
    roles: user.roles,
    avatarUrl: user.avatarUrl ?? null,
  };
}

export const clubSummaryValidator = v.object({
  _id: v.id("clubs"),
  _creationTime: v.number(),
  name: v.string(),
  description: v.optional(v.string()),
  logoUrl: v.optional(v.string()),
  bannerUrl: v.optional(v.string()),
  accentColor: v.optional(v.string()),
  overview: v.optional(v.string()),
  joinPolicy: v.union(v.literal("OPEN"), v.literal("REQUEST")),
  memberLimit: v.optional(v.number()),
  isActive: v.boolean(),
  createdAt: v.number(),
  updatedAt: v.number(),
  role: v.union(v.string(), v.null()),
  _count: v.object({
    members: v.number(),
    channels: v.number(),
  }),
});

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

export function toChannelViewerState(
  channel: Doc<"clubChannels"> & {
    memberships: Doc<"clubChannelMemberships">[];
  },
  context: ClubContext,
  userId: Id<"users">,
) {
  return {
    viewerCanRead: canReadChannel(channel, context, userId),
    viewerCanPost: canPostInChannel(channel, context, userId),
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
    _id: club._id,
    _creationTime: club._creationTime,
    name: club.name,
    description: club.description,
    logoUrl: club.logoUrl,
    bannerUrl: club.bannerUrl,
    accentColor: club.accentColor,
    overview: club.overview,
    joinPolicy: club.joinPolicy,
    memberLimit: club.memberLimit,
    isActive: club.isActive,
    createdAt: club.createdAt,
    updatedAt: club.updatedAt,
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
      .withIndex("by_channelId", (q) => q.eq("channelId", channel._id))
      .collect();
    const channelDoc = { ...channel, memberships };
    const viewer = toChannelViewerState(channelDoc, context, userId);
    if (!viewer.viewerCanRead) continue;

    const messages = await ctx.db
      .query("clubChannelMessages")
      .withIndex("by_channelId_and_parentMessageId_and_createdAt", (q) =>
        q.eq("channelId", channel._id).eq("parentMessageId", undefined),
      )
      .take(500);

    result.push({
      ...channel,
      ...viewer,
      memberships: memberships.map((m) => ({ userId: m.userId })),
      _count: { messages: messages.length },
    });
  }
  return result;
}
