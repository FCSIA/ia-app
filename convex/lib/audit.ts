import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function logAuditEvent(
  ctx: MutationCtx,
  input: {
    actorId?: Id<"users">;
    action: string;
    entityType: string;
    entityId?: string;
    meta?: unknown;
  },
) {
  await ctx.db.insert("auditEvents", {
    actorId: input.actorId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    meta: input.meta,
    createdAt: Date.now(),
  });
}
