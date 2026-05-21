import { ConvexError, v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { getCurrentAppUser } from "./lib/currentUser";
import {
  notificationCategoryValidator,
  notificationPreferenceLevelValidator,
} from "./validators";

const notificationValidator = v.object({
  id: v.id("notificationDeliveries"),
  category: notificationCategoryValidator,
  title: v.string(),
  body: v.string(),
  isRead: v.boolean(),
  announcementId: v.union(v.string(), v.null()),
  eventId: v.union(v.string(), v.null()),
  clubId: v.union(v.string(), v.null()),
  channelId: v.union(v.string(), v.null()),
  messageId: v.union(v.string(), v.null()),
  createdAt: v.string(),
});

const preferenceValidator = v.object({
  id: v.id("notificationPreferences"),
  category: notificationCategoryValidator,
  enabled: v.boolean(),
  level: notificationPreferenceLevelValidator,
  locked: v.boolean(),
  clubId: v.union(v.string(), v.null()),
  channelId: v.union(v.string(), v.null()),
  announcementId: v.union(v.string(), v.null()),
  eventId: v.union(v.string(), v.null()),
  scopeKey: v.string(),
});

function scopeKey(opts?: {
  scopeKey?: string;
  clubId?: string | null;
  channelId?: string | null;
  announcementId?: string | null;
  eventId?: string | null;
}) {
  if (opts?.scopeKey?.trim()) return opts.scopeKey.trim();
  if (opts?.channelId) return `channel:${opts.channelId}`;
  if (opts?.announcementId) return `announcement:${opts.announcementId}`;
  if (opts?.eventId) return `event:${opts.eventId}`;
  if (opts?.clubId) return `club:${opts.clubId}`;
  return "global";
}

function toNotification(row: Doc<"notificationDeliveries">) {
  return {
    id: row._id,
    category: row.category,
    title: row.title,
    body: row.body,
    isRead: row.isRead,
    announcementId: row.announcementId ?? null,
    eventId: row.eventId ?? null,
    clubId: row.clubId ?? null,
    channelId: row.channelId ?? null,
    messageId: row.messageId ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

function toPreference(row: Doc<"notificationPreferences">) {
  return {
    id: row._id,
    category: row.category,
    enabled: row.enabled,
    level: row.level,
    locked: row.locked,
    clubId: row.clubId ?? null,
    channelId: row.channelId ?? null,
    announcementId: row.announcementId ?? null,
    eventId: row.eventId ?? null,
    scopeKey: row.scopeKey,
  };
}

export const list = query({
  args: {
    unreadOnly: v.optional(v.boolean()),
    limit: v.optional(v.number()),
  },
  returns: v.array(notificationValidator),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const limit = Math.min(Math.max(args.limit ?? 100, 1), 100);
    const queryBase = args.unreadOnly
      ? ctx.db
          .query("notificationDeliveries")
          .withIndex("by_userId_and_isRead_and_createdAt", (q) =>
            q.eq("userId", user._id).eq("isRead", false),
          )
      : ctx.db
          .query("notificationDeliveries")
          .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", user._id));

    const rows = await queryBase.order("desc").take(limit);
    return rows.map(toNotification);
  },
});

export const unreadCount = query({
  args: {},
  returns: v.object({ count: v.number() }),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    const rows = await ctx.db
      .query("notificationDeliveries")
      .withIndex("by_userId_and_isRead_and_createdAt", (q) =>
        q.eq("userId", user._id).eq("isRead", false),
      )
      .take(100);
    return { count: rows.length };
  },
});

export const markRead = mutation({
  args: {
    ids: v.array(v.id("notificationDeliveries")),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    for (const id of args.ids) {
      const row = await ctx.db.get(id);
      if (row && row.userId === user._id) {
        await ctx.db.patch(id, { isRead: true });
      }
    }
    return { success: true };
  },
});

export const markAllRead = mutation({
  args: {},
  returns: v.object({ success: v.boolean(), updated: v.number() }),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    const rows = await ctx.db
      .query("notificationDeliveries")
      .withIndex("by_userId_and_isRead_and_createdAt", (q) =>
        q.eq("userId", user._id).eq("isRead", false),
      )
      .take(100);
    for (const row of rows) {
      await ctx.db.patch(row._id, { isRead: true });
    }
    return { success: true, updated: rows.length };
  },
});

export const preferences = query({
  args: {},
  returns: v.array(preferenceValidator),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    const rows = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId_and_category_and_scopeKey", (q) =>
        q.eq("userId", user._id),
      )
      .take(500);
    return rows.map(toPreference);
  },
});

export const upsertPreference = mutation({
  args: {
    category: notificationCategoryValidator,
    enabled: v.boolean(),
    clubId: v.optional(v.string()),
    channelId: v.optional(v.string()),
    announcementId: v.optional(v.string()),
    eventId: v.optional(v.string()),
    scopeKey: v.optional(v.string()),
    level: v.optional(notificationPreferenceLevelValidator),
  },
  returns: preferenceValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const key = scopeKey(args);
    const level = args.level ?? (args.enabled ? "PUSH" : "OFF");
    const enabled = args.enabled && level !== "OFF";
    const now = Date.now();
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId_and_category_and_scopeKey", (q) =>
        q.eq("userId", user._id).eq("category", args.category).eq("scopeKey", key),
      )
      .unique();

    if (existing?.locked) return toPreference(existing);

    if (existing) {
      await ctx.db.patch(existing._id, {
        enabled,
        level,
        updatedAt: now,
      });
      const updated = await ctx.db.get(existing._id);
      if (!updated) throw new ConvexError("Preference not found.");
      return toPreference(updated);
    }

    const id = await ctx.db.insert("notificationPreferences", {
      userId: user._id,
      category: args.category,
      enabled,
      level,
      locked: false,
      clubId: args.clubId,
      channelId: args.channelId,
      announcementId: args.announcementId,
      eventId: args.eventId,
      scopeKey: key,
      createdAt: now,
      updatedAt: now,
    });
    const created = await ctx.db.get(id);
    if (!created) throw new ConvexError("Preference not found.");
    return toPreference(created);
  },
});
