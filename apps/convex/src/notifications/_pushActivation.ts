import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { NotificationCategory } from "../validators";

const pushDefaultCategories: NotificationCategory[] = [
  "SCHOOL_ANNOUNCEMENT",
  "CLUB_ANNOUNCEMENT",
  "CLUB_JOIN_REQUEST",
  "CLUB_CHANNEL_MENTION",
  "CLUB_CHANNEL_TAG_MENTION",
  "CLUB_CHANNEL_THREAD",
  "EVENT",
  "FLEX_FRIDAY",
  "CONTENT_MODERATED",
  "FRIEND_REQUEST",
  "FRIEND_SCHEDULE_CHANGE",
];

const maxScopedPreferencesPerCategory = 50;

export function preferenceNeedsPushUpgrade(
  preference: Pick<Doc<"notificationPreferences">, "enabled" | "level">,
) {
  return preference.enabled
    && preference.level !== "OFF"
    && preference.level !== "PUSH"
    && preference.level !== "TIME_SENSITIVE";
}

export async function activatePushPreferences(
  ctx: MutationCtx,
  userId: Id<"users">,
  now = Date.now(),
) {
  let updated = 0;

  for (const category of pushDefaultCategories) {
    const globalPreference = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId_and_category_and_scopeKey", (q) =>
        q.eq("userId", userId).eq("category", category).eq("scopeKey", "global"),
      )
      .unique();

    // A global OFF preference is an explicit opt-out and wins over a
    // device-level opt-in for the whole category.
    if (globalPreference?.enabled === false || globalPreference?.level === "OFF") {
      continue;
    }

    if (!globalPreference) {
      await ctx.db.insert("notificationPreferences", {
        userId,
        category,
        enabled: true,
        level: "PUSH",
        locked: false,
        scopeKey: "global",
        createdAt: now,
        updatedAt: now,
      });
      updated++;
    } else if (preferenceNeedsPushUpgrade(globalPreference)) {
      await ctx.db.patch(globalPreference._id, {
        level: "PUSH",
        updatedAt: now,
      });
      updated++;
    }

    const scopedPreferences = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_userId_and_category_and_scopeKey", (q) =>
        q.eq("userId", userId).eq("category", category),
      )
      .take(maxScopedPreferencesPerCategory);

    for (const preference of scopedPreferences) {
      if (preference.scopeKey === "global" || !preferenceNeedsPushUpgrade(preference)) {
        continue;
      }
      await ctx.db.patch(preference._id, {
        level: "PUSH",
        updatedAt: now,
      });
      updated++;
    }
  }

  return updated;
}
