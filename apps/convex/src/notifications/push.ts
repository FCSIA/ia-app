import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import { notificationCategoryValidator } from "../validators";
import { activatePushPreferences } from "./_pushActivation";
import {
  assertPushDeviceId,
  maxSubscriptionsPerDevice,
  subscriptionsReplacedOnDevice,
} from "./_pushDevices";
import { maxAccountsPerPushTarget, rowsHeldByOtherAccounts } from "./_pushOwnership";
import { subscriptionsToRetire } from "./_subscriptionPruning";
import {
  disablePushTarget,
  pushIsAllowed,
  recordPushSendResult,
} from "./_pushTransport";
import {
  publicVapidKey,
  pushSendResultFields,
  webPushTargetValidator,
} from "./_pushShapes";

const subscriptionPageSize = 20;

function toWebPushTarget(subscription: Doc<"notificationPushSubscriptions">) {
  return {
    id: subscription._id,
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };
}

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
    await disablePushTarget(ctx, row._id, now);
  }
}

/** Disable the endpoints a device registered before the one it holds now. */
async function retireReplacedDeviceSubscriptions(
  ctx: MutationCtx,
  userId: Id<"users">,
  deviceId: string,
  currentEndpoint: string,
  now: number,
) {
  const rows = await ctx.db
    .query("notificationPushSubscriptions")
    .withIndex("by_userId_and_deviceId", (q) => q.eq("userId", userId).eq("deviceId", deviceId))
    .take(maxSubscriptionsPerDevice);

  for (const row of subscriptionsReplacedOnDevice(rows, currentEndpoint)) {
    await disablePushTarget(ctx, row._id, now);
  }
}

/** Stop delivering to an endpoint for every account except the one now using it. */
async function releaseEndpointFromOtherAccounts(
  ctx: MutationCtx,
  userId: Id<"users">,
  endpoint: string,
  now: number,
) {
  const rows = await ctx.db
    .query("notificationPushSubscriptions")
    .withIndex("by_endpoint", (q) => q.eq("endpoint", endpoint))
    .take(maxAccountsPerPushTarget);

  for (const row of rowsHeldByOtherAccounts(rows, userId)) {
    await disablePushTarget(ctx, row._id, now);
  }
}

export const upsertSubscription = mutation({
  args: {
    subscription: pushSubscriptionValidator,
    userAgent: v.optional(v.string()),
    // Optional so clients from before device reporting keep working.
    deviceId: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (args.deviceId !== undefined) assertPushDeviceId(args.deviceId);
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
      // An older client re-registering must not erase the device that claimed it.
      ...(args.deviceId !== undefined ? { deviceId: args.deviceId } : {}),
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

    await releaseEndpointFromOtherAccounts(ctx, user._id, args.subscription.endpoint, now);
    if (args.deviceId !== undefined) {
      await retireReplacedDeviceSubscriptions(
        ctx,
        user._id,
        args.deviceId,
        args.subscription.endpoint,
        now,
      );
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
      await disablePushTarget(ctx, existing._id);
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
  returns: v.array(webPushTargetValidator),
  handler: async (ctx, args) => {
    if (!(await pushIsAllowed(ctx, args))) return [];

    const subscriptions = await ctx.db
      .query("notificationPushSubscriptions")
      .withIndex("by_userId_and_enabled", (q) => q.eq("userId", args.userId).eq("enabled", true))
      .take(subscriptionPageSize);

    return subscriptions.map(toWebPushTarget);
  },
});

export const recordSendResult = internalMutation({
  args: {
    id: v.id("notificationPushSubscriptions"),
    ...pushSendResultFields,
  },
  returns: v.null(),
  handler: async (ctx, { id, ...result }) => {
    await recordPushSendResult(ctx, id, result);
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
  returns: v.array(webPushTargetValidator),
  handler: async (ctx, args) => {
    const subscriptions = await ctx.db
      .query("notificationPushSubscriptions")
      .withIndex("by_userId_and_enabled", (q) => q.eq("userId", args.userId).eq("enabled", true))
      .take(subscriptionPageSize);

    return subscriptions.map(toWebPushTarget);
  },
});
