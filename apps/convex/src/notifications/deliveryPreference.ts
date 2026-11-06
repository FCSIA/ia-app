import { channelMuteScopeKey, GLOBAL_SCOPE_KEY, parseChannelScopeKey } from "../../../shared/notifications";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import type { NotificationCategory } from "../validators";
import { isMuteActive } from "../../../shared/notification-mute";

type PreferenceSwitch = { enabled?: boolean; level: "OFF" | "IN_APP" | "PUSH" | "TIME_SENSITIVE" };

/**
 * Whether a preference lets notifications through. `level` is the source of
 * truth, with OFF meaning off. `enabled` is a legacy mirror of it that
 * `migrations:foldPreferenceEnabledIntoLevel` removes; until that has run,
 * an old `enabled: false` row still counts as off.
 */
export function preferenceIsOn(preference: PreferenceSwitch) {
  return preference.enabled !== false && preference.level !== "OFF";
}

type NotificationDbCtx = QueryCtx | MutationCtx;

export async function resolveNotificationPreference(
  ctx: NotificationDbCtx,
  input: {
    userId: Id<"users">;
    category: NotificationCategory;
    scopeKey: string;
  },
) {
  const channelId = parseChannelScopeKey(input.scopeKey);
  if (channelId !== null) {
    const mutePreference = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId_and_category_and_scopeKey", (q) =>
        q
          .eq("userId", input.userId)
          .eq("category", "CLUB_CHANNEL_MESSAGE")
          .eq("scopeKey", channelMuteScopeKey(channelId)),
      )
      .unique();
    if (mutePreference && isMuteActive(mutePreference, Date.now())) {
      return mutePreference;
    }
  }

  const scopedPreference = await ctx.db
    .query("notificationPreferences")
    .withIndex("by_userId_and_category_and_scopeKey", (q) =>
      q.eq("userId", input.userId).eq("category", input.category).eq("scopeKey", input.scopeKey),
    )
    .unique();
  if (scopedPreference) return scopedPreference;

  // Feedback previously shared moderation preferences. Preserve every existing
  // opt-out and delivery level until this user chooses a feedback preference.
  if (input.category === "FEEDBACK" && input.scopeKey === GLOBAL_SCOPE_KEY) {
    return await ctx.db.query("notificationPreferences")
      .withIndex("by_userId_and_category_and_scopeKey", (q) =>
        q.eq("userId", input.userId).eq("category", "CONTENT_MODERATED").eq("scopeKey", GLOBAL_SCOPE_KEY),
      ).unique();
  }
  if (input.scopeKey === GLOBAL_SCOPE_KEY) return null;

  return await ctx.db
    .query("notificationPreferences")
    .withIndex("by_userId_and_category_and_scopeKey", (q) =>
      q.eq("userId", input.userId).eq("category", input.category).eq("scopeKey", GLOBAL_SCOPE_KEY),
    )
    .unique();
}

export function preferenceAllowsPush(preference: Awaited<ReturnType<typeof resolveNotificationPreference>>) {
  return !!preference && preferenceIsOn(preference) && (preference.level === "PUSH" || preference.level === "TIME_SENSITIVE");
}
