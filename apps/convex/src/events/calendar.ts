import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import {
  getCurrentAppUser,
  getMaybeCurrentAppUser,
} from "../../lib/currentUser";
import { calendarSourceValidator } from "../validators";
import { calendarEntryValidator } from "./_lib";
import {
  getFriendshipBetween,
  isStudentUser,
  requireStudentUser,
  serializeUser,
} from "../schedule/_lib";
import {
  canRespondToCalendarInvite,
  canShareCalendarEntryWithFriend,
} from "./calendarInvitePolicy";
import {
  normalizeEventTitle,
  normalizeOptionalEventDescription,
} from "./contentValidation";

const MAX_CALENDAR_RANGE_MS = 92 * 24 * 60 * 60 * 1000;
const MAX_CALENDAR_INVITE_RECIPIENTS = 20;
const calendarEntryOutputValidator = v.object({
  _id: v.id("calendarEntries"),
  _creationTime: v.number(),
  ...calendarEntryValidator,
  createdAt: v.number(),
  inviteId: v.optional(v.id("calendarInvites")),
  sharedBy: v.optional(
    v.object({
      _id: v.id("users"),
      uniqueId: v.string(),
      firstName: v.string(),
      lastName: v.string(),
    }),
  ),
});
const calendarInviteOutputValidator = v.object({
  _id: v.id("calendarInvites"),
  _creationTime: v.number(),
  status: v.union(v.literal("PENDING"), v.literal("ACCEPTED"), v.literal("DECLINED")),
  createdAt: v.number(),
  entry: calendarEntryOutputValidator,
  sender: v.object({
    _id: v.id("users"),
    uniqueId: v.string(),
    firstName: v.string(),
    lastName: v.string(),
  }),
});

async function acceptedFriendIds(ctx: Parameters<typeof getFriendshipBetween>[0], userId: Parameters<typeof getFriendshipBetween>[1]) {
  const [outgoing, incoming] = await Promise.all([
    ctx.db
      .query("studentScheduleFriends")
      .withIndex("by_requesterId_and_status_and_acceptedAt", (q) =>
        q.eq("requesterId", userId).eq("status", "ACCEPTED"),
      )
      .take(100),
    ctx.db
      .query("studentScheduleFriends")
      .withIndex("by_addresseeId_and_status_and_acceptedAt", (q) =>
        q.eq("addresseeId", userId).eq("status", "ACCEPTED"),
      )
      .take(100),
  ]);
  return Array.from(
    new Set([
      ...outgoing.map((friendship) => friendship.addresseeId),
      ...incoming.map((friendship) => friendship.requesterId),
    ]),
  );
}

export const list = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    sources: v.optional(v.array(v.string())),
  },
  returns: v.array(calendarEntryOutputValidator),
  handler: async (ctx, args) => {
    if (args.endDate < args.startDate) {
      throw new Error("Calendar end date must be after start date");
    }
    if (args.endDate - args.startDate > MAX_CALENDAR_RANGE_MS) {
      throw new Error("Calendar range cannot exceed 92 days");
    }

    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];

    const entries = await ctx.db
      .query("calendarEntries")
      .withIndex("by_startAt", (q) =>
        q.gte("startAt", args.startDate).lte("startAt", args.endDate),
      )
      .collect();

    const requested =
      args.sources && args.sources.length > 0
        ? args.sources
        : ["DISTRICT", "SCHOOL", "CLUB", "PERSONAL", "FLEX_FRIDAY"];

    const allowed = new Set(requested);
    const includePersonal = allowed.has("PERSONAL");

    const visibleEntries = entries.filter((entry) => {
      if (!allowed.has(entry.source)) return false;
      if (entry.source === "PERSONAL") {
        return includePersonal && user && entry.createdById === user._id;
      }
      return true;
    });

    if (!includePersonal) return visibleEntries;

    const acceptedInvites = await ctx.db
      .query("calendarInvites")
      .withIndex("by_recipientId_and_status_and_createdAt", (q) =>
        q.eq("recipientId", user._id).eq("status", "ACCEPTED"),
      )
      .take(100);
    const sharedEntries = [];
    for (const invite of acceptedInvites) {
      const [entry, sender, friendship] = await Promise.all([
        ctx.db.get(invite.calendarEntryId),
        ctx.db.get(invite.senderId),
        getFriendshipBetween(ctx, invite.senderId, user._id),
      ]);
      if (!entry || entry.source !== "PERSONAL" || !sender || friendship?.status !== "ACCEPTED") continue;
      if (entry.startAt < args.startDate || entry.startAt > args.endDate) continue;
      sharedEntries.push({ ...entry, inviteId: invite._id, sharedBy: serializeUser(sender) });
    }

    return [...visibleEntries, ...sharedEntries];
  },
});

