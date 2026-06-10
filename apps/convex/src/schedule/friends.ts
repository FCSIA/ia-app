import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import {
  getFriendshipBetween,
  getStudentTarget,
  deliverNotification,
  isStudentUser,
  requireStudentUser,
  serializeScheduleForUser,
  serializeUser,
  studentVisibility,
  scheduleSearchResultValidator,
  type ScheduleSearchResult,
  type ScheduleSearchFriendshipStatus,
} from "./_lib";
import { logAuditEvent } from "../audit/_lib";

export const search = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(scheduleSearchResultValidator),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user || !isStudentUser(user)) return [];
    const search = args.query.trim().toLowerCase();
    if (search.length < 2) return [];
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);

    const candidates = await ctx.db
      .query("users")
      .withSearchIndex("search_users", (q) =>
        q.search("searchText", search).eq("isStudent", true),
      )
      .take(limit + 10);

    const results: ScheduleSearchResult[] = [];
    for (const candidate of candidates) {
      if (candidate._id === user._id || !candidate.isActive) continue;
      const friendship = await getFriendshipBetween(ctx, user._id, candidate._id);
      const schedule = await serializeScheduleForUser(ctx, candidate._id);
      const friendshipStatus: ScheduleSearchFriendshipStatus =
        friendship?.status === "ACCEPTED"
          ? "FRIENDS"
          : friendship?.status === "PENDING" && friendship.requesterId === user._id
            ? "REQUEST_SENT"
            : friendship?.status === "PENDING" && friendship.addresseeId === user._id
              ? "REQUEST_RECEIVED"
              : "NONE";

      results.push({
        ...serializeUser(candidate),
        friendshipStatus,
        visibility: studentVisibility(schedule),
      });
      if (results.length >= limit) break;
    }
    return results;
  },
});

export const sendRequest = mutation({
  args: { friendId: v.id("users") },
  returns: v.object({
    success: v.boolean(),
    status: v.union(v.literal("PENDING"), v.literal("ACCEPTED")),
    id: v.id("studentScheduleFriends"),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    if (args.friendId === user._id) throw new ConvexError("You cannot friend yourself.");
    const target = await getStudentTarget(ctx, args.friendId);

    const existing = await getFriendshipBetween(ctx, user._id, args.friendId);
    if (existing) {
      if (existing.status === "ACCEPTED") throw new ConvexError("Already friends.");
      if (existing.addresseeId === user._id) {
        await ctx.db.patch(existing._id, {
          status: "ACCEPTED",
          acceptedAt: Date.now(),
        });
        await logAuditEvent(ctx, {
          actorId: user._id,
          action: "schedule.friend_accepted",
          entityType: "user",
          entityId: target._id,
        });
        await deliverNotification(ctx, {
          userId: target._id,
          friendshipId: existing._id,
          title: "Friend request accepted",
          body: `${user.firstName} ${user.lastName} accepted your friend request.`,
        });
        return { success: true, status: "ACCEPTED" as const, id: existing._id };
      }
      throw new ConvexError("Friend request already sent.");
    }

    const id = await ctx.db.insert("studentScheduleFriends", {
      requesterId: user._id,
      addresseeId: args.friendId,
      status: "PENDING",
      createdAt: Date.now(),
    });
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "schedule.friend_requested",
      entityType: "user",
      entityId: target._id,
    });
    await deliverNotification(ctx, {
      userId: target._id,
      friendshipId: id,
      title: "New friend request",
      body: `${user.firstName} ${user.lastName} wants to be your friend.`,
    });
    return { success: true, status: "PENDING" as const, id };
  },
});

export const acceptRequest = mutation({
  args: { requesterId: v.id("users") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    const request = await ctx.db
      .query("studentScheduleFriends")
      .withIndex("by_requesterId_and_addresseeId", (q) =>
        q.eq("requesterId", args.requesterId).eq("addresseeId", user._id),
      )
      .unique();
    if (!request || request.status !== "PENDING") {
      throw new ConvexError("Friend request not found.");
    }

    await ctx.db.patch(request._id, {
      status: "ACCEPTED",
      acceptedAt: Date.now(),
    });
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "schedule.friend_accepted",
      entityType: "user",
      entityId: args.requesterId,
    });
    await deliverNotification(ctx, {
      userId: args.requesterId,
      friendshipId: request._id,
      title: "Friend request accepted",
      body: `${user.firstName} ${user.lastName} accepted your friend request.`,
    });
    return { success: true };
  },
});

export const remove = mutation({
  args: { otherUserId: v.id("users") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    const friendship = await getFriendshipBetween(ctx, user._id, args.otherUserId);
    if (!friendship) throw new ConvexError("Friendship not found.");
    await ctx.db.delete(friendship._id);
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "schedule.friend_removed",
      entityType: "user",
      entityId: args.otherUserId,
    });
    return { success: true };
  },
});
