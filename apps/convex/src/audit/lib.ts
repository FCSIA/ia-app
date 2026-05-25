import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const actorValidator = v.union(
  v.object({
    id: v.id("users"),
    firstName: v.string(),
    lastName: v.string(),
    uniqueId: v.string(),
  }),
  v.null(),
);

export const auditEventValidator = v.object({
  id: v.id("auditEvents"),
  action: v.string(),
  entityType: v.string(),
  entityId: v.union(v.string(), v.null()),
  createdAt: v.string(),
  meta: v.union(v.any(), v.null()),
  actor: actorValidator,
});

export const auditPageValidator = v.object({
  page: v.array(auditEventValidator),
  isDone: v.boolean(),
  continueCursor: v.string(),
  pageStatus: v.optional(v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null())),
  splitCursor: v.optional(v.union(v.string(), v.null())),
});

export async function toAuditEvent(ctx: QueryCtx, event: Doc<"auditEvents">) {
  const actor = event.actorId ? await ctx.db.get(event.actorId) : null;

  return {
    id: event._id,
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId ?? null,
    createdAt: new Date(event.createdAt).toISOString(),
    meta: event.meta ?? null,
    actor: actor
      ? {
          id: actor._id,
          firstName: actor.firstName,
          lastName: actor.lastName,
          uniqueId: actor.uniqueId,
        }
      : null,
  };
}

export function includes(value: string | null | undefined, needle: string) {
  return value?.toLowerCase().includes(needle) ?? false;
}

export function matchesDateRange(
  createdAt: number,
  startDate?: string,
  endDate?: string,
) {
  const start = startDate ? Date.parse(`${startDate}T00:00:00.000`) : null;
  const end = endDate ? Date.parse(`${endDate}T23:59:59.999`) : null;
  return (
    (start == null || Number.isNaN(start) || createdAt >= start) &&
    (end == null || Number.isNaN(end) || createdAt <= end)
  );
}

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
