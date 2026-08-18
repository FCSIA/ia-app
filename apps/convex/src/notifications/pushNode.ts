"use node";

import webpush from "web-push";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { notificationCategoryValidator } from "../validators";

function publicVapidKey() {
  return process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
}

function formatVapidSubject() {
  const raw = process.env.VAPID_SUBJECT ?? process.env.SITE_URL ?? "mailto:admin@example.com";
  if (raw.startsWith("mailto:") || raw.startsWith("https://") || raw.startsWith("http://")) {
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

  webpush.setVapidDetails(
    formatVapidSubject(),
    publicKey,
    privateKey,
  );
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
    if (!configureWebPush()) return null;

    const targets: DeliveryTarget[] = await ctx.runQuery(internal.notifications.push.getDeliveryTargets, {
      userId: args.userId,
      category: args.category,
      scopeKey: args.scopeKey,
    });
    if (targets.length === 0) return null;

    const payload = JSON.stringify({
      title: args.title,
      body: args.body,
      url: args.href,
      category: args.category,
    });

    const pushOptions = {
      TTL: 60 * 60 * 24, // 24 hours
      urgency: "high" as const,
      headers: {
        Urgency: "high",
      },
    };

    await Promise.all(targets.map(async (target) => {
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
      } catch (error) {
        const statusCode =
          typeof error === "object" && error !== null && "statusCode" in error
            ? Number(error.statusCode)
            : undefined;
        await ctx.runMutation(internal.notifications.push.recordSendResult, {
          id: target.id,
          success: false,
          error: error instanceof Error ? error.message : "Push delivery failed.",
          deactivate: statusCode === 404 || statusCode === 410,
        });
      }
    }));

    return null;
  },
});
