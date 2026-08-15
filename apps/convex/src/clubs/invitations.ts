import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getCurrentAppUser } from "../../lib/currentUser";
import { getClubContext, getViewerContext } from "./access";
import {
  clubAudience,
  deliverMany,
  deliverNotification,
} from "../notifications/delivery";
import { clubJoinRateLimiter, contentRateLimiter } from "../rateLimits";
import { getDefaultClubRole } from "./rolePermissions";

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const JOIN_CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateSecureJoinCode() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (byte) => JOIN_CODE_ALPHABET[byte % JOIN_CODE_ALPHABET.length],
  ).join("");
}

async function addClubMember(
  ctx: MutationCtx,
  clubId: Id<"clubs">,
  userId: Id<"users">,
) {
  const existing = await ctx.db
    .query("clubMembers")
    .withIndex("by_clubId_and_userId", (q) =>
      q.eq("clubId", clubId).eq("userId", userId),
    )
    .unique();
  if (existing) return false;
  const club = await ctx.db.get(clubId);
  if (!club || !club.isActive) throw new Error("Club not found");
  if (club.memberLimit != null) {
    const members = await ctx.db
      .query("clubMembers")
      .withIndex("by_clubId", (q) => q.eq("clubId", clubId))
      .take(club.memberLimit);
    if (members.length >= club.memberLimit)
      throw new Error("Club member limit reached");
  }
  const defaultRole = await getDefaultClubRole(ctx, clubId);
  await ctx.db.insert("clubMembers", {
    clubId,
    userId,
    roleId: defaultRole?._id,
    joinedAt: Date.now(),
  });
  return true;
}

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

    if (!context.permissions.inviteMembers) {
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

    if (await addClubMember(ctx, args.clubId, user._id)) {
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
    const rate = await contentRateLimiter.limit(ctx, "joinRequestsByUser", {
      key: user._id,
    });
    if (!rate.ok) throw new Error("Too many join requests. Try again later.");
    const club = await ctx.db.get(args.clubId);

    if (!club || !club.isActive) {
      throw new Error("Club not found");
    }

    const existingRequest = await ctx.db
      .query("clubJoinRequests")
      .withIndex("by_clubId_and_requesterId_and_status", (q) =>
        q
          .eq("clubId", args.clubId)
          .eq("requesterId", user._id)
          .eq("status", "PENDING"),
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
      await deliverMany(
        ctx,
        managers.filter((id) => id !== user._id),
        {
          category: "CLUB_JOIN_REQUEST",
          title: "New club join request",
          body: `${user.firstName} ${user.lastName} requested to join ${club.name}.`,
          href: `/clubs/${args.clubId}/people?tab=requests`,
          subject: { kind: "club", clubId: args.clubId },
        },
      );
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

    if (!context.permissions.manageJoinRequests) {
      throw new Error("You do not have permission to manage join requests");
    }

    const request = await ctx.db.get(args.requestId);
    if (
      !request ||
      request.clubId !== args.clubId ||
      request.status !== "PENDING"
    ) {
      throw new Error("Join request not found or already processed");
    }

    if (args.accept) {
      await addClubMember(ctx, args.clubId, request.requesterId);
    }
    await ctx.db.patch(args.requestId, {
      status: args.accept ? "APPROVED" : "DECLINED",
      updatedAt: Date.now(),
    });
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
      action: args.accept
        ? "CLUB_JOIN_REQUEST_APPROVED"
        : "CLUB_JOIN_REQUEST_DECLINED",
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

    if (!context.permissions.inviteMembers) {
      throw new Error("You do not have permission to invite members");
    }

    await inviteRecipientByUniqueId(
      ctx,
      args.clubId,
      user._id,
      args.recipientUniqueId,
    );
  },
});

