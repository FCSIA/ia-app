import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import { notificationCategoryValidator } from "../validators";
import { activatePushPreferences } from "./_pushActivation";
import { subscriptionsToRetire } from "./_subscriptionPruning";
import {
  preferenceAllowsPush,
  resolveNotificationPreference,
} from "./deliveryPreference";

const subscriptionPageSize = 20;

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
  failureCount: v.number(),
  lastError: v.optional(v.string()),
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
      failureCount: row.failureCount,
      lastError: row.lastError,
    }));
  },
});

/**
 * Disable the browsers a user stopped using, once they have too many.
 *
 * Runs on registration because that is the moment the list grows, and the
 * moment the current device is guaranteed to be the most recently updated row
 * and therefore safe from being retired itself.
 */
async function retireSurplusSubscriptions(
  ctx: MutationCtx,
  userId: Id<"users">,
  now: number,
) {
  const rows = await ctx.db
    .query("notificationPushSubscriptions")
    .withIndex("by_userId_and_enabled", (q) => q.eq("userId", userId).eq("enabled", true))
    .take(100);

  for (const row of subscriptionsToRetire(rows)) {
    await ctx.db.patch(row._id, { enabled: false, updatedAt: now });
  }
}

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

    await retireSurplusSubscriptions(ctx, user._id, now);
    await activatePushPreferences(ctx, user._id, now);

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
    const preference = await resolveNotificationPreference(ctx, args);

    if (!preferenceAllowsPush(preference)) {
      return [];
    }

    const subscriptions = await ctx.db
      .query("notificationPushSubscriptions")
      .withIndex("by_userId_and_enabled", (q) => q.eq("userId", args.userId).eq("enabled", true))
      .take(subscriptionPageSize);

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

export const currentUserForTest = internalQuery({
  args: {},
  handler: async (ctx) => getMaybeCurrentAppUser(ctx),
});

/**
 * Every registered browser for a user, ignoring notification preferences.
 *
 * The test send deliberately skips `getDeliveryTargets`: a device test has to
 * answer "can this browser receive a push at all", and folding preference
 * resolution into it would report a category opt-out as a transport failure.
 */
export const getTestTargets = internalQuery({
  args: {
    userId: v.id("users"),
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
    const subscriptions = await ctx.db
      .query("notificationPushSubscriptions")
      .withIndex("by_userId_and_enabled", (q) => q.eq("userId", args.userId).eq("enabled", true))
      .take(subscriptionPageSize);

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
