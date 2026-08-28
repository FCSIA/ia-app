import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { getCurrentAppUser } from "../../lib/currentUser";

const MAX_SUBSCRIPTIONS_PER_USER = 10;
const REFRESH_INTERVAL_MS = 6 * 60 * 60 * 1000;

export function validateIcsFeedUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ConvexError("Enter a valid HTTPS calendar URL.");
  }
  const octets = url.hostname.split(".").map(Number);
  const isPrivateIpv4 = octets.length === 4 && octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255) && (
    octets[0] === 0 ||
    octets[0] === 10 ||
    octets[0] === 127 ||
    (octets[0] === 169 && octets[1] === 254) ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168)
  );
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.hostname === "localhost" ||
    url.hostname.endsWith(".localhost") ||
    url.hostname.includes(":") ||
    isPrivateIpv4
  ) {
    throw new ConvexError("Calendar URLs must use public HTTPS hosts on port 443.");
  }
  url.hash = "";
  return url.toString();
}

const subscriptionOutputValidator = v.object({
  _id: v.id("externalCalendarSubscriptions"),
  _creationTime: v.number(),
  provider: v.literal("ICS"),
  displayName: v.string(),
  status: v.union(v.literal("ACTIVE"), v.literal("ERROR")),
  lastSyncedAt: v.optional(v.number()),
  lastError: v.optional(v.string()),
  nextRefreshAt: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

export const listMine = query({
  args: {},
  returns: v.array(subscriptionOutputValidator),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    const subscriptions = await ctx.db
      .query("externalCalendarSubscriptions")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", user._id))
      .take(MAX_SUBSCRIPTIONS_PER_USER);
    return subscriptions.map(({ feedUrl: _feedUrl, userId: _userId, ...subscription }) => subscription);
  },
});

export const createIcs = mutation({
  args: { displayName: v.string(), feedUrl: v.string() },
  returns: v.id("externalCalendarSubscriptions"),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const displayName = args.displayName.trim();
    if (!displayName || displayName.length > 120) {
      throw new ConvexError("Calendar name must be between 1 and 120 characters.");
    }
    const feedUrl = validateIcsFeedUrl(args.feedUrl.trim());
    const existing = await ctx.db
      .query("externalCalendarSubscriptions")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", user._id))
      .take(MAX_SUBSCRIPTIONS_PER_USER + 1);
    if (existing.length >= MAX_SUBSCRIPTIONS_PER_USER) {
      throw new ConvexError(`You can connect at most ${MAX_SUBSCRIPTIONS_PER_USER} calendars.`);
    }
    if (existing.some((subscription) => subscription.feedUrl === feedUrl)) {
      throw new ConvexError("This calendar is already connected.");
    }
    const now = Date.now();
    const subscriptionId = await ctx.db.insert("externalCalendarSubscriptions", {
      userId: user._id,
      provider: "ICS",
      displayName,
      feedUrl,
      status: "ACTIVE",
      nextRefreshAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.scheduler.runAfter(0, internal.events.externalCalendarSync.refresh, { subscriptionId });
    return subscriptionId;
  },
});

export const remove = mutation({
  args: { subscriptionId: v.id("externalCalendarSubscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription || subscription.userId !== user._id) throw new ConvexError("Calendar connection not found.");
    const events = await ctx.db
      .query("externalCalendarEvents")
      .withIndex("by_subscriptionId_and_lastSeenAt", (q) => q.eq("subscriptionId", subscription._id))
      .take(501);
    if (events.length > 500) throw new ConvexError("Calendar removal is still in progress. Try again shortly.");
    for (const event of events) await ctx.db.delete(event._id);
    await ctx.db.delete(subscription._id);
    return null;
  },
});

export const refreshMine = mutation({
  args: { subscriptionId: v.id("externalCalendarSubscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription || subscription.userId !== user._id) throw new ConvexError("Calendar connection not found.");
    await ctx.scheduler.runAfter(0, internal.events.externalCalendarSync.refresh, { subscriptionId: subscription._id });
    return null;
  },
});

export const dueSubscriptions = internalMutation({
  args: {},
  returns: v.array(v.id("externalCalendarSubscriptions")),
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db
      .query("externalCalendarSubscriptions")
      .withIndex("by_status_and_nextRefreshAt", (q) => q.eq("status", "ACTIVE").lte("nextRefreshAt", now))
      .take(50);
    return due.map((subscription) => subscription._id);
  },
});

export const getSubscription = internalQuery({
  args: { subscriptionId: v.id("externalCalendarSubscriptions") },
  returns: v.union(
    v.object({
      _id: v.id("externalCalendarSubscriptions"),
      _creationTime: v.number(),
      userId: v.id("users"),
      provider: v.literal("ICS"),
      displayName: v.string(),
      feedUrl: v.string(),
      status: v.union(v.literal("ACTIVE"), v.literal("ERROR")),
      lastSyncedAt: v.optional(v.number()),
      lastError: v.optional(v.string()),
      nextRefreshAt: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription) return null;
    return subscription;
  },
});

export const applySync = internalMutation({
  args: {
    subscriptionId: v.id("externalCalendarSubscriptions"),
    events: v.array(v.object({
      externalId: v.string(),
      title: v.string(),
      description: v.optional(v.string()),
      location: v.optional(v.string()),
      startAt: v.number(),
      endAt: v.optional(v.number()),
    })),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription) return null;
    const now = Date.now();
    for (const event of args.events) {
      const existing = await ctx.db
        .query("externalCalendarEvents")
        .withIndex("by_subscriptionId_and_externalId", (q) =>
          q.eq("subscriptionId", subscription._id).eq("externalId", event.externalId),
        )
        .unique();
      const values = { ...event, userId: subscription.userId, tags: ["external"], lastSeenAt: now };
      if (existing) await ctx.db.patch(existing._id, values);
      else await ctx.db.insert("externalCalendarEvents", { subscriptionId: subscription._id, ...values });
    }
    const stale = await ctx.db
      .query("externalCalendarEvents")
      .withIndex("by_subscriptionId_and_lastSeenAt", (q) => q.eq("subscriptionId", subscription._id).lt("lastSeenAt", now))
      .take(500);
    for (const event of stale) await ctx.db.delete(event._id);
    await ctx.db.patch(subscription._id, {
      status: "ACTIVE",
      lastSyncedAt: now,
      lastError: undefined,
      nextRefreshAt: now + REFRESH_INTERVAL_MS,
      updatedAt: now,
    });
    return null;
  },
});

export const recordSyncError = internalMutation({
  args: { subscriptionId: v.id("externalCalendarSubscriptions"), message: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const subscription = await ctx.db.get(args.subscriptionId);
    if (!subscription) return null;
    const now = Date.now();
    await ctx.db.patch(subscription._id, {
      status: "ERROR",
      lastError: args.message.slice(0, 300),
      nextRefreshAt: now + REFRESH_INTERVAL_MS,
      updatedAt: now,
    });
    return null;
  },
});