export const listEligibleFriends = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("users"),
      uniqueId: v.string(),
      firstName: v.string(),
      lastName: v.string(),
    }),
  ),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    const friendIds = await acceptedFriendIds(ctx, user._id);
    const friends = [];
    for (const friendId of friendIds) {
      const friend = await ctx.db.get(friendId);
      if (friend?.isActive && isStudentUser(friend)) friends.push(serializeUser(friend));
    }
    return friends.sort(
      (left, right) =>
        left.lastName.localeCompare(right.lastName) ||
        left.firstName.localeCompare(right.firstName),
    );
  },
});

export const listPendingInvites = query({
  args: {},
  returns: v.array(calendarInviteOutputValidator),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    const invites = await ctx.db
      .query("calendarInvites")
      .withIndex("by_recipientId_and_status_and_createdAt", (q) =>
        q.eq("recipientId", user._id).eq("status", "PENDING"),
      )
      .take(100);
    const results = [];
    for (const invite of invites) {
      const [entry, sender, friendship] = await Promise.all([
        ctx.db.get(invite.calendarEntryId),
        ctx.db.get(invite.senderId),
        getFriendshipBetween(ctx, invite.senderId, user._id),
      ]);
      if (!entry || entry.source !== "PERSONAL" || !sender || friendship?.status !== "ACCEPTED") continue;
      results.push({ ...invite, entry, sender: serializeUser(sender) });
    }
    return results;
  },
});

