import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import {
  notificationCategoryValidator,
  notificationPreferenceLevelValidator,
  type NotificationCategory,
} from "../validators";
import { preferenceValidator, scopeKey, toPreference } from "./_lib";

const pushDefaultCategories: NotificationCategory[] = [
  "SCHOOL_ANNOUNCEMENT",
  "CLUB_ANNOUNCEMENT",
  "CLUB_JOIN_REQUEST",
  "CLUB_CHANNEL_MENTION",
  "CLUB_CHANNEL_TAG_MENTION",
  "CLUB_CHANNEL_THREAD",
  "EVENT",
  "FLEX_FRIDAY",
  "CONTENT_MODERATED",
  "FRIEND_REQUEST",
];

export const list = query({
  args: {},
  returns: v.array(preferenceValidator),
  handler: async (ctx) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];
    const rows = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId_and_category_and_scopeKey", (q) =>
        q.eq("userId", user._id),
      )
      .take(500);
    return rows.map(toPreference);
  },
});

export const upsert = mutation({
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

/**
 * Makes an explicit device-push opt-in useful immediately. Existing OFF
 * preferences remain off, and high-volume all-channel-message alerts remain
 * opt-in at the channel level.
 */
export const activatePush = mutation({
  args: {},
  returns: v.object({ updated: v.number() }),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    const now = Date.now();
    const preferences = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId_and_category_and_scopeKey", (q) => q.eq("userId", user._id))
      .take(500);
    let updated = 0;

    for (const category of pushDefaultCategories) {
      const categoryPreferences = preferences.filter((preference) => preference.category === category);
      const globalPreference = categoryPreferences.find((preference) => preference.scopeKey === "global");

      if (globalPreference?.enabled === false || globalPreference?.level === "OFF") continue;

      if (!globalPreference) {
        await ctx.db.insert("notificationPreferences", {
          userId: user._id,
          category,
          enabled: true,
          level: "PUSH",
          locked: false,
          scopeKey: "global",
          createdAt: now,
          updatedAt: now,
        });
        updated++;
      }

      for (const preference of categoryPreferences) {
        if (!preference.enabled || preference.level === "OFF" || preference.level === "PUSH") continue;
        await ctx.db.patch(preference._id, {
          level: "PUSH",
          updatedAt: now,
        });
        updated++;
      }
    }

    return { updated };
  },
});
