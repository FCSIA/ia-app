import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import {
  notificationCategoryValidator,
  notificationPreferenceLevelValidator,
} from "../validators";
import { preferenceValidator, scopeKey, toPreference } from "./_lib";

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
