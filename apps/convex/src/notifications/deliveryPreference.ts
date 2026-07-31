import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { NotificationCategory } from "../validators";

type NotificationDbCtx = QueryCtx | MutationCtx;

export async function resolveNotificationPreference(
  ctx: NotificationDbCtx,
  input: {
    userId: Id<"users">;
    category: NotificationCategory;
    scopeKey: string;
  },
) {
  if (input.scopeKey.startsWith("channel:")) {
    const channelId = input.scopeKey.slice("channel:".length);
    const mutePreference = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId_and_category_and_scopeKey", (q) =>
        q
          .eq("userId", input.userId)
          .eq("category", "CLUB_CHANNEL_MESSAGE")
          .eq("scopeKey", `mute:channel:${channelId}`),
      )
      .unique();
    if (
      mutePreference?.isMuted &&
      (mutePreference.mutedUntil == null || mutePreference.mutedUntil > Date.now())
    ) {
      return mutePreference;
    }
  }

  const scopedPreference = await ctx.db
    .query("notificationPreferences")
    .withIndex("by_userId_and_category_and_scopeKey", (q) =>
      q.eq("userId", input.userId).eq("category", input.category).eq("scopeKey", input.scopeKey),
    )
    .unique();
  if (scopedPreference || input.scopeKey === "global") {
    return scopedPreference;
  }

  return await ctx.db
    .query("notificationPreferences")
    .withIndex("by_userId_and_category_and_scopeKey", (q) =>
      q.eq("userId", input.userId).eq("category", input.category).eq("scopeKey", "global"),
    )
    .unique();
}

export function preferenceAllowsPush(preference: Awaited<ReturnType<typeof resolveNotificationPreference>>) {
  return !!preference?.enabled && (preference.level === "PUSH" || preference.level === "TIME_SENSITIVE");
}
