import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import {
  getCurrentAppUser,
  getMaybeCurrentAppUser,
} from "../../lib/currentUser";
import { createDocLoader } from "../../lib/docLoader";
import { schoolDaySpan, schoolTimestamp } from "../../lib/schoolTime";
import { calendarSourceValidator } from "../validators";
import { schema } from "../schema";
import {
  getFriendshipBetween,
  isStudentUser,
  requireStudentUser,
  serializeUser,
  scheduleFriendUserValidator,
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
const calendarEntryOutputValidator = schema.doc("calendarEntries").extend({
  inviteId: v.optional(v.id("calendarInvites")),
  sharedBy: v.optional(scheduleFriendUserValidator),
});
const externalCalendarEntryOutputValidator = v.object({
  _id: v.id("externalCalendarEvents"),
  _creationTime: v.number(),
  title: v.string(),
  description: v.optional(v.string()),
  location: v.optional(v.string()),
  startAt: v.number(),
  endAt: v.optional(v.number()),
  tags: v.array(v.string()),
  source: v.literal("EXTERNAL"),
  subscriptionId: v.id("externalCalendarSubscriptions"),
  readOnly: v.literal(true),
  allDay: v.optional(v.boolean()),
  url: v.optional(v.string()),
});
const calendarListEntryValidator = v.union(
  calendarEntryOutputValidator,
  externalCalendarEntryOutputValidator,
);

export function serializeExternalCalendarEntry(entry: Doc<"externalCalendarEvents">) {
  return {
    _id: entry._id,
    _creationTime: entry._creationTime,
    title: entry.title,
    description: entry.description,
    location: entry.location,
    startAt: entry.startAt,
    endAt: entry.endAt,
    tags: entry.tags,
    source: "EXTERNAL" as const,
    subscriptionId: entry.subscriptionId,
    readOnly: true as const,
    allDay: entry.allDay,
    url: entry.url,
  };
}

const calendarInviteOutputValidator = v.object({
  _id: v.id("calendarInvites"),
  _creationTime: v.number(),
  status: v.union(
    v.literal("PENDING"),
    v.literal("ACCEPTED"),
    v.literal("DECLINED"),
  ),
  createdAt: v.number(),
  entry: calendarEntryOutputValidator,
  sender: scheduleFriendUserValidator,
});

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
  returns: v.array(calendarListEntryValidator),
  handler: async (ctx, args) => {
    if (!Number.isFinite(args.startDate) || !Number.isFinite(args.endDate)) {
      throw new ConvexError("Choose a valid calendar range.");
    }
    if (args.endDate < args.startDate) {
      throw new Error("Calendar end date must be after start date");
    }
    if (args.endDate - args.startDate > MAX_CALENDAR_RANGE_MS) {
      throw new Error("Calendar range cannot exceed 92 days");
    }

    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];
    if (args.sources?.length === 0) return [];

    const requested = args.sources?.length
      ? args.sources
      : ["DISTRICT", "SCHOOL", "CLUB", "PERSONAL", "FLEX_FRIDAY", "EXTERNAL"];
    const allowed = new Set(requested);
    const includePersonal = allowed.has("PERSONAL");
    const limit = 1_000;
    const assertBounded = <T>(rows: T[]) => {
      if (rows.length > limit) {
        throw new ConvexError("This calendar range contains too many entries. Choose a shorter range or fewer sources.");
      }
      return rows;
    };
    const sourceEntries = await Promise.all(
      (["DISTRICT", "SCHOOL", "CLUB", "PERSONAL", "FLEX_FRIDAY"] as const)
        .filter((source) => allowed.has(source) || (source === "SCHOOL" && allowed.has("FLEX_FRIDAY")))
        .map(async (source) => {
          const [starting, spanning] = await Promise.all(source === "PERSONAL" ? [
            ctx.db.query("calendarEntries").withIndex("by_createdById_and_source_and_startAt", (q) =>
              q.eq("createdById", user._id).eq("source", source).gte("startAt", args.startDate).lte("startAt", args.endDate),
            ).take(limit + 1),
            ctx.db.query("calendarEntries").withIndex("by_createdById_and_source_and_endAt", (q) =>
              q.eq("createdById", user._id).eq("source", source).gt("endAt", args.startDate),
            ).take(limit + 1),
          ] : [
            ctx.db.query("calendarEntries").withIndex("by_source_and_startAt", (q) =>
              q.eq("source", source).gte("startAt", args.startDate).lte("startAt", args.endDate),
            ).take(limit + 1),
            ctx.db.query("calendarEntries").withIndex("by_source_and_endAt", (q) =>
              q.eq("source", source).gt("endAt", args.startDate),
            ).take(limit + 1),
          ]);
          return [...assertBounded(starting), ...assertBounded(spanning).filter((entry) => entry.startAt < args.startDate)];
        }),
    );
    const visibleEntries = sourceEntries.flat().map((entry) => entry.flexFridayId ? {
      ...entry,
      source: "FLEX_FRIDAY" as const,
      // Historical Flex rows were zero-length SCHOOL entries. Project their
      // school day without requiring a live migration to render them correctly.
      ...(entry.allDay ? {} : schoolDaySpan(entry.startAt)),
      allDay: true,
    } : entry).filter((entry) => allowed.has(entry.source));
    const [externalStarting, externalSpanning] = allowed.has("EXTERNAL") ? await Promise.all([
      ctx.db.query("externalCalendarEvents").withIndex("by_userId_and_startAt", (q) =>
        q.eq("userId", user._id).gte("startAt", args.startDate).lte("startAt", args.endDate),
      ).take(limit + 1),
      ctx.db.query("externalCalendarEvents").withIndex("by_userId_and_endAt", (q) =>
        q.eq("userId", user._id).gt("endAt", args.startDate),
      ).take(limit + 1),
    ]) : [[], []];
    const importedEntries = [...assertBounded(externalStarting), ...assertBounded(externalSpanning).filter((entry) => entry.startAt < args.startDate)]
      .map(serializeExternalCalendarEntry);

    if (!includePersonal) return [...visibleEntries, ...importedEntries];

    const acceptedInvites = await ctx.db
      .query("calendarInvites")
      .withIndex("by_recipientId_and_status_and_createdAt", (q) =>
        q.eq("recipientId", user._id).eq("status", "ACCEPTED"),
      )
      .take(limit + 1);
    assertBounded(acceptedInvites);
    // Resolved together rather than one invite at a time: a month with fifty
    // shared entries used to cost fifty sequential round trips inside the query.
    // The loader collapses the repeated sender lookups a prolific sharer causes.
    const loader = createDocLoader(ctx);
    const resolvedInvites = await Promise.all(
      acceptedInvites.map(async (invite) => {
        const [entry, sender, friendship] = await Promise.all([
          loader.get(invite.calendarEntryId),
          loader.get(invite.senderId),
          getFriendshipBetween(ctx, invite.senderId, user._id),
        ]);
        if (!entry || entry.source !== "PERSONAL" || !sender || friendship?.status !== "ACCEPTED") {
          return null;
        }
        if (entry.startAt > args.endDate || (entry.endAt ?? entry.startAt) < args.startDate) return null;
        return { ...entry, inviteId: invite._id, sharedBy: serializeUser(sender) };
      }),
    );
    const sharedEntries = resolvedInvites.filter(
      (entry): entry is NonNullable<typeof entry> => entry !== null,
    );

    return [...visibleEntries, ...sharedEntries, ...importedEntries];
  },
});

