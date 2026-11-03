import { logAuditEvent } from "../audit/_lib";
import { displayName } from '../../../shared/user-name';
import { v } from "convex/values";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "../_generated/server";
import { internal } from "../_generated/api";
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
import { adjustClubCounts } from "./counts";

const JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const JOIN_CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_BULK_DIRECT_MEMBER_IMPORTS = 200;
const BULK_DIRECT_MEMBER_IMPORT_BATCH_SIZE = 5;

const bulkDirectMemberRowResultValidator = v.union(
  v.object({ kind: v.literal("added") }),
  v.object({ kind: v.literal("alreadyMember") }),
  v.object({ kind: v.literal("memberLimitReached") }),
  v.object({ kind: v.literal("skipped"), error: v.string() }),
);

const bulkDirectMemberImportResultValidator = v.object({
  added: v.number(),
  alreadyMember: v.number(),
  memberLimitReached: v.number(),
  skipped: v.number(),
  errors: v.array(v.string()),
});

const clubMemberAddResultValidator = v.union(
  v.object({ kind: v.literal("added") }),
  v.object({ kind: v.literal("alreadyMember") }),
  v.object({ kind: v.literal("memberLimitReached") }),
);

const inviteResponseResultValidator = v.union(
  v.object({ kind: v.literal("added") }),
  v.object({ kind: v.literal("alreadyMember") }),
  v.object({ kind: v.literal("memberLimitReached") }),
  v.object({ kind: v.literal("declined") }),
);

type ClubMemberAddResult =
  | { kind: "added" }
  | { kind: "alreadyMember" }
  | { kind: "memberLimitReached" };

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
): Promise<ClubMemberAddResult> {
  const existing = await ctx.db
    .query("clubMembers")
    .withIndex("by_clubId_and_userId", (q) =>
      q.eq("clubId", clubId).eq("userId", userId),
    )
    .unique();
  if (existing) return { kind: "alreadyMember" };
  const club = await ctx.db.get(clubId);
  if (!club || !club.isActive) throw new Error("Club not found");
  if (club.memberLimit != null) {
    const members = await ctx.db
      .query("clubMembers")
      .withIndex("by_clubId", (q) => q.eq("clubId", clubId))
      .take(club.memberLimit);
    if (members.length >= club.memberLimit) {
      return { kind: "memberLimitReached" };
    }
  }
  const defaultRole = await getDefaultClubRole(ctx, clubId);
  await adjustClubCounts(ctx, clubId, { members: 1 });
  await ctx.db.insert("clubMembers", {
    clubId,
    userId,
    roleId: defaultRole?._id,
    joinedAt: Date.now(),
  });
  return { kind: "added" };
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
      preferredName: v.optional(v.string()),
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
        preferredName: candidate.preferredName,
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
  returns: clubMemberAddResultValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const club = await ctx.db.get(args.clubId);

    if (!club || !club.isActive) {
      throw new Error("Club not found");
    }
    if (club.joinPolicy !== "OPEN") {
      throw new Error("Club is not open to join");
    }

    const result = await addClubMember(ctx, args.clubId, user._id);
    if (result.kind === "added") {
      await logAuditEvent(ctx, {
      actorId: user._id,
        action: "CLUB_JOINED",
        entityType: "Club",
        entityId: args.clubId,
        meta: { userId: user._id },
      });
    }
    return result;
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
    if (club.joinPolicy !== "REQUEST") {
      throw new Error("This club does not accept join requests");
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
          body: `${displayName(user)} requested to join ${club.name}.`,
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
  returns: v.union(
    v.object({ kind: v.literal("approved") }),
    v.object({ kind: v.literal("declined") }),
    v.object({ kind: v.literal("memberLimitReached") }),
  ),
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
      const memberResult = await addClubMember(
        ctx,
        args.clubId,
        request.requesterId,
      );
      if (memberResult.kind === "memberLimitReached") {
        return { kind: "memberLimitReached" as const };
      }
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

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: args.accept
        ? "CLUB_JOIN_REQUEST_APPROVED"
        : "CLUB_JOIN_REQUEST_DECLINED",
      entityType: "ClubJoinRequest",
      entityId: args.requestId,
    });
    return args.accept
      ? { kind: "approved" as const }
      : { kind: "declined" as const };
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
  returns: clubMemberAddResultValidator,
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

    const memberResult = await addClubMember(ctx, args.clubId, recipient._id);
    if (memberResult.kind === "alreadyMember") {
      throw new Error("Student is already a member");
    }
    if (memberResult.kind === "memberLimitReached") {
      return memberResult;
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

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_MEMBER_ADDED_DIRECTLY",
      entityType: "Club",
      entityId: args.clubId,
      meta: { userId: recipient._id },
    });
    return memberResult;
  },
});

