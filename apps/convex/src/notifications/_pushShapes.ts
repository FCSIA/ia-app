import { v } from "convex/values";

// Kept apart from `_pushTransport` so the "use node" sender imports nothing
// that reads the database.

export function publicVapidKey() {
  return process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;
}

/** A browser registration as the sender needs it. */
export const webPushTargetValidator = v.object({
  id: v.id("notificationPushSubscriptions"),
  endpoint: v.string(),
  keys: v.object({
    p256dh: v.string(),
    auth: v.string(),
  }),
});

/** What a sender reports back about one attempt. */
export const pushSendResultFields = {
  success: v.boolean(),
  error: v.optional(v.string()),
  deactivate: v.optional(v.boolean()),
};
