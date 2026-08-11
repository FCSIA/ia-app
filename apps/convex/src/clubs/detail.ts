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
  clubSummaryValidator,
  clubUserRefValidator,
  clubViewerStateValidator,
  clubSummaryWithCounts,
  getVisibleChannels,
  toClubUserRef,
  toViewerState,
  visibleClubChannelValidator,
  workspaceClubChannelValidator,
} from "./serialize";
import {
  clubJoinRequestStatusValidator,
  clubMemberRoleValidator,
} from "../validators";

const clubMemberWithUserValidator = v.object({
  userId: v.id("users"),
  role: v.union(clubMemberRoleValidator, v.null()),
  customRoleId: v.union(v.id("clubRoles"), v.null()),
  user: clubUserRefValidator,
});
const clubSponsorWithUserValidator = v.object({
  userId: v.id("users"),
  user: clubUserRefValidator,
});
const clubDetailValidator = v.union(
  v.object({
    ...clubSummaryValidator.fields,
    members: v.array(clubMemberWithUserValidator),
    leaders: v.array(clubMemberWithUserValidator),
    sponsors: v.array(clubSponsorWithUserValidator),
    roles: v.array(v.object({ _id: v.id("clubRoles"), name: v.string() })),
    channels: v.array(visibleClubChannelValidator),
    tags: v.array(
      v.object({
        _id: v.id("clubTags"),
        clubId: v.id("clubs"),
        name: v.string(),
        slug: v.string(),
        createdById: v.id("users"),
        createdAt: v.number(),
        members: v.array(v.object({ user: clubUserRefValidator })),
      }),
    ),
    directory: v.array(
      v.object({
        ...clubUserRefValidator.fields,
        kind: v.union(v.literal("SPONSOR"), v.literal("MEMBER")),
        clubRole: v.union(clubMemberRoleValidator, v.null()),
        customRoleId: v.union(v.id("clubRoles"), v.null()),
        customRoleName: v.union(v.string(), v.null()),
        joinedAt: v.string(),
      }),
    ),
    viewer: clubViewerStateValidator,
    pendingJoinRequests: v.array(
      v.object({
        _id: v.id("clubJoinRequests"),
        clubId: v.id("clubs"),
        requesterId: v.id("users"),
        status: clubJoinRequestStatusValidator,
        createdAt: v.string(),
        requester: clubUserRefValidator,
      }),
    ),
    activeJoinCode: v.union(
      v.object({
        code: v.string(),
        updatedAt: v.union(v.string(), v.null()),
        expiresAt: v.string(),
      }),
      v.null(),
    ),
  }),
  v.null(),
);

const workspaceNavigationValidator = v.union(
  v.object({
    club: v.object({
      _id: v.id("clubs"),
      name: v.string(),
      logoUrl: v.union(v.string(), v.null()),
    }),
    viewer: v.object({ canManageChannels: v.boolean() }),
    channels: v.array(workspaceClubChannelValidator),
    myClubs: v.array(
      v.object({
        _id: v.id("clubs"),
        name: v.string(),
        logoUrl: v.union(v.string(), v.null()),
        role: v.union(clubMemberRoleValidator, v.null()),
      }),
    ),
  }),
  v.null(),
);

export const get = query({
  args: { clubId: v.id("clubs") },
  returns: clubDetailValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const club = await ctx.db.get(args.clubId);
    if (!club || !club.isActive) return null;

    const context = await getViewerContext(ctx, args.clubId, user);

    const [memberships, sponsorsRows, tags, pendingRequests, customRoles] = await Promise.all([
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
      ctx.db
        .query("clubRoles")
        .withIndex("by_clubId_and_name", (q) => q.eq("clubId", args.clubId))
        .collect(),
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
          customRoleId: m.customRoleId ?? null,
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
    const customRoleNames = new Map(customRoles.map((role) => [role._id, role.name]));
    // Sponsors are privileged for access control, but the public “Student
    // leaders” list must only contain members explicitly assigned LEADER.
    const leaders = hydratedMembers.filter((m) => m.role === "LEADER");
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
          _id: tag._id,
          clubId: tag.clubId,
          name: tag.name,
          slug: tag.slug,
          createdById: tag.createdById,
          createdAt: tag.createdAt,
          members: membersWithUsers.filter((m): m is NonNullable<typeof m> => !!m),
        };
      }),
    );

    const pendingJoinRequests = await Promise.all(
      pendingRequests.map(async (request) => {
        const requester = await ctx.db.get(request.requesterId);
        if (!requester) return null;
        return {
          _id: request._id,
          clubId: request.clubId,
          requesterId: request.requesterId,
          status: request.status,
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
        customRoleId: null,
        customRoleName: null,
        joinedAt: new Date(0).toISOString(),
      })),
      ...hydratedMembers
        .filter((m) => !sponsorUserIds.has(m.userId))
        .map((m) => ({
          ...m.user,
          kind: "MEMBER" as const,
          clubRole: isClubLeadershipRole(m.role) ? m.role : null,
          customRoleId: m.customRoleId ?? null,
          customRoleName: m.customRoleId ? customRoleNames.get(m.customRoleId) ?? null : null,
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
      roles: customRoles.map((role) => ({ _id: role._id, name: role.name })),
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
  returns: workspaceNavigationValidator,
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
            _id: channel._id,
            clubId: channel.clubId,
            name: channel.name,
            description: channel.description,
            visibility: channel.visibility,
            createdById: channel.createdById,
            createdAt: channel.createdAt,
            updatedAt: channel.updatedAt,
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