export const listEligibleFriends = query({
  args: {},
  returns: v.array(scheduleFriendUserValidator),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    if (!isStudentUser(user)) return [];
    const friendIds = await acceptedFriendIds(ctx, user._id);
    const candidates = await Promise.all(friendIds.map((friendId) => ctx.db.get(friendId)));
    const friends = candidates.flatMap((friend) =>
      friend?.isActive && isStudentUser(friend) ? [serializeUser(friend)] : [],
    );
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
    const loader = createDocLoader(ctx);
    const resolved = await Promise.all(
      invites.map(async (invite) => {
        const [entry, sender, friendship] = await Promise.all([
          loader.get(invite.calendarEntryId),
          loader.get(invite.senderId),
          getFriendshipBetween(ctx, invite.senderId, user._id),
        ]);
        if (!entry || entry.source !== "PERSONAL" || !sender || friendship?.status !== "ACCEPTED") {
          return null;
        }
        return {
          _id: invite._id,
          _creationTime: invite._creationTime,
          status: invite.status,
          createdAt: invite.createdAt,
          entry,
          sender: serializeUser(sender),
        };
      }),
    );
    return resolved.filter((row): row is NonNullable<typeof row> => row !== null);
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
    if (
      !entry ||
      entry.source !== "PERSONAL" ||
      entry.createdById !== user._id
    ) {
      throw new ConvexError("You can only share your own personal reminders.");
    }

    const friendIds = Array.from(new Set(args.friendIds));
    if (friendIds.length === 0)
      throw new ConvexError("Choose at least one friend.");
    if (friendIds.length > MAX_CALENDAR_INVITE_RECIPIENTS) {
      throw new ConvexError(
        `You can invite at most ${MAX_CALENDAR_INVITE_RECIPIENTS} friends at once.`,
      );
    }

    for (const friendId of friendIds) {
      const [friend, friendship] = await Promise.all([
        ctx.db.get(friendId),
        getFriendshipBetween(ctx, user._id, friendId),
      ]);
      if (
        !friend ||
        !canShareCalendarEntryWithFriend({
          senderId: user._id,
          recipientId: friendId,
          recipientIsActive: friend.isActive,
          recipientIsStudent: isStudentUser(friend),
          friendshipStatus:
            friendship?.status === "ACCEPTED"
              ? "ACCEPTED"
              : friendship
                ? "PENDING"
                : null,
        })
      ) {
        throw new ConvexError(
          "Calendar reminders can only be shared with accepted friends.",
        );
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
    if (
      !canRespondToCalendarInvite({
        isRecipient: invite.recipientId === user._id,
        inviteStatus: invite.status,
        entryIsPersonal: entry?.source === "PERSONAL",
        entryOwnedBySender: entry?.createdById === invite.senderId,
        friendshipStatus:
          friendship?.status === "ACCEPTED"
            ? "ACCEPTED"
            : friendship
              ? "PENDING"
              : null,
      })
    ) {
      throw new ConvexError("This calendar invitation is no longer available.");
    }
    await ctx.db.patch(invite._id, {
      status: args.accept ? "ACCEPTED" : "DECLINED",
      respondedAt: Date.now(),
    });
    return null;
  },
});

export const removeSharedEntry = mutation({
  args: { inviteId: v.id("calendarInvites") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const invite = await ctx.db.get(args.inviteId);
    if (!invite || invite.recipientId !== user._id || invite.status !== "ACCEPTED") {
      throw new ConvexError("Shared calendar entry not found.");
    }
    await ctx.db.patch(invite._id, { status: "DECLINED", respondedAt: Date.now() });
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
    allDay: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string())),
    source: v.optional(calendarSourceValidator),
  },
  returns: v.id("calendarEntries"),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (args.source && args.source !== "PERSONAL") {
      throw new ConvexError(
        "Shared calendar entries must be created by their owning feature",
      );
    }

    const title = normalizeEventTitle(args.title);
    const description = normalizeOptionalEventDescription(args.description);
    if (!Number.isFinite(args.startAt) || (args.endAt !== undefined && !Number.isFinite(args.endAt))) {
      throw new ConvexError("Choose a valid start and end time");
    }
    if (args.endAt !== undefined && args.endAt <= args.startAt) {
      throw new ConvexError("End time must be after start time");
    }

    const entryId = await ctx.db.insert("calendarEntries", {
      title,
      description,
      location: args.location?.trim(),
      startAt: args.startAt,
      endAt: args.endAt,
      allDay: args.allDay,
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
      .withIndex("by_calendarEntryId", (q) =>
        q.eq("calendarEntryId", args.entryId),
      )
      .take(MAX_CALENDAR_INVITE_RECIPIENTS + 1);
    for (const invite of invites) await ctx.db.delete(invite._id);
    await ctx.db.delete(args.entryId);
    return null;
  },
});

