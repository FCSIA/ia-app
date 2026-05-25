import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { getCurrentAppUser } from "../lib/currentUser";
import { getClubContext, getViewerContext } from "./access";

export const joinOpenClub = mutation({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const club = await ctx.db.get(args.clubId);

    if (!club || !club.isActive) {
      throw new Error("Club not found");
    }
    if (club.joinPolicy !== "OPEN") {
      throw new Error("Club is not open to join");
    }

    const existingMember = await ctx.db
      .query("clubMembers")
      .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();

    if (!existingMember) {
      await ctx.db.insert("clubMembers", {
        clubId: args.clubId,
        userId: user._id,
        role: "MEMBER",
        joinedAt: Date.now(),
      });
      
      await ctx.db.insert("auditEvents", {
        action: "CLUB_JOINED",
        entityType: "Club",
        entityId: args.clubId,
        meta: { userId: user._id },
        createdAt: Date.now(),
      });
    }
  },
});

export const requestToJoin = mutation({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const club = await ctx.db.get(args.clubId);

    if (!club || !club.isActive) {
      throw new Error("Club not found");
    }

    const existingRequest = await ctx.db
      .query("clubJoinRequests")
      .withIndex("by_clubId_and_status", (q) =>
        q.eq("clubId", args.clubId).eq("status", "PENDING")
      )
      .filter((q) => q.eq(q.field("requesterId"), user._id))
      .first();

    if (!existingRequest) {
      await ctx.db.insert("clubJoinRequests", {
        clubId: args.clubId,
        requesterId: user._id,
        status: "PENDING",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

export const respondToJoinRequest = mutation({
  args: {
    clubId: v.id("clubs"),
    requestId: v.id("clubJoinRequests"),
    accept: v.boolean(),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);

    if (!context.canApproveJoinRequests) {
      throw new Error("Only club sponsors or admins can approve join requests");
    }

    const request = await ctx.db.get(args.requestId);
    if (!request || request.clubId !== args.clubId || request.status !== "PENDING") {
      throw new Error("Join request not found or already processed");
    }

    await ctx.db.patch(args.requestId, {
      status: args.accept ? "APPROVED" : "DECLINED",
      updatedAt: Date.now(),
    });

    if (args.accept) {
      await ctx.db.insert("clubMembers", {
        clubId: args.clubId,
        userId: request.requesterId,
        role: "MEMBER",
        joinedAt: Date.now(),
      });
    }

    await ctx.db.insert("auditEvents", {
      action: args.accept ? "CLUB_JOIN_REQUEST_APPROVED" : "CLUB_JOIN_REQUEST_DECLINED",
      entityType: "ClubJoinRequest",
      entityId: args.requestId,
      createdAt: Date.now(),
    });
  },
});

export const sendInvite = mutation({
  args: { clubId: v.id("clubs"), recipientUniqueId: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);

    if (!context.hasClubRole && !context.isSponsor && !context.isAdmin) {
      throw new Error("Not authorized to invite");
    }

    const recipient = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("uniqueId"), args.recipientUniqueId))
      .first();

    if (!recipient || !recipient.isActive) {
      throw new Error("User not found");
    }

    const existingInvite = await ctx.db
      .query("clubInvites")
      .filter((q) => q.eq(q.field("clubId"), args.clubId))
      .filter((q) => q.eq(q.field("recipientId"), recipient._id))
      .first();

    if (!existingInvite) {
      await ctx.db.insert("clubInvites", {
        clubId: args.clubId,
        senderId: user._id,
        recipientId: recipient._id,
        status: "PENDING",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

export const respondToInvite = mutation({
  args: { inviteId: v.id("clubInvites"), accept: v.boolean() },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const invite = await ctx.db.get(args.inviteId);

    if (!invite || invite.recipientId !== user._id || invite.status !== "PENDING") {
      throw new Error("Invite not found or already processed");
    }

    await ctx.db.patch(args.inviteId, {
      status: args.accept ? "ACCEPTED" : "DECLINED",
      updatedAt: Date.now(),
    });

    if (args.accept) {
      await ctx.db.insert("clubMembers", {
        clubId: invite.clubId,
        userId: user._id,
        role: "MEMBER",
        joinedAt: Date.now(),
      });
    }
  },
});

export const generateJoinCode = mutation({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);

    if (!context.canManageMembership) {
      throw new Error("Not authorized");
    }

    // simplistic code gen for demo
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    await ctx.db.patch(args.clubId, {
      joinCode: code,
      joinCodeUpdatedAt: Date.now(),
    });
    return code;
  },
});

export const redeemJoinCode = mutation({
  args: { clubId: v.id("clubs"), code: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const club = await ctx.db.get(args.clubId);

    if (!club || !club.isActive || club.joinCode !== args.code) {
      throw new Error("Invalid join code");
    }

    const existingMember = await ctx.db
      .query("clubMembers")
      .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
      .filter((q) => q.eq(q.field("userId"), user._id))
      .first();

    if (!existingMember) {
      await ctx.db.insert("clubMembers", {
        clubId: args.clubId,
        userId: user._id,
        role: "MEMBER",
        joinedAt: Date.now(),
      });
    }
  },
});
