import { v } from "convex/values";
import { query } from "../_generated/server";
import type { Doc } from "../_generated/dataModel";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import {
  canPostInChannel,
  canReadChannel,
  getChannelViewerContext,
  getViewerContext,
  isClubLeadershipRole,
} from "./access";
import {
  clubSummaryWithCounts,
  getVisibleChannels,
  toClubUserRef,
  toViewerState,
} from "./serialize";

export const get = query({
  args: { clubId: v.id("clubs") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const club = await ctx.db.get(args.clubId);
    if (!club || !club.isActive) return null;

    const context = await getViewerContext(ctx, args.clubId, user);

    const [memberships, sponsorsRows, tags, pendingRequests] = await Promise.all([
      ctx.db
        .query("clubMembers")
        .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
        .collect(),
      ctx.db
        .query("clubSponsors")
        .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
        .collect(),
      context.canAccessWorkspace
        ? ctx.db
            .query("clubTags")
            .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
            .collect()
        : Promise.resolve([]),
      context.canApproveJoinRequests
        ? ctx.db
            .query("clubJoinRequests")
            .withIndex("by_clubId_and_status", (q) =>
              q.eq("clubId", args.clubId).eq("status", "PENDING"),
            )
            .collect()
        : Promise.resolve([]),
    ]);

    // Deduplicate memberships by userId to prevent duplicate entries
    const uniqueMemberships = Array.from(
      new Map(memberships.map((m) => [m.userId, m])).values(),
    );
    // Deduplicate sponsors by userId to prevent duplicate entries
    const uniqueSponsors = Array.from(
      new Map(sponsorsRows.map((s) => [s.userId, s])).values(),
    );

    const members = await Promise.all(
      uniqueMemberships.map(async (m) => {
        const memberUser = await ctx.db.get(m.userId);
        if (!memberUser) return null;
        return {
          userId: m.userId,
          role: m.role ?? null,
          user: toClubUserRef(memberUser),
        };
      }),
    );

    const sponsors = await Promise.all(
      uniqueSponsors.map(async (s) => {
        const sponsorUser = await ctx.db.get(s.userId);
        if (!sponsorUser) return null;
        return { userId: s.userId, user: toClubUserRef(sponsorUser) };
      }),
    );

    const hydratedMembers = members.filter((m): m is NonNullable<typeof m> => !!m);
    const hydratedSponsors = sponsors.filter((s): s is NonNullable<typeof s> => !!s);
    const leaders = hydratedMembers.filter((m) => isClubLeadershipRole(m.role));
    const sponsorUserIds = new Set(uniqueSponsors.map((s) => s.userId));

    const serializedTags = await Promise.all(
      tags.map(async (tag) => {
        const tagMembers = await ctx.db
          .query("clubTagMembers")
          .withIndex("by_tagId", (q) => q.eq("tagId", tag._id))
          .collect();
        const membersWithUsers = await Promise.all(
          tagMembers.map(async (tm) => {
            const u = await ctx.db.get(tm.userId);
            return u ? { user: toClubUserRef(u) } : null;
          }),
        );
        return {
          ...tag,
          members: membersWithUsers.filter((m): m is NonNullable<typeof m> => !!m),
        };
      }),
    );

    const pendingJoinRequests = await Promise.all(
      pendingRequests.map(async (request) => {
        const requester = await ctx.db.get(request.requesterId);
        if (!requester) return null;
        return {
          ...request,
          createdAt: new Date(request.createdAt).toISOString(),
          requester: toClubUserRef(requester),
        };
      }),
    );

    const directory = [
      ...hydratedSponsors.map((s) => ({
        ...s.user,
        kind: "SPONSOR" as const,
        clubRole: "SPONSOR" as const,
        joinedAt: new Date(0).toISOString(),
      })),
      ...hydratedMembers
        .filter((m) => !sponsorUserIds.has(m.userId))
        .map((m) => ({
          ...m.user,
          kind: "MEMBER" as const,
          clubRole: isClubLeadershipRole(m.role) ? m.role : null,
          joinedAt: new Date(
            uniqueMemberships.find((row) => row.userId === m.userId)?.joinedAt ?? 0,
          ).toISOString(),
        })),
    ];

    const summary = await clubSummaryWithCounts(
      ctx,
      club,
      context.membership?.role ?? null,
    );
    const channels = context.canAccessWorkspace
      ? await getVisibleChannels(ctx, args.clubId, context, user._id)
      : [];

    return {
      ...summary,
      members: context.canAccessWorkspace ? hydratedMembers : [],
      leaders,
      sponsors: hydratedSponsors,
      channels,
      tags: context.canAccessWorkspace ? serializedTags : [],
      directory: context.canAccessWorkspace ? directory : [],
      viewer: toViewerState(context),
      pendingJoinRequests: pendingJoinRequests.filter(
        (r): r is NonNullable<typeof r> => !!r,
      ),
      activeJoinCode:
        context.canManageMembership && club.joinCode && club.joinCodeExpiresAt && club.joinCodeExpiresAt > Date.now()
          ? {
              code: club.joinCode,
              updatedAt: club.joinCodeUpdatedAt
                ? new Date(club.joinCodeUpdatedAt).toISOString()
                : null,
              expiresAt: new Date(club.joinCodeExpiresAt).toISOString(),
            }
          : null,
    };
  },
});

