import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser } from "../../lib/currentUser";
import { logAuditEvent } from "../audit/_lib";
import { friendShareLinkModeValidator } from "../validators";
import { friendLinkRateLimiter } from "../rateLimits";
import {
  deliverNotification,
  getFriendshipBetween,
  getStudentTarget,
  isStudentUser,
  requireStudentUser,
  serializeUser,
} from "./_lib";
import {
  decideFriendLinkRedemption,
  digestFriendToken,
  generateOpaqueFriendToken,
  isValidOpaqueFriendToken,
} from "./shareLinkSecurity";

const linkSummaryValidator = v.object({
  id: v.id("studentFriendShareLinks"),
  mode: friendShareLinkModeValidator,
  expiresAt: v.string(),
  revokedAt: v.union(v.string(), v.null()),
  useCount: v.number(),
  lastUsedAt: v.union(v.string(), v.null()),
  createdAt: v.string(),
  tokenHint: v.string(),
});

const ownerValidator = v.object({
  _id: v.id("users"),
  uniqueId: v.string(),
  firstName: v.string(),
  lastName: v.string(),
});

function toLinkSummary(link: Doc<"studentFriendShareLinks">) {
  return {
    id: link._id,
    mode: link.mode,
    expiresAt: new Date(link.expiresAt).toISOString(),
    revokedAt: link.revokedAt ? new Date(link.revokedAt).toISOString() : null,
    useCount: link.useCount,
    lastUsedAt: link.lastUsedAt ? new Date(link.lastUsedAt).toISOString() : null,
    createdAt: new Date(link.createdAt).toISOString(),
    tokenHint: link.tokenHint,
  };
}

export const listMine = query({
  args: {},
  returns: v.array(linkSummaryValidator),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    const links = await ctx.db
      .query("studentFriendShareLinks")
      .withIndex("by_ownerId_and_createdAt", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(30);
    return links.map(toLinkSummary);
  },
});

export const create = mutation({
  args: { mode: friendShareLinkModeValidator },
  returns: v.object({
    link: linkSummaryValidator,
    token: v.string(),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    const recentLinks = await ctx.db
      .query("studentFriendShareLinks")
      .withIndex("by_ownerId_and_createdAt", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .take(31);
    const now = Date.now();
    if (recentLinks.filter((link) => !link.revokedAt && link.expiresAt > now).length >= 20) {
      throw new ConvexError("Revoke an active link before creating another one.");
    }

    let token = "";
    let tokenDigest = "";
    for (let attempt = 0; attempt < 3; attempt += 1) {
      token = generateOpaqueFriendToken();
      tokenDigest = await digestFriendToken(token);
      const collision = await ctx.db
        .query("studentFriendShareLinks")
        .withIndex("by_tokenDigest", (q) => q.eq("tokenDigest", tokenDigest))
        .unique();
      if (!collision) break;
      token = "";
    }
    if (!token) throw new ConvexError("Could not create a secure link. Try again.");

    const expiresAt = now + 7 * 24 * 60 * 60 * 1000;
    const id = await ctx.db.insert("studentFriendShareLinks", {
      ownerId: user._id,
      tokenDigest,
      tokenHint: token.slice(-6),
      mode: args.mode,
      expiresAt,
      useCount: 0,
      createdAt: now,
    });
    const link = await ctx.db.get(id);
    if (!link) throw new ConvexError("Friend link was not created.");
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "schedule.friend_link_created",
      entityType: "studentFriendShareLink",
      entityId: id,
      meta: { mode: args.mode },
    });
    return { link: toLinkSummary(link), token };
  },
});

export const revoke = mutation({
  args: { linkId: v.id("studentFriendShareLinks") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    const link = await ctx.db.get(args.linkId);
    if (!link || link.ownerId !== user._id) throw new ConvexError("Friend link not found.");
    if (!link.revokedAt) {
      await ctx.db.patch(link._id, { revokedAt: Date.now() });
      await logAuditEvent(ctx, {
        actorId: user._id,
        action: "schedule.friend_link_revoked",
        entityType: "studentFriendShareLink",
        entityId: link._id,
      });
    }
    return { success: true };
  },
});

