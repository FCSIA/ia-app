import { auditCategory, type AuditAction } from "../../../shared/audit";
import { auditByActor, auditByCategory } from "./_aggregates";
import { v } from "convex/values";
import { paginationResultValidator } from "convex/server";
import { auditContextResolver } from "./_context";
import { createDocLoader } from "../../lib/docLoader";
import { components } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const actorValidator = v.union(
  v.object({
    id: v.id("users"),
    firstName: v.string(),
    lastName: v.string(),
    preferredName: v.optional(v.string()),
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
  actorId: v.union(v.id("users"), v.null()),
  context: v.object({
    title: v.string(),
    subtitle: v.union(v.string(), v.null()),
    links: v.array(v.object({ id: v.string(), label: v.string(), name: v.string(), href: v.union(v.string(), v.null()) })),
    references: v.array(
      v.object({ id: v.string(), label: v.string(), name: v.string() }),
    ),
    /** The event's own record no longer exists (or was soft-deleted). */
    deleted: v.boolean(),
  }),
});

export const auditPageValidator = paginationResultValidator(auditEventValidator);

/** One serializer per response shares actor/context reads across streamed rows. */
export function auditEventSerializer(ctx: QueryCtx) {
  const loader = createDocLoader(ctx);
  const resolveContext = auditContextResolver(ctx);
  return async (event: Doc<"auditEvents">) => {
    const [actor, context] = await Promise.all([
      event.actorId ? loader.get(event.actorId) : null,
      resolveContext(event),
    ]);
    return {
      id: event._id,
      actorId: event.actorId ?? null,
      context,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      createdAt: new Date(event.createdAt).toISOString(),
      meta: event.meta ?? null,
      actor: actor ? {
        id: actor._id,
        firstName: actor.firstName,
        lastName: actor.lastName,
        preferredName: actor.preferredName,
        uniqueId: actor.uniqueId,
      } : null,
    };
  };
}
export async function toAuditEvent(ctx: QueryCtx, event: Doc<"auditEvents">) {
  return await auditEventSerializer(ctx)(event);
}
export async function toAuditEvents(ctx: QueryCtx, events: Doc<"auditEvents">[]) {
  return await Promise.all(events.map(auditEventSerializer(ctx)));
}

export async function logAuditEvent(
  ctx: MutationCtx,
  input: {
    actorId: Id<"users"> | "system";
    action: AuditAction;
    entityType: string;
    entityId?: string;
    meta?: unknown;
  },
) {
  // Better Auth keeps the original administrator on an impersonated session.
  // Preserve that provenance on every application audit event while retaining
  // the effective user as `actorId`, which reflects the permissions used.
  let meta = input.actorId === 'system'
    ? { ...(isRecord(input.meta) ? input.meta : input.meta === undefined ? {} : { originalMeta: input.meta }), auditSource: 'system' }
    : input.meta;
  const identity = await ctx.auth.getUserIdentity();
  if (identity?.sessionId) {
    const session = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "session",
      where: [{ field: "_id", value: identity.sessionId as string }],
    })) as { impersonatedBy?: string | null } | null;
    if (session?.impersonatedBy) {
      const impersonator = await ctx.db
        .query("users")
        .withIndex("by_authUserId", (q) =>
          q.eq("authUserId", session.impersonatedBy!),
        )
        .unique();
      if (impersonator) {
        meta = {
          ...(isRecord(meta) ? meta : meta === undefined ? {} : { originalMeta: meta }),
          impersonatedByUserId: impersonator._id,
        };
      }
    }
  }
  const id = await ctx.db.insert("auditEvents", {
    actorId: input.actorId === "system" ? undefined : input.actorId,
    category: auditCategory(input.entityType, input.action),
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    meta,
    createdAt: Date.now(),
  });
  const doc = (await ctx.db.get(id))!;
  await auditByCategory.insert(ctx, doc);
  await auditByActor.insert(ctx, doc);
  return id;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
