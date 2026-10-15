import { Migrations } from "@convex-dev/migrations";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";

const migrations = new Migrations<DataModel>(components.migrations);

/**
 * Populate the receipt-reconciliation keys on historic message deliveries.
 * Missing source messages are deliberately left untouched: a deleted or
 * orphaned delivery cannot be safely attributed to a channel read boundary.
 */
export const backfillChannelDeliveryMetadata = migrations.define({
  table: "notificationDeliveries",
  batchSize: 25,
  migrateOne: async (ctx, delivery) => {
    if (
      delivery.channelId !== undefined &&
      delivery.sourceCreatedAt !== undefined
    )
      return;
    if (delivery.subject.kind !== "clubMessage") return;
    const message = await ctx.db.get(delivery.subject.messageId);
    if (!message) return;
    return {
      channelId: delivery.subject.channelId,
      sourceCreatedAt: message.createdAt,
    };
  },
});
