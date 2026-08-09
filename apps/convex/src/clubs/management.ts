import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser, requireAnyRole } from "../../lib/currentUser";
import { logAuditEvent } from "../audit/_lib";
import { getClubContext, getViewerContext } from "./access";
import { clubSummaryValidator, clubSummaryWithCounts } from "./serialize";
import type { AppRole } from "../../lib/roles";

const CLUB_CREATION_ROLES = ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF", "TEACHER"] as const satisfies readonly AppRole[];

export function canCreateClub(roles: readonly AppRole[]) {
  return roles.some((role) => (CLUB_CREATION_ROLES as readonly AppRole[]).includes(role));
}

export const getAll = query({
  args: {},
  returns: v.array(clubSummaryValidator),
  handler: async (ctx) => {
    await getCurrentAppUser(ctx);
    const clubs = await ctx.db
      .query("clubs")
      .withIndex("by_isActive_and_name", (q) => q.eq("isActive", true))
      .collect();
    return Promise.all(clubs.map((club) => clubSummaryWithCounts(ctx, club)));
  },
});

export const getOne = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return null;
    const club = await ctx.db.get(args.clubId);
    if (!club) return null;
    const context = await getViewerContext(ctx, args.clubId, user);
    if (!context.canAccessWorkspace) return null;

    const members = await ctx.db
      .query("clubMembers")
      .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
      .collect();

    return {
      ...club,
      viewer: context,
      members,
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    joinPolicy: v.union(v.literal("OPEN"), v.literal("REQUEST")),
    memberLimit: v.optional(v.number()),
    sponsorIds: v.optional(v.array(v.id("users"))),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireAnyRole(user, [...CLUB_CREATION_ROLES]);

    const name = args.name.trim();
    if (!name) throw new ConvexError("Club name is required");

    const clubId = await ctx.db.insert("clubs", {
      name,
      description: args.description?.trim() || undefined,
      joinPolicy: args.joinPolicy,
      memberLimit: args.memberLimit,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    for (const sponsorId of args.sponsorIds ?? []) {
      const existing = await ctx.db
        .query("clubSponsors")
        .withIndex("by_clubId_and_userId", (q) =>
          q.eq("clubId", clubId).eq("userId", sponsorId),
        )
        .first();
      if (!existing) {
        await ctx.db.insert("clubSponsors", {
          clubId,
          userId: sponsorId,
          addedAt: Date.now(),
        });
      }
    }

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_CREATED",
      entityType: "Club",
      entityId: clubId,
    });

    return clubId;
  },
});

export const update = mutation({
  args: {
    clubId: v.id("clubs"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    overview: v.optional(v.string()),
    logoUrl: v.optional(v.string()),
    bannerUrl: v.optional(v.string()),
    accentColor: v.optional(v.string()),
    joinPolicy: v.optional(v.union(v.literal("OPEN"), v.literal("REQUEST"))),
    memberLimit: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const { clubId, memberLimit, ...updates } = args;
    const context = await getClubContext(ctx, clubId, user);
    if (!context.canManageMembership) {
      throw new ConvexError("Not authorized to update this club");
    }

    const cleanUpdates = {
      ...updates,
      ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
      ...(updates.description !== undefined
        ? { description: updates.description?.trim() || undefined }
        : {}),
      ...(updates.overview !== undefined
        ? { overview: updates.overview?.trim() || undefined }
        : {}),
      ...(updates.logoUrl !== undefined ? { logoUrl: updates.logoUrl || undefined } : {}),
      ...(updates.bannerUrl !== undefined ? { bannerUrl: updates.bannerUrl || undefined } : {}),
      ...(updates.accentColor !== undefined
        ? { accentColor: updates.accentColor || undefined }
        : {}),
    };

    if (cleanUpdates.name !== undefined && !cleanUpdates.name) {
      throw new ConvexError("Club name is required");
    }

    if (
      memberLimit !== undefined &&
      memberLimit !== null &&
      (!Number.isInteger(memberLimit) || memberLimit < 1)
    ) {
      throw new ConvexError("Member limit must be a positive whole number.");
    }

    await ctx.db.patch(clubId, {
      ...cleanUpdates,
      ...(memberLimit !== undefined
        ? { memberLimit: memberLimit ?? undefined }
        : {}),
      updatedAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_UPDATED",
      entityType: "Club",
      entityId: clubId,
    });
  },
});

export const deactivate = mutation({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireAnyRole(user, ["ADMIN", "SUPER_ADMIN"]);

    await ctx.db.patch(args.clubId, { isActive: false, updatedAt: Date.now() });

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_DEACTIVATED",
      entityType: "Club",
      entityId: args.clubId,
    });
  },
});

