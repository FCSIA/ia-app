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