/** Small, stable payload for the club shell on every workspace route. */
export const getWorkspaceNavigation = query({
  args: { clubId: v.id("clubs") },
  returns: v.any(),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return null;
    const club = await ctx.db.get(args.clubId);
    if (!club || !club.isActive) return null;
    const context = await getChannelViewerContext(ctx, club, user);
    if (!context.canAccessWorkspace) return null;

    const channelRows = await ctx.db
      .query("clubChannels")
      .withIndex("by_clubId_and_visibility", (q) => q.eq("clubId", club._id))
      .collect();
    const channels = (
      await Promise.all(
        channelRows.map(async (channel) => {
          let memberships: Doc<"clubChannelMemberships">[] = [];
          if (channel.visibility === "PRIVATE") {
            if (context.canManageChannels) {
              memberships = await ctx.db
                .query("clubChannelMemberships")
                .withIndex("by_channelId", (q) => q.eq("channelId", channel._id))
                .collect();
            } else {
              const viewerMembership = await ctx.db
                .query("clubChannelMemberships")
                .withIndex("by_channelId_and_userId", (q) =>
                  q.eq("channelId", channel._id).eq("userId", user._id),
                )
                .unique();
              memberships = viewerMembership ? [viewerMembership] : [];
            }
          }
          const channelWithMemberships = { ...channel, memberships };
          if (!canReadChannel(channelWithMemberships, context, user._id)) return null;
          return {
            ...channel,
            memberships: memberships.map((membership) => ({ userId: membership.userId })),
            viewerCanPost: canPostInChannel(channelWithMemberships, context, user._id),
          };
        }),
      )
    ).filter((channel): channel is NonNullable<typeof channel> => !!channel);

    const [memberRows, sponsorRows] = await Promise.all([
      ctx.db
        .query("clubMembers")
        .withIndex("by_userId_and_joinedAt", (q) => q.eq("userId", user._id))
        .collect(),
      ctx.db
        .query("clubSponsors")
        .withIndex("by_userId_and_clubId", (q) => q.eq("userId", user._id))
        .collect(),
    ]);
    const clubRoles = new Map([
      ...memberRows.map((membership) => [membership.clubId, membership.role ?? null] as const),
      ...sponsorRows.map((sponsorship) => [sponsorship.clubId, "SPONSOR" as const] as const),
    ]);
    const myClubs = (
      await Promise.all(
        Array.from(clubRoles, async ([clubId, role]) => {
          const row = await ctx.db.get(clubId);
          if (!row?.isActive) return null;
          return { _id: row._id, name: row.name, logoUrl: row.logoUrl ?? null, role };
        }),
      )
    ).filter((row): row is NonNullable<typeof row> => !!row);

    return {
      club: { _id: club._id, name: club.name, logoUrl: club.logoUrl ?? null },
      viewer: { canManageChannels: context.canManageChannels },
      channels,
      myClubs,
    };
  },
});