export const preview = query({
  args: { token: v.string() },
  returns: v.object({
    state: v.union(v.literal("ACTIVE"), v.literal("INVALID"), v.literal("SELF")),
    mode: v.union(friendShareLinkModeValidator, v.null()),
    owner: v.union(ownerValidator, v.null()),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    if (!isValidOpaqueFriendToken(args.token)) {
      return { state: "INVALID" as const, mode: null, owner: null };
    }
    const tokenDigest = await digestFriendToken(args.token);
    const link = await ctx.db
      .query("studentFriendShareLinks")
      .withIndex("by_tokenDigest", (q) => q.eq("tokenDigest", tokenDigest))
      .unique();
    if (!link || link.revokedAt || link.expiresAt <= Date.now()) {
      return { state: "INVALID" as const, mode: null, owner: null };
    }
    if (link.ownerId === user._id) {
      return { state: "SELF" as const, mode: link.mode, owner: serializeUser(user) };
    }
    const owner = await ctx.db.get(link.ownerId);
    if (!owner || !owner.isActive || !isStudentUser(owner)) {
      return { state: "INVALID" as const, mode: null, owner: null };
    }
    return { state: "ACTIVE" as const, mode: link.mode, owner: serializeUser(owner) };
  },
});

export const redeem = mutation({
  args: { token: v.string() },
  returns: v.object({
    status: v.union(
      v.literal("REQUEST_SENT"),
      v.literal("PENDING"),
      v.literal("FRIENDS"),
      v.literal("ALREADY_FRIENDS"),
    ),
    friendshipId: v.id("studentScheduleFriends"),
    owner: ownerValidator,
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    const rateLimit = await friendLinkRateLimiter.limit(ctx, "redemptionsByUser", {
      key: user._id,
    });
    if (!rateLimit.ok) {
      throw new ConvexError("Too many link attempts. Wait a minute and try again.");
    }
    if (!isValidOpaqueFriendToken(args.token)) throw new ConvexError("Friend link is invalid.");
    const tokenDigest = await digestFriendToken(args.token);
    const link = await ctx.db
      .query("studentFriendShareLinks")
      .withIndex("by_tokenDigest", (q) => q.eq("tokenDigest", tokenDigest))
      .unique();
    if (!link || link.revokedAt || link.expiresAt <= Date.now()) {
      throw new ConvexError("Friend link is no longer active.");
    }
    if (link.useCount >= 250) throw new ConvexError("Friend link has reached its use limit.");
    if (link.ownerId === user._id) throw new ConvexError("You cannot use your own friend link.");
    const owner = await getStudentTarget(ctx, link.ownerId);
    const existing = await getFriendshipBetween(ctx, user._id, owner._id);
    const action = decideFriendLinkRedemption({
      mode: link.mode,
      ownerId: owner._id,
      redeemerId: user._id,
      existing,
    });
    const now = Date.now();

    if (action === "ALREADY_FRIENDS" || action === "KEEP_PENDING") {
      if (!existing) throw new ConvexError("Friendship state changed. Try again.");
      return {
        status:
          action === "ALREADY_FRIENDS"
            ? ("ALREADY_FRIENDS" as const)
            : existing.requesterId === user._id
              ? ("REQUEST_SENT" as const)
              : ("PENDING" as const),
        friendshipId: existing._id,
        owner: serializeUser(owner),
      };
    }

    let friendshipId = existing?._id;
    if (action === "ACCEPT_PENDING" && existing) {
      await ctx.db.patch(existing._id, { status: "ACCEPTED", acceptedAt: now });
    } else {
      friendshipId = await ctx.db.insert("studentScheduleFriends", {
        requesterId: user._id,
        addresseeId: owner._id,
        status: action === "CREATE_ACCEPTED" ? "ACCEPTED" : "PENDING",
        createdAt: now,
        acceptedAt: action === "CREATE_ACCEPTED" ? now : undefined,
      });
    }
    if (!friendshipId) throw new ConvexError("Friendship was not created.");

    await ctx.db.patch(link._id, {
      useCount: link.useCount + 1,
      lastUsedAt: now,
    });
    const accepted = action === "ACCEPT_PENDING" || action === "CREATE_ACCEPTED";
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: accepted ? "schedule.friend_link_auto_accepted" : "schedule.friend_link_requested",
      entityType: "studentFriendShareLink",
      entityId: link._id,
      meta: { ownerId: owner._id },
    });
    await deliverNotification(ctx, {
      userId: owner._id,
      friendshipId,
      title: accepted ? "Friend added from your link" : "New friend request",
      body: accepted
        ? `${user.firstName} ${user.lastName} used your auto-accept friend link.`
        : `${user.firstName} ${user.lastName} used your link to send a friend request.`,
    });
    return {
      status: accepted ? ("FRIENDS" as const) : ("REQUEST_SENT" as const),
      friendshipId,
      owner: serializeUser(owner),
    };
  },
});