export const addMemberDirectly = mutation({
  args: { clubId: v.id("clubs"), recipientUniqueId: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);

    if (!context.permissions.inviteMembers) {
      throw new Error("You do not have permission to add members");
    }

    const recipient = await ctx.db
      .query("users")
      .withIndex("by_uniqueId", (q) =>
        q.eq("uniqueId", args.recipientUniqueId.trim()),
      )
      .unique();

    if (!recipient || !recipient.isActive || !recipient.isStudent) {
      throw new Error("Student not found");
    }

    if (!(await addClubMember(ctx, args.clubId, recipient._id))) {
      throw new Error("Student is already a member");
    }

    const now = Date.now();
    const [pendingInvite, pendingRequest] = await Promise.all([
      ctx.db
        .query("clubInvites")
        .withIndex("by_clubId_and_recipientId", (q) =>
          q.eq("clubId", args.clubId).eq("recipientId", recipient._id),
        )
        .first(),
      ctx.db
        .query("clubJoinRequests")
        .withIndex("by_clubId_and_requesterId_and_status", (q) =>
          q
            .eq("clubId", args.clubId)
            .eq("requesterId", recipient._id)
            .eq("status", "PENDING"),
        )
        .first(),
    ]);

    if (pendingInvite?.status === "PENDING") {
      await ctx.db.patch(pendingInvite._id, {
        status: "ACCEPTED",
        updatedAt: now,
      });
    }
    if (pendingRequest) {
      await ctx.db.patch(pendingRequest._id, {
        status: "APPROVED",
        updatedAt: now,
      });
    }

    await ctx.db.insert("auditEvents", {
      actorId: user._id,
      action: "CLUB_MEMBER_ADDED_DIRECTLY",
      entityType: "Club",
      entityId: args.clubId,
      meta: { userId: recipient._id },
      createdAt: now,
    });
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

    if (!context.permissions.inviteMembers) {
      throw new Error("You do not have permission to invite members");
    }

    if (args.uniqueIds.length === 0) {
      throw new Error(
        "CSV has no recognizable student unique IDs. Use Import units for a name,unit file.",
      );
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
        results.errors.push(
          `Row ${index + 2}: duplicate unique ID ${uniqueId} in file`,
        );
        continue;
      }
      seen.add(uniqueId);

      try {
        await inviteRecipientByUniqueId(ctx, args.clubId, user._id, uniqueId);
        results.invited++;
      } catch (error) {
        results.skipped++;
        const message =
          error instanceof Error ? error.message : "Failed to process row";
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

    if (
      !invite ||
      invite.recipientId !== user._id ||
      invite.status !== "PENDING"
    ) {
      throw new Error("Invite not found or already processed");
    }

    if (args.accept) {
      await addClubMember(ctx, invite.clubId, user._id);
    }
    await ctx.db.patch(args.inviteId, {
      status: args.accept ? "ACCEPTED" : "DECLINED",
      updatedAt: Date.now(),
    });
  },
});

export const generateJoinCode = mutation({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);

    if (!context.permissions.manageJoinCodes) {
      throw new Error("You do not have permission to manage join codes");
    }

    const code = generateSecureJoinCode();
    const now = Date.now();
    await ctx.db.patch(args.clubId, {
      joinCode: code,
      joinCodeUpdatedAt: now,
      joinCodeExpiresAt: now + JOIN_CODE_TTL_MS,
    });
    await ctx.db.insert("auditEvents", {
      actorId: user._id,
      action: "CLUB_JOIN_CODE_GENERATED",
      entityType: "Club",
      entityId: args.clubId,
      createdAt: now,
    });
    return code;
  },
});

export const revokeJoinCode = mutation({
  args: { clubId: v.id("clubs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    if (!context.permissions.manageJoinCodes)
      throw new Error("You do not have permission to manage join codes");
    await ctx.db.patch(args.clubId, {
      joinCode: undefined,
      joinCodeUpdatedAt: Date.now(),
      joinCodeExpiresAt: undefined,
    });
    await ctx.db.insert("auditEvents", {
      actorId: user._id,
      action: "CLUB_JOIN_CODE_REVOKED",
      entityType: "Club",
      entityId: args.clubId,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const redeemJoinCode = mutation({
  args: { clubId: v.id("clubs"), code: v.string() },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const rate = await clubJoinRateLimiter.limit(ctx, "codeRedemptionsByUser", {
      key: user._id,
    });
    if (!rate.ok)
      throw new Error("Too many join-code attempts. Try again later.");
    const club = await ctx.db.get(args.clubId);

    if (
      !club ||
      !club.isActive ||
      club.joinCode !== args.code.trim().toUpperCase() ||
      !club.joinCodeExpiresAt ||
      club.joinCodeExpiresAt <= Date.now()
    ) {
      throw new Error("Invalid join code");
    }
    const inserted = await addClubMember(ctx, args.clubId, user._id);
    if (inserted)
      await ctx.db.insert("auditEvents", {
        actorId: user._id,
        action: "CLUB_JOIN_CODE_REDEEMED",
        entityType: "Club",
        entityId: args.clubId,
        createdAt: Date.now(),
      });
  },
});
