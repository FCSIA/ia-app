import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import { notificationCategoryValidator } from "../validators";

const pushSubscriptionValidator = v.object({
  endpoint: v.string(),
  keys: v.object({
    p256dh: v.string(),
    auth: v.string(),
  }),
});

const pushSubscriptionPublicValidator = v.object({
  endpoint: v.string(),
  enabled: v.boolean(),
  createdAt: v.string(),
  updatedAt: v.string(),
});

function publicVapidKey() {
  return process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
}

export const getPublicKey = query({
  args: {},
  returns: v.union(v.string(), v.null()),
  handler: async () => publicVapidKey(),
});

export const listMine = query({
  args: {},
  returns: v.array(pushSubscriptionPublicValidator),
  handler: async (ctx) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];

    const rows = await ctx.db
      .query("notificationPushSubscriptions")
      .withIndex("by_userId_and_enabled", (q) => q.eq("userId", user._id).eq("enabled", true))
      .take(20);

    return rows.map((row) => ({
      endpoint: row.endpoint,
      enabled: row.enabled,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }));
  },
});

export const upsertSubscription = mutation({
  args: {
    subscription: pushSubscriptionValidator,
    userAgent: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const now = Date.now();
    const existing = await ctx.db
      .query("notificationPushSubscriptions")
      .withIndex("by_userId_and_endpoint", (q) =>
        q.eq("userId", user._id).eq("endpoint", args.subscription.endpoint),
      )
      .unique();

    const patch = {
      p256dh: args.subscription.keys.p256dh,
      auth: args.subscription.keys.auth,
      userAgent: args.userAgent,
      enabled: true,
      failureCount: 0,
      lastError: undefined,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("notificationPushSubscriptions", {
        userId: user._id,
        endpoint: args.subscription.endpoint,
        ...patch,
        createdAt: now,
      });
    }

    return { success: true };
  },
});

export const removeSubscription = mutation({
  args: {
    endpoint: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const existing = await ctx.db
      .query("notificationPushSubscriptions")
      .withIndex("by_userId_and_endpoint", (q) => q.eq("userId", user._id).eq("endpoint", args.endpoint))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        enabled: false,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

export const getDeliveryTargets = internalQuery({
  args: {
    userId: v.id("users"),
    category: notificationCategoryValidator,
    scopeKey: v.string(),
  },
  returns: v.array(v.object({
    id: v.id("notificationPushSubscriptions"),
    endpoint: v.string(),
    keys: v.object({
      p256dh: v.string(),
      auth: v.string(),
    }),
  })),
  handler: async (ctx, args) => {
    const preferences = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId_and_category_and_scopeKey", (q) => q.eq("userId", args.userId).eq("category", args.category))
      .take(100);
    const preference =
      preferences.find((pref) => pref.scopeKey === args.scopeKey) ??
      preferences.find((pref) => pref.scopeKey === "global");

    if (!preference?.enabled || !["PUSH", "TIME_SENSITIVE"].includes(preference.level)) {
      return [];
    }

    const subscriptions = await ctx.db
      .query("notificationPushSubscriptions")
      .withIndex("by_userId_and_enabled", (q) => q.eq("userId", args.userId).eq("enabled", true))
      .take(20);

    return subscriptions.map((subscription) => ({
      id: subscription._id,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    }));
  },
});

export const recordSendResult = internalMutation({
  args: {
    id: v.id("notificationPushSubscriptions"),
    success: v.boolean(),
    error: v.optional(v.string()),
    deactivate: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.id);
    if (!row) return null;

    await ctx.db.patch(args.id, {
      enabled: args.deactivate ? false : row.enabled,
      failureCount: args.success ? 0 : row.failureCount + 1,
      lastError: args.success ? undefined : args.error?.slice(0, 500),
      lastSentAt: args.success ? Date.now() : row.lastSentAt,
      updatedAt: Date.now(),
    });

    return null;
  },
});
