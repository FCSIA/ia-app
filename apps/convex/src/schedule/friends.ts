import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import {
  getFriendshipBetween,
  getScheduleFriendshipStatus,
  getStudentTarget,
  deliverNotification,
  isStudentUser,
  requireStudentUser,
  serializeScheduleForUser,
  serializeUser,
  studentVisibility,
  scheduleSearchResultValidator,
  type ScheduleSearchResult,
} from "./_lib";
import { logAuditEvent } from "../audit/_lib";

const profileFriendValidator = v.object({
  _id: v.id("users"),
  firstName: v.string(),
  lastName: v.string(),
  avatarUrl: v.union(v.string(), v.null()),
});

const profileClassValidator = v.object({
  className: v.string(),
  periodNumber: v.number(),
});

const profileContextValidator = v.union(
  v.object({
    friendshipStatus: v.union(
      v.literal("NONE"),
      v.literal("REQUEST_SENT"),
      v.literal("REQUEST_RECEIVED"),
      v.literal("FRIENDS"),
    ),
    mutualFriendCount: v.number(),
    mutualFriends: v.array(profileFriendValidator),
    scheduleVisibility: v.union(
      v.literal("FRIENDS_ONLY"),
      v.literal("NONE"),
      v.literal("PRIVATE"),
      v.literal("SHARED"),
    ),
    classes: v.array(profileClassValidator),
  }),
  v.null(),
);

const scheduleFriendshipStateValidator = v.object({
  userId: v.id("users"),
  status: v.union(
    v.literal("NONE"),
    v.literal("REQUEST_SENT"),
    v.literal("REQUEST_RECEIVED"),
    v.literal("FRIENDS"),
  ),
});

const MAX_FRIENDSHIP_STATE_TARGETS = 100;
const MAX_PROFILE_FRIENDSHIPS = 100;
const MAX_PROFILE_MUTUAL_FRIENDS = 4;
const MAX_PROFILE_CLASSES = 8;

type ProfileClassEntry = {
  className: string;
  periodNumber: number;
};

export function summarizeProfileClasses(entries: ProfileClassEntry[]) {
  const classes = new Map<string, ProfileClassEntry>();
  for (const entry of entries) {
    const className = entry.className.trim().replace(/\s+/g, " ");
    if (!className) continue;
    const key = `${entry.periodNumber}:${className.toLocaleLowerCase()}`;
    if (!classes.has(key))
      classes.set(key, { className, periodNumber: entry.periodNumber });
  }
  return [...classes.values()]
    .sort(
      (left, right) =>
        left.periodNumber - right.periodNumber ||
        left.className.localeCompare(right.className),
    )
    .slice(0, MAX_PROFILE_CLASSES);
}

async function acceptedFriendIds(
  ctx: Parameters<typeof getFriendshipBetween>[0],
  userId: Parameters<typeof getFriendshipBetween>[1],
) {
  const [outgoing, incoming] = await Promise.all([
    ctx.db
      .query("studentScheduleFriends")
      .withIndex("by_requesterId_and_status_and_acceptedAt", (q) =>
        q.eq("requesterId", userId).eq("status", "ACCEPTED"),
      )
      .take(MAX_PROFILE_FRIENDSHIPS),
    ctx.db
      .query("studentScheduleFriends")
      .withIndex("by_addresseeId_and_status_and_acceptedAt", (q) =>
        q.eq("addresseeId", userId).eq("status", "ACCEPTED"),
      )
      .take(MAX_PROFILE_FRIENDSHIPS),
  ]);
  return new Set([
    ...outgoing.map((friendship) => friendship.addresseeId),
    ...incoming.map((friendship) => friendship.requesterId),
  ]);
}

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
      const friendshipStatus = getScheduleFriendshipStatus(friendship, user._id);

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

/** Bounded relationship state for people already visible in another surface, such as chat. */
export const getStatuses = query({
  args: { userIds: v.array(v.id("users")) },
  returns: v.array(scheduleFriendshipStateValidator),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user || !isStudentUser(user)) return [];

    const userIds = [...new Set(args.userIds)]
      .filter((userId) => userId !== user._id)
      .slice(0, MAX_FRIENDSHIP_STATE_TARGETS);

    return await Promise.all(
      userIds.map(async (userId) => ({
        userId,
        status: getScheduleFriendshipStatus(
          await getFriendshipBetween(ctx, user._id, userId),
          user._id,
        ),
      })),
    );
  },
});

/** Relationship-aware profile details for people already visible in club chat. */
export const getProfileContext = query({
  args: { personId: v.id("users") },
  returns: profileContextValidator,
  handler: async (ctx, args) => {
    const viewer = await getCurrentAppUser(ctx);
    if (args.personId === viewer._id) return null;

    const person = await ctx.db.get(args.personId);
    if (!person?.isActive || !isStudentUser(person) || !isStudentUser(viewer))
      return null;

    const friendship = await getFriendshipBetween(ctx, viewer._id, person._id);
    const friendshipStatus = getScheduleFriendshipStatus(
      friendship,
      viewer._id,
    );
    const [viewerFriendIds, personFriendIds] = await Promise.all([
      acceptedFriendIds(ctx, viewer._id),
      acceptedFriendIds(ctx, person._id),
    ]);
    const mutualFriendIds = [...personFriendIds]
      .filter((friendId) => viewerFriendIds.has(friendId))
      .slice(0, MAX_PROFILE_FRIENDSHIPS);
    const mutualFriendUsers = (
      await Promise.all(mutualFriendIds.map((friendId) => ctx.db.get(friendId)))
    )
      .filter((friend): friend is NonNullable<typeof friend> =>
        Boolean(friend?.isActive),
      )
      .sort(
        (left, right) =>
          left.lastName.localeCompare(right.lastName) ||
          left.firstName.localeCompare(right.firstName),
      );

    let scheduleVisibility = "FRIENDS_ONLY" as
      "FRIENDS_ONLY" | "NONE" | "PRIVATE" | "SHARED";
    let classes: ReturnType<typeof summarizeProfileClasses> = [];
    if (friendshipStatus === "FRIENDS") {
      const schedule = await ctx.db
        .query("studentSchedules")
        .withIndex("by_userId", (q) => q.eq("userId", person._id))
        .unique();
      if (!schedule) {
        scheduleVisibility = "NONE";
      } else if (!schedule.isPublic) {
        scheduleVisibility = "PRIVATE";
      } else {
        scheduleVisibility = "SHARED";
        const entries = await ctx.db
          .query("studentScheduleEntries")
          .withIndex("by_scheduleId_and_weekday_and_periodNumber", (q) =>
            q.eq("scheduleId", schedule._id),
          )
          .take(60);
        classes = summarizeProfileClasses(entries);
      }
    }

    return {
      friendshipStatus,
      mutualFriendCount: mutualFriendUsers.length,
      mutualFriends: mutualFriendUsers
        .slice(0, MAX_PROFILE_MUTUAL_FRIENDS)
        .map((friend) => ({
          _id: friend._id,
          firstName: friend.firstName,
          lastName: friend.lastName,
          avatarUrl: friend.avatarUrl ?? null,
        })),
      scheduleVisibility,
      classes,
    };
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
