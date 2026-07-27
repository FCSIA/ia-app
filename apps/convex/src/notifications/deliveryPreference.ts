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
