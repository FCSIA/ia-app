import { Migrations } from "@convex-dev/migrations";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import schema from "../schema";

const migrations = new Migrations<DataModel, typeof schema>(components.migrations, { schema });

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
 * Convert the legacy stored expiry status to the same representation used by
 * live announcements. Run this before removing EXPIRED from the schema.
 *
 *   bun run --cwd apps/convex convex run --deployment local \
 *     announcements/migrations:normalizeExpiredStatus '{"dryRun":true}'
 */
export const normalizeExpiredStatus = migrations.define({
  table: "announcements",
  customRange: (query) =>
    query.withIndex("by_status", (q) => q.eq("status", "EXPIRED")),
  batchSize: 50,
  migrateOne: async (_ctx, announcement) => ({
    status: "ACTIVE" as const,
    expiresAt: Math.min(
      announcement.expiresAt ?? announcement.createdAt,
      Date.now() - 1,
    ),
  }),
});
