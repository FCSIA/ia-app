import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { notificationCategoryValidator } from "../validators";
import {
  preferenceAllowsPush,
  resolveNotificationPreference,
} from "./deliveryPreference";

const nativePlatformValidator = v.union(v.literal("ios"), v.literal("android"));

const nativeTokenPublicValidator = v.object({
  token: v.string(),
  platform: nativePlatformValidator,
  deviceId: v.optional(v.string()),
  deviceName: v.optional(v.string()),
  enabled: v.boolean(),
  createdAt: v.string(),
  updatedAt: v.string(),
});

function isExpoPushToken(token: string) {
  return /^ExponentPushToken\[[A-Za-z0-9_-]+\]$/.test(token) || /^ExpoPushToken\[[A-Za-z0-9_-]+\]$/.test(token);
}

export const listMine = query({
  args: {},
  returns: v.array(nativeTokenPublicValidator),
  handler: async (ctx) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];

    const rows = await ctx.db
      .query("notificationNativePushTokens")
      .withIndex("by_userId_and_enabled", (q) => q.eq("userId", user._id).eq("enabled", true))
      .take(20);

    return rows.map((row) => ({
      token: row.token,
      platform: row.platform,
      deviceId: row.deviceId,
      deviceName: row.deviceName,
      enabled: row.enabled,
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    }));
  },
});

export const registerToken = mutation({
  args: {
    token: v.string(),
    platform: nativePlatformValidator,
    deviceId: v.optional(v.string()),
    deviceName: v.optional(v.string()),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!isExpoPushToken(args.token)) {
      throw new Error("Invalid Expo push token.");
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("notificationNativePushTokens")
      .withIndex("by_userId_and_token", (q) => q.eq("userId", user._id).eq("token", args.token))
      .unique();

    const patch = {
      platform: args.platform,
      deviceId: args.deviceId,
      deviceName: args.deviceName,
      enabled: true,
      failureCount: 0,
      lastError: undefined,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
    } else {
      await ctx.db.insert("notificationNativePushTokens", {
        userId: user._id,
        token: args.token,
        ...patch,
        createdAt: now,
      });
    }

    return { success: true };
  },
});

export const unregisterToken = mutation({
  args: {
    token: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const existing = await ctx.db
      .query("notificationNativePushTokens")
      .withIndex("by_userId_and_token", (q) => q.eq("userId", user._id).eq("token", args.token))
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

export const unregisterDevice = mutation({
  args: {
    deviceId: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const tokens = await ctx.db
      .query("notificationNativePushTokens")
      .withIndex("by_userId_and_enabled", (q) => q.eq("userId", user._id).eq("enabled", true))
      .take(20);

    for (const token of tokens.filter((row) => row.deviceId === args.deviceId)) {
      await ctx.db.patch(token._id, {
        enabled: false,
        updatedAt: Date.now(),
      });
    }

    return { success: true };
  },
});

export const sendTestToMe = action({
  args: {
    title: v.optional(v.string()),
    body: v.optional(v.string()),
  },
  returns: v.object({ sent: v.number() }),
  handler: async (ctx, args) => {
    const user = await ctx.runQuery(internal.notifications.pushExpo.currentUserForTest, {});
    if (!user) return { sent: 0 };

    const targets: DeliveryTarget[] = await ctx.runQuery(internal.notifications.pushExpo.getDeliveryTargets, {
      userId: user._id,
      category: "SCHOOL_ANNOUNCEMENT",
      scopeKey: "global",
    });

    await sendExpoMessages(
      targets.map((target) => ({
        to: target.token,
        title: args.title ?? "Innovation Academy",
        body: args.body ?? "Native push notifications are connected.",
        data: { href: "/notifications" },
      })),
    );

    return { sent: targets.length };
  },
});

export const currentUserForTest = internalQuery({
  args: {},
  handler: async (ctx) => getMaybeCurrentAppUser(ctx),
});

type DeliveryTarget = {
  id: Id<"notificationNativePushTokens">;
  token: string;
};

export const getDeliveryTargets = internalQuery({
  args: {
    userId: v.id("users"),
    category: notificationCategoryValidator,
    scopeKey: v.string(),
  },
  returns: v.array(v.object({
    id: v.id("notificationNativePushTokens"),
    token: v.string(),
  })),
  handler: async (ctx, args) => {
    const preference = await resolveNotificationPreference(ctx, args);

    if (!preferenceAllowsPush(preference)) {
      return [];
    }

    const tokens = await ctx.db
      .query("notificationNativePushTokens")
      .withIndex("by_userId_and_enabled", (q) => q.eq("userId", args.userId).eq("enabled", true))
      .take(20);

    return tokens.map((token) => ({
      id: token._id,
      token: token.token,
    }));
  },
});

export const recordSendResult = internalMutation({
  args: {
    id: v.id("notificationNativePushTokens"),
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

export const sendForDelivery = internalAction({
  args: {
    userId: v.id("users"),
    category: notificationCategoryValidator,
    title: v.string(),
    body: v.string(),
    href: v.string(),
    scopeKey: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const targets: DeliveryTarget[] = await ctx.runQuery(internal.notifications.pushExpo.getDeliveryTargets, {
      userId: args.userId,
      category: args.category,
      scopeKey: args.scopeKey,
    });
    if (targets.length === 0) return null;

    const results = await sendExpoMessages(
      targets.map((target) => ({
        to: target.token,
        title: args.title,
        body: args.body,
        data: { href: args.href },
      })),
    );

    await Promise.all(targets.map(async (target, index) => {
      const result = results[index];
      await ctx.runMutation(internal.notifications.pushExpo.recordSendResult, {
        id: target.id,
        success: result?.ok ?? false,
        error: result?.error,
        deactivate: result?.deactivate,
      });
    }));

    return null;
  },
});

type ExpoMessage = {
  to: string;
  title: string;
  body: string;
  data: { href: string };
};

async function sendExpoMessages(messages: ExpoMessage[]) {
  if (messages.length === 0) return [];

  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    return messages.map(() => ({
      ok: false,
      error: `Expo Push API returned ${response.status}.`,
      deactivate: false,
    }));
  }

  const payload = await response.json() as {
    data?: Array<{ status?: string; message?: string; details?: { error?: string } }>;
  };

  return messages.map((_, index) => {
    const ticket = payload.data?.[index];
    const detailsError = ticket?.details?.error;
    const error = detailsError ?? ticket?.message;
    return {
      ok: ticket?.status === "ok",
      error,
      deactivate: detailsError === "DeviceNotRegistered",
    };
  });
}
