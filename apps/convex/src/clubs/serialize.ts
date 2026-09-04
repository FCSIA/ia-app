import type { Doc, Id } from "../_generated/dataModel";
import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import type { ClubContext } from "./access";
import { countClubChannels, countClubMembers } from "./counts";
import {
  getChannelAccess,
  getChannelAccessForChannels,
  type ChannelAccessBatchState,
} from "./channelAccess";
import {
  clubChannelAudienceKindValidator,
  clubChannelPostingPolicyValidator,
  clubChannelVisibilityValidator,
  clubRolePermissionsValidator,
} from "../validators";

export const clubUserRefValidator = v.object({
  _id: v.id("users"),
  uniqueId: v.string(),
  firstName: v.string(),
  lastName: v.string(),
  roles: v.array(v.string()),
  avatarUrl: v.union(v.string(), v.null()),
});

export const clubViewerStateValidator = v.object({
  isMember: v.boolean(),
  hasClubRole: v.boolean(),
  isSponsor: v.boolean(),
  isAdmin: v.boolean(),
  canAccessWorkspace: v.boolean(),
  canManageChannels: v.boolean(),
  canManageMembership: v.boolean(),
  canApproveJoinRequests: v.boolean(),
  permissions: clubRolePermissionsValidator,
  hasPendingJoinRequest: v.boolean(),
});

export const visibleClubChannelValidator = v.object({
  _id: v.id("clubChannels"),
  _creationTime: v.number(),
  clubId: v.id("clubs"),
  ownerUnitId: v.optional(v.id("clubUnits")),
  position: v.optional(v.number()),
  accessPolicyVersion: v.optional(v.literal(2)),
  accessRoleIds: v.optional(v.array(v.id("clubRoles"))),
  accessUnitId: v.optional(v.id("clubUnits")),
  audienceKind: v.optional(clubChannelAudienceKindValidator),
  audienceUnitId: v.optional(v.id("clubUnits")),
  includeDescendants: v.optional(v.boolean()),
  includeAncestorLeaders: v.optional(v.boolean()),
  postingPolicy: v.optional(clubChannelPostingPolicyValidator),
  name: v.string(),
  description: v.optional(v.string()),
  visibility: clubChannelVisibilityValidator,
  createdById: v.id("users"),
  lastMessageAt: v.optional(v.number()),
  createdAt: v.number(),
  updatedAt: v.number(),
  viewerCanRead: v.boolean(),
  viewerCanPost: v.boolean(),
  memberships: v.array(v.object({ userId: v.id("users") })),
});

export const workspaceClubChannelValidator = v.object({
  _id: v.id("clubChannels"),
  clubId: v.id("clubs"),
  ownerUnitId: v.optional(v.id("clubUnits")),
  position: v.optional(v.number()),
  accessPolicyVersion: v.optional(v.literal(2)),
  accessRoleIds: v.optional(v.array(v.id("clubRoles"))),
  accessUnitId: v.optional(v.id("clubUnits")),
  audienceKind: v.optional(clubChannelAudienceKindValidator),
  audienceUnitId: v.optional(v.id("clubUnits")),
  includeDescendants: v.optional(v.boolean()),
  includeAncestorLeaders: v.optional(v.boolean()),
  postingPolicy: v.optional(clubChannelPostingPolicyValidator),
  name: v.string(),
  description: v.optional(v.string()),
  visibility: clubChannelVisibilityValidator,
  createdById: v.id("users"),
  createdAt: v.number(),
  updatedAt: v.number(),
  memberships: v.array(v.object({ userId: v.id("users") })),
  viewerCanPost: v.boolean(),
});

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
  joinPolicy: v.union(v.literal("OPEN"), v.literal("REQUEST"), v.literal("INVITE_ONLY")),
  memberLimit: v.optional(v.number()),
  isActive: v.boolean(),
  autoCreateUnitChannels: v.optional(v.boolean()),
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
    permissions: context.permissions,
    hasPendingJoinRequest: context.hasPendingJoinRequest,
  };
}

