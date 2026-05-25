import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser } from "../lib/currentUser";
import { clubValidator } from "./_lib";
import { getClubContext, getViewerContext } from "./access";

export const getAll = query({
  args: {},
  returns: v.array(clubValidator),
  handler: async (ctx) => {
    return await ctx.db
      .query("clubs")
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect();
  },
});

export const getOne = query({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getViewerContext(ctx, args.clubId, user);

    const club = await ctx.db.get(args.clubId);
    if (!club) throw new Error("Club not found");

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
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const clubId = await ctx.db.insert("clubs", {
      name: args.name,
      description: args.description,
      joinPolicy: args.joinPolicy,
      memberLimit: args.memberLimit,
      isActive: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.db.insert("auditEvents", {
      action: "CLUB_CREATED",
      entityType: "Club",
      entityId: clubId,
      createdAt: Date.now(),
    });

    return clubId;
  },
});

export const update = mutation({
  args: {
    clubId: v.id("clubs"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    joinPolicy: v.optional(v.union(v.literal("OPEN"), v.literal("REQUEST"))),
    memberLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { clubId, ...updates } = args;
    await ctx.db.patch(clubId, {
      ...updates,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("auditEvents", {
      action: "CLUB_UPDATED",
      entityType: "Club",
      entityId: clubId,
      createdAt: Date.now(),
    });
  },
});

export const deactivate = mutation({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.clubId, { isActive: false, updatedAt: Date.now() });

    await ctx.db.insert("auditEvents", {
      action: "CLUB_DEACTIVATED",
      entityType: "Club",
      entityId: args.clubId,
      createdAt: Date.now(),
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
      throw new Error("Only club role holders, sponsors, or admins can assign club roles");
    }

    const member = await ctx.db
      .query("clubMembers")
      .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
      .filter((q) => q.eq(q.field("userId"), args.memberId))
      .first();

    if (member) {
      await ctx.db.patch(member._id, { role: args.role });
    }

    await ctx.db.insert("auditEvents", {
      action: "CLUB_MEMBER_ROLE_SET",
      entityType: "Club",
      entityId: args.clubId,
      meta: { memberId: args.memberId, role: args.role },
      createdAt: Date.now(),
    });
  },
});

export const removeMember = mutation({
  args: { clubId: v.id("clubs"), memberId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);

    if (!context.canManageMembership) {
      throw new Error("Only club role holders, sponsors, or admins can remove members");
    }

    const member = await ctx.db
      .query("clubMembers")
      .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
      .filter((q) => q.eq(q.field("userId"), args.memberId))
      .first();

    if (member) {
      await ctx.db.delete(member._id);
    }

    await ctx.db.insert("auditEvents", {
      action: "CLUB_MEMBER_REMOVED",
      entityType: "Club",
      entityId: args.clubId,
      meta: { memberId: args.memberId },
      createdAt: Date.now(),
    });
  },
});