/** Move an owned reminder without overwriting fields changed in another editor. */
function schoolDateParts(timestamp: number) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", year: "numeric", month: "numeric", day: "numeric",
  }).formatToParts(timestamp).map(({ type, value }) => [type, Number(value)]));
  return { year: parts.year, month: parts.month, day: parts.day };
}

export const reschedule = mutation({
  args: {
    entryId: v.id("calendarEntries"),
    expectedStartAt: v.number(),
    startAt: v.number(),
    endAt: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const entry = await ctx.db.get(args.entryId);
    if (!entry || entry.source !== "PERSONAL" || entry.createdById !== user._id) {
      throw new ConvexError("You can only edit your own personal entries");
    }
    if (entry.startAt !== args.expectedStartAt) {
      throw new ConvexError("This reminder changed. Please try again.");
    }
    if (!Number.isFinite(args.startAt)) throw new ConvexError("Choose a valid start time");
    let endAt = entry.endAt === undefined ? undefined : args.startAt + entry.endAt - entry.startAt;
    if (entry.allDay && entry.endAt !== undefined) {
      const originalStart = schoolDateParts(entry.startAt);
      const originalEnd = schoolDateParts(entry.endAt);
      const target = schoolDateParts(args.startAt);
      const days = (Date.UTC(originalEnd.year, originalEnd.month - 1, originalEnd.day) - Date.UTC(originalStart.year, originalStart.month - 1, originalStart.day)) / 86_400_000;
      const expectedEnd = schoolTimestamp({ ...target, day: target.day + days });
      if (days < 1 || schoolTimestamp(target) !== args.startAt || args.endAt !== expectedEnd) {
        throw new ConvexError("Choose a valid end time");
      }
      endAt = expectedEnd;
    }
    await ctx.db.patch(args.entryId, { startAt: args.startAt, endAt });
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
    allDay: v.optional(v.boolean()),
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
    if (!Number.isFinite(args.startAt) || (args.endAt !== undefined && !Number.isFinite(args.endAt))) {
      throw new ConvexError("Choose a valid start and end time");
    }
    if (args.endAt !== undefined && args.endAt <= args.startAt) {
      throw new ConvexError("End time must be after start time");
    }

    await ctx.db.patch(args.entryId, {
      title,
      description,
      location: args.location?.trim(),
      startAt: args.startAt,
      // Older callers may omit endAt; preserve duration when moving a reminder.
      endAt: args.endAt ?? (entry.endAt === undefined ? undefined : args.startAt + entry.endAt - entry.startAt),
      allDay: args.allDay ?? entry.allDay,
    });
    return null;
  },
});