export const inviteFriends = mutation({
  args: {
    entryId: v.id("calendarEntries"),
    friendIds: v.array(v.id("users")),
  },
  returns: v.object({ invited: v.number() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    const entry = await ctx.db.get(args.entryId);
    if (!entry || entry.source !== "PERSONAL" || entry.createdById !== user._id) {
      throw new ConvexError("You can only share your own personal reminders.");
    }

    const friendIds = Array.from(new Set(args.friendIds));
    if (friendIds.length === 0) throw new ConvexError("Choose at least one friend.");
    if (friendIds.length > MAX_CALENDAR_INVITE_RECIPIENTS) {
      throw new ConvexError(`You can invite at most ${MAX_CALENDAR_INVITE_RECIPIENTS} friends at once.`);
    }

    for (const friendId of friendIds) {
      const [friend, friendship] = await Promise.all([
        ctx.db.get(friendId),
        getFriendshipBetween(ctx, user._id, friendId),
      ]);
      if (!friend || !canShareCalendarEntryWithFriend({
        senderId: user._id,
        recipientId: friendId,
        recipientIsActive: friend.isActive,
        recipientIsStudent: isStudentUser(friend),
        friendshipStatus: friendship?.status === "ACCEPTED" ? "ACCEPTED" : friendship ? "PENDING" : null,
      })) {
        throw new ConvexError("Calendar reminders can only be shared with accepted friends.");
      }
    }

    const now = Date.now();
    for (const friendId of friendIds) {
      const existing = await ctx.db
        .query("calendarInvites")
        .withIndex("by_calendarEntryId_and_recipientId", (q) =>
          q.eq("calendarEntryId", entry._id).eq("recipientId", friendId),
        )
        .unique();
      if (existing) {
        await ctx.db.patch(existing._id, {
          senderId: user._id,
          status: "PENDING",
          createdAt: now,
          respondedAt: undefined,
        });
      } else {
        await ctx.db.insert("calendarInvites", {
          calendarEntryId: entry._id,
          senderId: user._id,
          recipientId: friendId,
          status: "PENDING",
          createdAt: now,
        });
      }
    }
    return { invited: friendIds.length };
  },
});

export const respondToInvite = mutation({
  args: { inviteId: v.id("calendarInvites"), accept: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const invite = await ctx.db.get(args.inviteId);
    if (!invite) {
      throw new ConvexError("Calendar invitation not found.");
    }
    const [entry, friendship] = await Promise.all([
      ctx.db.get(invite.calendarEntryId),
      getFriendshipBetween(ctx, invite.senderId, user._id),
    ]);
    if (!canRespondToCalendarInvite({
      isRecipient: invite.recipientId === user._id,
      inviteStatus: invite.status,
      entryIsPersonal: entry?.source === "PERSONAL",
      entryOwnedBySender: entry?.createdById === invite.senderId,
      friendshipStatus: friendship?.status === "ACCEPTED" ? "ACCEPTED" : friendship ? "PENDING" : null,
    })) {
      throw new ConvexError("This calendar invitation is no longer available.");
    }
    await ctx.db.patch(invite._id, {
      status: args.accept ? "ACCEPTED" : "DECLINED",
      respondedAt: Date.now(),
    });
    return null;
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    startAt: v.number(),
    endAt: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    source: v.optional(calendarSourceValidator),
  },
  returns: v.id("calendarEntries"),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (args.source && args.source !== "PERSONAL") {
      throw new ConvexError("Shared calendar entries must be created by their owning feature");
    }

    const title = normalizeEventTitle(args.title);
    const description = normalizeOptionalEventDescription(args.description);
    if (args.endAt !== undefined && args.endAt < args.startAt) {
      throw new ConvexError("End time must be after start time");
    }

    const entryId = await ctx.db.insert("calendarEntries", {
      title,
      description,
      location: args.location?.trim(),
      startAt: args.startAt,
      endAt: args.endAt,
      tags: args.tags ?? ["personal"],
      source: "PERSONAL",
      createdById: user._id,
      createdAt: Date.now(),
    });

    return entryId;
  },
});

export const remove = mutation({
  args: { entryId: v.id("calendarEntries") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const entry = await ctx.db.get(args.entryId);
    if (!entry) throw new Error("Calendar entry not found");

    if (entry.source !== "PERSONAL" || entry.createdById !== user._id) {
      throw new Error("You can only delete your own personal entries");
    }

    const invites = await ctx.db
      .query("calendarInvites")
      .withIndex("by_calendarEntryId", (q) => q.eq("calendarEntryId", args.entryId))
      .take(MAX_CALENDAR_INVITE_RECIPIENTS + 1);
    for (const invite of invites) await ctx.db.delete(invite._id);
    await ctx.db.delete(args.entryId);
    return null;
  },
});

export const update = mutation({
  args: {
    entryId: v.id("calendarEntries"),
    title: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    startAt: v.number(),
    endAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const entry = await ctx.db.get(args.entryId);
    if (!entry) throw new Error("Calendar entry not found");

    if (entry.source !== "PERSONAL" || entry.createdById !== user._id) {
      throw new Error("You can only edit your own personal entries");
    }

    const title = normalizeEventTitle(args.title);
    const description = normalizeOptionalEventDescription(args.description);
    if (args.endAt !== undefined && args.endAt < args.startAt) {
      throw new ConvexError("End time must be after start time");
    }

    await ctx.db.patch(args.entryId, {
      title,
      description,
      location: args.location?.trim(),
      startAt: args.startAt,
      endAt: args.endAt,
    });
    return null;
  },
});
