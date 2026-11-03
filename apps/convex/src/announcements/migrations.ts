import { Migrations } from "@convex-dev/migrations";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";

const migrations = new Migrations<DataModel>(components.migrations);

/**
 * Fill in `announcements.commentCount` for rows written before the counter
 * existed.
 *
 * Serialization falls back to counting comments when the field is missing, so
 * the feed is correct either way — this backfill is what lets it stop reading
 * every comment body on every load.
 *
 *   direnv exec . pnpm --filter cvx exec convex run announcements/migrations:backfillCommentCount
 */
export const backfillCommentCount = migrations.define({
  table: "announcements",
  batchSize: 50,
  migrateOne: async (ctx, announcement) => {
    if (announcement.commentCount !== undefined) return;
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_announcementId", (q) => q.eq("announcementId", announcement._id))
      .collect();
    return { commentCount: comments.length };
  },
});

/**
 * Retire the stored EXPIRED status. An announcement is expired when it is
 * ACTIVE and its `expiresAt` has passed, so EXPIRED rows become ACTIVE with an
 * expiry in the past. Once this has run, the staged validator in the schema
 * reports `announcements` as validated and EXPIRED can leave the schema.
 *
 *   cd apps/convex && npx convex run announcements/migrations:retireExpiredStatus
 */
export const retireExpiredStatus = migrations.define({
  table: "announcements",
  batchSize: 100,
  migrateOne: (_ctx, announcement) => {
    if (announcement.status !== "EXPIRED") return;
    // Keep a real past expiry; otherwise expire it now so it stays expired.
    const now = Date.now();
    const expiresAt =
      announcement.expiresAt !== undefined && announcement.expiresAt <= now
        ? announcement.expiresAt
        : now;
    return { status: "ACTIVE" as const, expiresAt };
  },
});