/** Verifies the caller once before a bounded direct-membership import. */
export const requireBulkDirectMemberImportActor = internalQuery({
  args: { clubId: v.id("clubs") },
  returns: v.id("users"),
  handler: async (ctx, args): Promise<Id<"users">> => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    if (!context.permissions.inviteMembers) {
      throw new Error("You do not have permission to add members");
    }
    return user._id;
  },
});

/** Adds one active student by unique ID, preserving an existing membership. */
export const addBulkMemberByUniqueId = internalMutation({
  args: {
    clubId: v.id("clubs"),
    uniqueId: v.string(),
  },
  returns: bulkDirectMemberRowResultValidator,
  handler: async (ctx, args) => {
    const uniqueId = args.uniqueId.trim();
    if (!uniqueId) {
      return { kind: "skipped" as const, error: "missing unique ID" };
    }

    const student = await ctx.db
      .query("users")
      .withIndex("by_uniqueId", (q) => q.eq("uniqueId", uniqueId))
      .unique();
    if (!student || !student.isActive || !student.isStudent) {
      return {
        kind: "skipped" as const,
        error: `student ID '${uniqueId}' was not found`,
      };
    }

    const memberResult = await addClubMember(ctx, args.clubId, student._id);
    if (memberResult.kind !== "added") {
      return memberResult;
    }

    const now = Date.now();
    const [pendingInvite, pendingRequest] = await Promise.all([
      ctx.db
        .query("clubInvites")
        .withIndex("by_clubId_and_recipientId", (q) =>
          q.eq("clubId", args.clubId).eq("recipientId", student._id),
        )
        .first(),
      ctx.db
        .query("clubJoinRequests")
        .withIndex("by_clubId_and_requesterId_and_status", (q) =>
          q
            .eq("clubId", args.clubId)
            .eq("requesterId", student._id)
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

    return { kind: "added" as const };
  },
});

/**
 * Adds students immediately from a bounded unique-ID CSV upload. Existing
 * members are deliberately treated as a successful no-op, so files are safe
 * to re-run after an interrupted or partial import.
 */
export const bulkAddMembers = action({
  args: {
    clubId: v.id("clubs"),
    uniqueIds: v.array(v.string()),
  },
  returns: bulkDirectMemberImportResultValidator,
  handler: async (ctx, args) => {
    const actorId: Id<"users"> = await ctx.runQuery(
      internal.clubs.invitations.requireBulkDirectMemberImportActor,
      { clubId: args.clubId },
    );
    if (args.uniqueIds.length === 0) {
      throw new Error("CSV has no recognizable student unique IDs");
    }
    if (args.uniqueIds.length > MAX_BULK_DIRECT_MEMBER_IMPORTS) {
      throw new Error(
        `A direct membership import can process up to ${MAX_BULK_DIRECT_MEMBER_IMPORTS} students at a time`,
      );
    }

    const results = {
      added: 0,
      alreadyMember: 0,
      memberLimitReached: 0,
      skipped: 0,
      errors: [] as string[],
    };
    const seenUniqueIds = new Set<string>();
    const work = args.uniqueIds.map((rawUniqueId, index) => {
      const uniqueId = rawUniqueId.trim();
      const duplicate = uniqueId.length > 0 && seenUniqueIds.has(uniqueId);
      if (uniqueId.length > 0) seenUniqueIds.add(uniqueId);
      return { uniqueId, rowNumber: index + 2, duplicate };
    });

    for (
      let start = 0;
      start < work.length;
      start += BULK_DIRECT_MEMBER_IMPORT_BATCH_SIZE
    ) {
      const batch = work.slice(
        start,
        start + BULK_DIRECT_MEMBER_IMPORT_BATCH_SIZE,
      );
      const batchResults = await Promise.all(
        batch.map(async (entry) => {
          if (entry.duplicate) {
            return {
              kind: "skipped" as const,
              error: `duplicate student ID '${entry.uniqueId}' in this CSV`,
            };
          }
          return ctx.runMutation(
            internal.clubs.invitations.addBulkMemberByUniqueId,
            { clubId: args.clubId, uniqueId: entry.uniqueId },
          );
        }),
      );

      for (const [index, result] of batchResults.entries()) {
        if (result.kind === "added") {
          results.added += 1;
        } else if (result.kind === "alreadyMember") {
          results.alreadyMember += 1;
        } else if (result.kind === "memberLimitReached") {
          results.memberLimitReached += 1;
          results.skipped += 1;
          results.errors.push(
            `Row ${batch[index]!.rowNumber}: club member limit reached`,
          );
        } else {
          results.skipped += 1;
          results.errors.push(
            `Row ${batch[index]!.rowNumber}: ${result.error}`,
          );
        }
      }
    }

    await ctx.runMutation(
      internal.clubs.invitations.logBulkDirectMemberImport,
      {
        actorId,
        clubId: args.clubId,
        added: results.added,
        alreadyMember: results.alreadyMember,
        skipped: results.skipped,
      },
    );
    return results;
  },
});

export const logBulkDirectMemberImport = internalMutation({
  args: {
    actorId: v.id("users"),
    clubId: v.id("clubs"),
    added: v.number(),
    alreadyMember: v.number(),
    skipped: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    await logAuditEvent(ctx, {
      actorId: args.actorId,
      action: "CLUB_MEMBERS_BULK_ADDED_DIRECTLY",
      entityType: "Club",
      entityId: args.clubId,
      meta: {
        added: args.added,
        alreadyMember: args.alreadyMember,
        skipped: args.skipped,
      },
    });
    return null;
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

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_INVITES_BULK_IMPORTED",
      entityType: "Club",
      entityId: args.clubId,
      meta: { invited: results.invited, skipped: results.skipped },
    });

    return results;
  },
});

export const respondToInvite = mutation({
  args: { inviteId: v.id("clubInvites"), accept: v.boolean() },
  returns: inviteResponseResultValidator,
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

    const memberResult = args.accept
      ? await addClubMember(ctx, invite.clubId, user._id)
      : { kind: "declined" as const };
    if (memberResult.kind === "memberLimitReached") {
      return memberResult;
    }
    await ctx.db.patch(args.inviteId, {
      status: args.accept ? "ACCEPTED" : "DECLINED",
      updatedAt: Date.now(),
    });
    return memberResult;
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
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_JOIN_CODE_GENERATED",
      entityType: "Club",
      entityId: args.clubId,
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
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_JOIN_CODE_REVOKED",
      entityType: "Club",
      entityId: args.clubId,
    });
    return null;
  },
});

export const redeemJoinCode = mutation({
  args: { clubId: v.id("clubs"), code: v.string() },
  returns: clubMemberAddResultValidator,
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
    const memberResult = await addClubMember(ctx, args.clubId, user._id);
    if (memberResult.kind === "added")
      await logAuditEvent(ctx, {
        actorId: user._id,
        action: "CLUB_JOIN_CODE_REDEEMED",
        entityType: "Club",
        entityId: args.clubId,
      });
    return memberResult;
  },
});
