import { Migrations } from "@convex-dev/migrations";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import { countClubChannels, countClubMembers } from "./counts";

const migrations = new Migrations<DataModel>(components.migrations);

/**
 * Fill in `clubs.memberCount` and `clubs.channelCount` for clubs written before
 * the counters existed.
 *
 * Club summaries fall back to counting the rows when a counter is missing, so
 * the numbers are correct either way — this backfill is what lets an admin open
 * the clubs tab without reading the whole membership table.
 *
 *   npx convex run clubs/migrations:backfillClubCounts
 */
export const backfillClubCounts = migrations.define({
  table: "clubs",
  batchSize: 20,
  migrateOne: async (ctx, club) => {
    if (club.memberCount !== undefined && club.channelCount !== undefined) return;
    const [memberCount, channelCount] = await Promise.all([
      countClubMembers(ctx, club._id),
      countClubChannels(ctx, club._id),
    ]);
    return { memberCount, channelCount };
  },
});
