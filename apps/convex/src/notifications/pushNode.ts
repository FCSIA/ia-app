"use node";

import webpush from "web-push";
import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";
import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

function publicVapidKey() {
  return (
    process.env.VAPID_PUBLIC_KEY ??
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ??
    null
  );
}

function formatVapidSubject() {
  const raw =
    process.env.VAPID_SUBJECT ??
    process.env.SITE_URL ??
    "mailto:admin@example.com";
  if (
    raw.startsWith("mailto:") ||
    raw.startsWith("https://") ||
    raw.startsWith("http://")
  ) {
    return raw;
  }
  return `https://${raw}`;
}

function configureWebPush() {
  const publicKey = publicVapidKey();
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(formatVapidSubject(), publicKey, privateKey);
  return true;
}

type DeliveryTarget = {
  id: Id<"notificationPushSubscriptions">;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

/**
 * `Urgency: high` keeps FCM from batching the message behind Android's Doze
 * window, which is what makes a phone that is sitting idle in a pocket receive
 * an announcement now rather than at the next maintenance window.
 */
const pushOptions = {
  TTL: 60 * 60 * 24, // 24 hours
  urgency: "high" as const,
} satisfies Parameters<typeof webpush.sendNotification>[2];

function errorStatusCode(error: unknown) {
  return typeof error === "object" && error !== null && "statusCode" in error
    ? Number((error as { statusCode: unknown }).statusCode)
    : undefined;
}

async function sendToTargets(
  ctx: ActionCtx,
  targets: DeliveryTarget[],
  payload: string,
) {
  const results = await Promise.all(
    targets.map(async (target) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: target.endpoint,
          keys: target.keys,
        },
        payload,
        pushOptions,
      );
      await ctx.runMutation(internal.notifications.push.recordSendResult, {
        id: target.id,
        success: true,
      });
      return { ok: true as const };
    } catch (error) {
      const statusCode = errorStatusCode(error);
        const message =
          error instanceof Error ? error.message : "Push delivery failed.";
      await ctx.runMutation(internal.notifications.push.recordSendResult, {
        id: target.id,
        success: false,
        error: message,
        // 404/410 mean the endpoint is permanently gone. 401/403 mean the VAPID
        // configuration is wrong, which must not disable a working device.
        deactivate: statusCode === 404 || statusCode === 410,
      });
      return { ok: false as const, statusCode, message };
    }
    }),
  );

  return {
    attempted: results.length,
    delivered: results.filter((result) => result.ok).length,
    errors: results
      .filter(
        (
          result,
        ): result is { ok: false; statusCode?: number; message: string } =>
          !result.ok,
      )
      .map((result) =>
        result.statusCode
          ? `${result.statusCode}: ${result.message}`
          : result.message,
      ),
  };
}

export const sendForDelivery = internalAction({
  args: {
    deliveryId: v.id("notificationDeliveries"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    if (!configureWebPush()) return null;

    const delivery = await ctx.runQuery(
      internal.notifications.delivery.getUnreadDeliveryForPush,
      {
        deliveryId: args.deliveryId,
      },
    );
    if (!delivery) return null;

    const targets: DeliveryTarget[] = await ctx.runQuery(
      internal.notifications.push.getDeliveryTargets,
      {
        userId: delivery.userId,
        category: delivery.category,
        scopeKey: delivery.scopeKey,
      },
    );
    if (targets.length === 0) return null;

    const payload = JSON.stringify({
      title: delivery.title,
      body: delivery.body,
      url: delivery.href,
      category: delivery.category,
      deliveryId: args.deliveryId,
      deliveryCreatedAt: delivery.deliveryCreatedAt,
      channelId: delivery.channelId,
      sourceCreatedAt: delivery.sourceCreatedAt,
    });

    await sendToTargets(ctx, targets, payload);

    return null;
  },
});

/**
 * Send a push to every browser the caller has registered.
 *
 * This exists so a real device can be diagnosed from the device itself.
 * Browser push fails in ways that are invisible from the client — a missing
 * VAPID key on the deployment, an endpoint the push service has expired, a
 * subject the push service rejects — and all of them look identical to a user
 * who simply never sees a notification. Returning the push service's own
 * status codes turns that silence into something readable, which is why this
 * reuses the exact send path real deliveries take.
 */
export const sendTestToMe = action({
  args: {},
  returns: v.object({
    attempted: v.number(),
    delivered: v.number(),
    errors: v.array(v.string()),
    configured: v.boolean(),
  }),
  handler: async (ctx) => {
    if (!configureWebPush()) {
      return {
        attempted: 0,
        delivered: 0,
        configured: false,
        errors: ["This deployment has no VAPID keys, so no push can be sent."],
      };
    }

    const user = await ctx.runQuery(
      internal.notifications.push.currentUserForTest,
      {},
    );
    if (!user) {
      return {
        attempted: 0,
        delivered: 0,
        configured: true,
        errors: ["Not signed in."],
      };
    }

    const targets: DeliveryTarget[] = await ctx.runQuery(
      internal.notifications.push.getTestTargets,
      {
      userId: user._id,
      },
    );
    if (targets.length === 0) {
      return {
        attempted: 0,
        delivered: 0,
        configured: true,
        errors: [
          "This account has no registered browsers. Turn on Browser push first.",
        ],
      };
    }

    const payload = JSON.stringify({
      title: "Innovation Academy",
      body: "Browser push notifications are working on this device.",
      url: "/notifications",
      category: "SCHOOL_ANNOUNCEMENT",
    });

    const result = await sendToTargets(ctx, targets, payload);
    return { ...result, configured: true };
  },
});