export const setMemberRole = mutation({
  args: {
    clubId: v.id("clubs"),
    memberId: v.id("users"),
    role: v.optional(v.union(v.literal("MEMBER"), v.literal("LEADER"), v.literal("SPONSOR"))),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);

    if (!context.canManageMembership) {
      throw new ConvexError("Only club role holders, sponsors, or admins can assign club roles");
    }

    const member = await ctx.db
      .query("clubMembers")
      .withIndex("by_clubId_and_userId", (q) =>
        q.eq("clubId", args.clubId).eq("userId", args.memberId),
      )
      .first();

    if (member) {
      await ctx.db.patch(member._id, { role: args.role });
    }

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_MEMBER_ROLE_SET",
      entityType: "Club",
      entityId: args.clubId,
      meta: { memberId: args.memberId, role: args.role },
    });
  },
});

export const removeMember = mutation({
  args: { clubId: v.id("clubs"), memberId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);

    if (!context.canManageMembership) {
      throw new ConvexError("Only club role holders, sponsors, or admins can remove members");
    }

    const member = await ctx.db
      .query("clubMembers")
      .withIndex("by_clubId_and_userId", (q) =>
        q.eq("clubId", args.clubId).eq("userId", args.memberId),
      )
      .first();

    if (member) {
      await ctx.db.delete(member._id);
    }

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_MEMBER_REMOVED",
      entityType: "Club",
      entityId: args.clubId,
      meta: { memberId: args.memberId },
    });
  },
});

export const getMyClubs = query({
  args: {},
  handler: async (ctx) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return { memberOf: [], sponsoring: [] };
    const memberships = await ctx.db
      .query("clubMembers")
      .withIndex("by_userId_and_joinedAt", (q) => q.eq("userId", user._id))
      .collect();
    const memberOf = (
      await Promise.all(
        memberships.map(async (m) => {
          const club = await ctx.db.get(m.clubId);
          if (!club?.isActive) return null;
          return clubSummaryWithCounts(ctx, club, m.role ?? null);
        }),
      )
    ).filter((club): club is NonNullable<typeof club> => !!club);

    const sponsors = await ctx.db
      .query("clubSponsors")
      .withIndex("by_userId_and_clubId", (q) => q.eq("userId", user._id))
      .collect();
    const sponsoring = (
      await Promise.all(
        sponsors.map(async (s) => {
          const club = await ctx.db.get(s.clubId);
          if (!club?.isActive) return null;
          return clubSummaryWithCounts(ctx, club, "SPONSOR");
        }),
      )
    ).filter((club): club is NonNullable<typeof club> => !!club);

    return { memberOf, sponsoring };
  },
});

export const listMyInvites = query({
  args: {},
  handler: async (ctx) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];
    const invites = await ctx.db
      .query("clubInvites")
      .withIndex("by_recipientId_and_status_and_updatedAt", (q) =>
        q.eq("recipientId", user._id).eq("status", "PENDING"),
      )
      .order("desc")
      .collect();

    return Promise.all(
      invites.map(async (invite) => {
        const club = await ctx.db.get(invite.clubId);
        const sender = await ctx.db.get(invite.senderId);
        if (!club || !sender) return null;
        return {
          _id: invite._id,
          club: {
            _id: club._id,
            name: club.name,
            description: club.description ?? null,
          },
          sender: {
            _id: sender._id,
            firstName: sender.firstName,
            lastName: sender.lastName,
          },
        };
      }),
    ).then((rows) => rows.filter((r): r is NonNullable<typeof r> => !!r));
  },
});
