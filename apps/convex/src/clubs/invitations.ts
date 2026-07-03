import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getCurrentAppUser } from "../../lib/currentUser";
import { getClubContext, getViewerContext } from "./access";
import { clubAudience, deliverMany, deliverNotification } from "../notifications/delivery";

export const searchInviteCandidates = query({
  args: {
    clubId: v.id("clubs"),
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      _id: v.id("users"),
      uniqueId: v.string(),
      firstName: v.string(),
      lastName: v.string(),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);

    if (!context.hasClubRole && !context.isSponsor && !context.isAdmin) {
      return [];
    }

    const search = args.query.trim().toLowerCase();
    if (search.length < 2) return [];
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);

    const candidates = await ctx.db
      .query("users")
      .withSearchIndex("search_users", (q) =>
        q.search("searchText", search).eq("isStudent", true),
      )
      .take(limit + 20);

    const results = [];
    for (const candidate of candidates) {
      if (!candidate.isActive) continue;
      const existingMember = await ctx.db
        .query("clubMembers")
        .withIndex("by_clubId_and_userId", (q) =>
          q.eq("clubId", args.clubId).eq("userId", candidate._id),
        )
        .first();
      if (existingMember) continue;

      results.push({
        _id: candidate._id,
        uniqueId: candidate.uniqueId,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
      });
      if (results.length >= limit) break;
    }

    return results;
  },
});

async function inviteRecipientByUniqueId(
  ctx: MutationCtx,
  clubId: Id<"clubs">,
  senderId: Id<"users">,
  recipientUniqueId: string,
) {
  const recipient = await ctx.db
    .query("users")
    .withIndex("by_uniqueId", (q) => q.eq("uniqueId", recipientUniqueId))
    .unique();

  if (!recipient || !recipient.isActive) {
    throw new Error("User not found");
  }

  const existingMember = await ctx.db
    .query("clubMembers")
    .withIndex("by_clubId_and_userId", (q) =>
      q.eq("clubId", clubId).eq("userId", recipient._id),
    )
    .first();

  if (existingMember) {
    throw new Error("User is already a member");
  }

  const existingInvite = await ctx.db
    .query("clubInvites")
    .withIndex("by_clubId_and_recipientId", (q) =>
      q.eq("clubId", clubId).eq("recipientId", recipient._id),
    )
    .first();

  if (!existingInvite) {
    await ctx.db.insert("clubInvites", {
      clubId,
      senderId,
      recipientId: recipient._id,
      status: "PENDING",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  } else if (existingInvite.status !== "PENDING") {
    await ctx.db.patch(existingInvite._id, {
      status: "PENDING",
      senderId,
      updatedAt: Date.now(),
    });
  }
}

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
      .withIndex("by_clubId_and_userId", (q) =>
        q.eq("clubId", args.clubId).eq("userId", user._id),
      )
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
      .withIndex("by_clubId_and_requesterId_and_status", (q) =>
        q.eq("clubId", args.clubId).eq("requesterId", user._id).eq("status", "PENDING")
      )
      .first();

    if (!existingRequest) {
      await ctx.db.insert("clubJoinRequests", {
        clubId: args.clubId,
        requesterId: user._id,
        status: "PENDING",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      const managers = await clubAudience(ctx, args.clubId);
      await deliverMany(ctx, managers.filter((id) => id !== user._id), {
        category: "CLUB_JOIN_REQUEST",
        title: "New club join request",
        body: `${user.firstName} ${user.lastName} requested to join ${club.name}.`,
        href: `/clubs/${args.clubId}/people`,
        subject: { kind: "club", clubId: args.clubId },
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
    const club = await ctx.db.get(args.clubId);
    await deliverNotification(ctx, {
      userId: request.requesterId,
      category: "CLUB_JOIN_REQUEST",
      title: args.accept ? "Club request approved" : "Club request declined",
      body: `${club?.name ?? "Club"} ${args.accept ? "approved" : "declined"} your join request.`,
      href: `/clubs/${args.clubId}`,
      subject: { kind: "club", clubId: args.clubId },
    });

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

    await inviteRecipientByUniqueId(ctx, args.clubId, user._id, args.recipientUniqueId);
  },
});

export const bulkInvite = mutation({
  args: {
    clubId: v.id("clubs"),
    uniqueIds: v.array(v.string()),
  },
  returns: v.object({
    invited: v.number(),
    skipped: v.number(),
    errors: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);

    if (!context.hasClubRole && !context.isSponsor && !context.isAdmin) {
      throw new Error("Not authorized to invite");
    }

    if (args.uniqueIds.length === 0) {
      throw new Error("CSV file is empty");
    }

    const seen = new Set<string>();
    const results = { invited: 0, skipped: 0, errors: [] as string[] };

    for (const [index, rawId] of args.uniqueIds.entries()) {
      const uniqueId = rawId.trim();
      if (!uniqueId) {
        results.skipped++;
        results.errors.push(`Row ${index + 2}: missing unique ID`);
        continue;
      }
      if (seen.has(uniqueId)) {
        results.skipped++;
        results.errors.push(`Row ${index + 2}: duplicate unique ID ${uniqueId} in file`);
        continue;
      }
      seen.add(uniqueId);

      try {
        await inviteRecipientByUniqueId(ctx, args.clubId, user._id, uniqueId);
        results.invited++;
      } catch (error) {
        results.skipped++;
        const message = error instanceof Error ? error.message : "Failed to process row";
        results.errors.push(`Row ${index + 2}: ${message}`);
      }
    }

    await ctx.db.insert("auditEvents", {
      action: "CLUB_INVITES_BULK_IMPORTED",
      entityType: "Club",
      entityId: args.clubId,
      meta: { invited: results.invited, skipped: results.skipped },
      createdAt: Date.now(),
    });

    return results;
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
      .withIndex("by_clubId_and_userId", (q) =>
        q.eq("clubId", args.clubId).eq("userId", user._id),
      )
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