export async function toChannelViewerState(
  ctx: QueryCtx,
  channel: Doc<"clubChannels"> & {
    memberships: Doc<"clubChannelMemberships">[];
  },
  context: ClubContext,
  userId: Id<"users">,
) {
  const access = await getChannelAccess(ctx, channel, context, userId);
  return {
    viewerCanRead: access.canView,
    viewerCanPost: access.canPost,
  };
}

export async function clubSummaryWithCounts(
  ctx: QueryCtx,
  club: Doc<"clubs">,
  role?: string | null,
  counts?: { members?: number; channels?: number },
) {
  // Callers that already hold the rows pass their own totals. Otherwise the
  // denormalized counters answer it, and only a club written before those
  // existed falls back to reading every row — which is what
  // `backfillClubCounts` removes.
  const memberCount =
    counts?.members ?? club.memberCount ?? (await countClubMembers(ctx, club._id));
  const channelCount =
    counts?.channels ?? club.channelCount ?? (await countClubChannels(ctx, club._id));

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
    autoCreateUnitChannels: club.autoCreateUnitChannels,
    createdAt: club.createdAt,
    updatedAt: club.updatedAt,
    role: role ?? null,
    _count: {
      members: memberCount,
      channels: channelCount,
    },
  };
}

export async function getVisibleChannels(
  ctx: QueryCtx,
  clubId: Id<"clubs">,
  context: ClubContext,
  userId: Id<"users">,
  preloaded: ChannelAccessBatchState = {},
) {
  const channels = await ctx.db
    .query("clubChannels")
    .withIndex("by_clubId_and_visibility", (q) => q.eq("clubId", clubId))
    .collect();

  const accessByChannelId = await getChannelAccessForChannels(
    ctx,
    channels,
    context,
    userId,
    preloaded,
  );
  const membershipsByChannelId = new Map(
    await Promise.all(
      channels
        .filter((channel) => channel.visibility === "PRIVATE")
        .map(async (channel) => [
          channel._id,
          await ctx.db
            .query("clubChannelMemberships")
            .withIndex("by_channelId", (q) => q.eq("channelId", channel._id))
            .collect(),
        ] as const),
    ),
  );
  const result = [];
  for (const channel of channels) {
    const memberships = membershipsByChannelId.get(channel._id) ?? [];
    const channelDoc = { ...channel, memberships };
    const access = accessByChannelId.get(channel._id)!;
    const viewer = {
      viewerCanRead: access.canView,
      viewerCanPost: access.canPost,
    };
    if (!viewer.viewerCanRead) continue;

    result.push({
      _id: channel._id,
      _creationTime: channel._creationTime,
      clubId: channel.clubId,
      ownerUnitId: channel.ownerUnitId,
      position: channel.position,
      accessPolicyVersion: channel.accessPolicyVersion,
      accessRoleIds: channel.accessRoleIds,
      accessUnitId: channel.accessUnitId,
      audienceKind: channel.audienceKind,
      audienceUnitId: channel.audienceUnitId,
      includeDescendants: channel.includeDescendants,
      includeAncestorLeaders: channel.includeAncestorLeaders,
      postingPolicy: channel.postingPolicy,
      name: channel.name,
      description: channel.description,
      visibility: channel.visibility,
      createdById: channel.createdById,
      createdAt: channel.createdAt,
      updatedAt: channel.updatedAt,
      ...viewer,
      memberships: memberships.map((m) => ({ userId: m.userId })),
    });
  }
  return {
    channels: result.sort(
      (a, b) =>
        (a.position ?? Number.MAX_SAFE_INTEGER) -
          (b.position ?? Number.MAX_SAFE_INTEGER) ||
        a.createdAt - b.createdAt,
    ),
    totalCount: channels.length,
  };
}
