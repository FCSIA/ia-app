import { Migrations } from "@convex-dev/migrations";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import { countFlexSessions } from "./counts";

const migrations = new Migrations<DataModel>(components.migrations);

/**
 * Fill in `flexFridays.sessionCount` for Fridays written before the counter
 * existed.
 *
 * The Flex Friday list falls back to counting sessions when the field is
 * missing, so the numbers are correct either way — this backfill is what stops
 * the tab reading every session row of all fifty listed Fridays on load.
 *
 *   direnv exec . pnpm --filter cvx exec convex run flexFriday/migrations:backfillFlexSessionCount
 */
export const backfillFlexSessionCount = migrations.define({
  table: "flexFridays",
  batchSize: 50,
  migrateOne: async (ctx, friday) => {
    if (friday.sessionCount !== undefined) return;
    return { sessionCount: await countFlexSessions(ctx, friday._id) };
  },
});
