import { Migrations } from "@convex-dev/migrations";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";

const migrations = new Migrations<DataModel>(components.migrations);

/**
 * Remove `events.isInactive` and `events.deactivatedAt`. Nothing reads them:
 * an event's lifecycle is `status` alone. The staged validator also drops the
 * DRAFT and APPROVED statuses, which no application code ever writes, so this
 * migration does not rewrite them; if a stored row ever had one, the staged
 * validation reports it as failed instead of validated.
 *
 *   cd apps/convex && npx convex run events/migrations:dropUnusedLifecycleFields
 */
export const dropUnusedLifecycleFields = migrations.define({
  table: "events",
  batchSize: 200,
  migrateOne: (_ctx, event) => {
    if (event.isInactive === undefined && event.deactivatedAt === undefined) return;
    return { isInactive: undefined, deactivatedAt: undefined };
  },
});
