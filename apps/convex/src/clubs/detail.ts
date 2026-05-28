import { v } from "convex/values";
import { query } from "../_generated/server";
import { getMaybeCurrentAppUser } from "../../lib/currentUser";
import { anonymousClubContext, getViewerContext } from "./access";
import {
  clubSummaryWithCounts,
  getVisibleChannels,
  toClubUserRef,
  toViewerState,
} from "./serialize";

export const get = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    const club = await ctx.db.get(args.clubId);
    if (!club || !club.isActive) return null;

    const context = user
      ? await getViewerContext(ctx, args.clubId, user)
      : anonymousClubContext(club);

    const [memberships, sponsorsRows, tags, pendingRequests] = await Promise.all([
      ctx.db
        .query("clubMembers")
        .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
        .collect(),
      ctx.db
        .query("clubSponsors")
        .filter((q) => q.eq(q.field("clubId"), args.clubId))
        .collect(),
      context.canAccessWorkspace
        ? ctx.db
            .query("clubTags")
            .filter((q) => q.eq(q.field("clubId"), args.clubId))
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
    const leaders = hydratedMembers.filter((m) => !!m.role?.trim());

    const serializedTags = await Promise.all(
      tags.map(async (tag) => {
        const tagMembers = await ctx.db
          .query("clubTagMembers")
          .filter((q) => q.eq(q.field("tagId"), tag._id))
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
      ...hydratedMembers.map((m) => ({
        ...m.user,
        kind: "MEMBER" as const,
        clubRole: m.role,
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
    const channels = user && context.canAccessWorkspace
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
        context.canManageMembership && club.joinCode
          ? {
              code: club.joinCode,
              updatedAt: club.joinCodeUpdatedAt
                ? new Date(club.joinCodeUpdatedAt).toISOString()
                : null,
            }
          : null,
    };
  },
});
