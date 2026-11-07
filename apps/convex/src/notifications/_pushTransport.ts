import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { isDoNotDisturb } from "../presence/_status";
import type { NotificationCategory } from "../validators";
import { preferenceAllowsPush, resolveNotificationPreference } from "./deliveryPreference";

/** Web push (browsers) and Expo push (the mobile app) keep one row per delivery target. */
type PushTargetId = Id<"notificationPushSubscriptions"> | Id<"notificationNativePushTokens">;

/**
 * Whether push may be sent to the user right now. Do Not Disturb holds push
 * only; the delivery still reaches the inbox.
 */
export async function pushIsAllowed(
  ctx: QueryCtx,
  args: { userId: Id<"users">; category: NotificationCategory; scopeKey: string },
) {
  if (await isDoNotDisturb(ctx, args.userId)) return false;
  return preferenceAllowsPush(await resolveNotificationPreference(ctx, args));
}

export async function disablePushTarget(
  ctx: MutationCtx,
  id: PushTargetId,
  now = Date.now(),
) {
  await ctx.db.patch(id, { enabled: false, updatedAt: now });
}

export async function recordPushSendResult(
  ctx: MutationCtx,
  id: PushTargetId,
  result: { success: boolean; error?: string; deactivate?: boolean },
) {
  const row = await ctx.db.get(id);
  if (!row) return;

  await ctx.db.patch(id, {
    enabled: result.deactivate ? false : row.enabled,
    failureCount: result.success ? 0 : row.failureCount + 1,
    lastError: result.success ? undefined : result.error?.slice(0, 500),
    lastSentAt: result.success ? Date.now() : row.lastSentAt,
    updatedAt: Date.now(),
  });
}
