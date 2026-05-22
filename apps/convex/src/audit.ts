import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import type { Doc } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";
import { getCurrentAppUser, requireAnyRole } from "./lib/currentUser";

const actorValidator = v.union(
  v.object({
    id: v.id("users"),
    firstName: v.string(),
    lastName: v.string(),
    uniqueId: v.string(),
  }),
  v.null(),
);

const auditEventValidator = v.object({
  id: v.id("auditEvents"),
  action: v.string(),
  entityType: v.string(),
  entityId: v.union(v.string(), v.null()),
  createdAt: v.string(),
  meta: v.union(v.any(), v.null()),
  actor: actorValidator,
});

const auditPageValidator = v.object({
  page: v.array(auditEventValidator),
  isDone: v.boolean(),
  continueCursor: v.string(),
  pageStatus: v.optional(v.union(v.literal("SplitRecommended"), v.literal("SplitRequired"), v.null())),
  splitCursor: v.optional(v.union(v.string(), v.null())),
});

async function toAuditEvent(ctx: QueryCtx, event: Doc<"auditEvents">) {
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

function includes(value: string | null | undefined, needle: string) {
  return value?.toLowerCase().includes(needle) ?? false;
}

function matchesDateRange(
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

export const list = query({
  args: {
    limit: v.optional(v.number()),
    query: v.optional(v.string()),
    actor: v.optional(v.string()),
    entityId: v.optional(v.string()),
    action: v.optional(v.string()),
    entityType: v.optional(v.string()),
    actorScope: v.optional(v.union(v.literal("USER"), v.literal("SYSTEM"))),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  returns: v.array(auditEventValidator),
  handler: async (ctx, args) => {
    const viewer = await getCurrentAppUser(ctx);
    requireAnyRole(viewer, ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"]);

    const limit = Math.min(Math.max(args.limit ?? 100, 1), 500);
    const queryText = args.query?.trim().toLowerCase();
    const actorText = args.actor?.trim().toLowerCase();
    const entityIdText = args.entityId?.trim().toLowerCase();

    const rows = await ctx.db
      .query("auditEvents")
      .withIndex("by_createdAt")
      .order("desc")
      .take(limit);

    const hydrated = await Promise.all(rows.map((row) => toAuditEvent(ctx, row)));

    return hydrated.filter((event) => {
      if (args.action && event.action !== args.action) return false;
      if (args.entityType && event.entityType !== args.entityType) return false;
      if (args.actorScope === "SYSTEM" && event.actor) return false;
      if (args.actorScope === "USER" && !event.actor) return false;
      if (!matchesDateRange(Date.parse(event.createdAt), args.startDate, args.endDate)) {
        return false;
      }
      if (entityIdText && !includes(event.entityId, entityIdText)) return false;
      if (
        actorText &&
        !(
          includes(event.actor?.firstName, actorText) ||
          includes(event.actor?.lastName, actorText) ||
          includes(event.actor?.uniqueId, actorText)
        )
      ) {
        return false;
      }
      if (
        queryText &&
        !(
          includes(event.action, queryText) ||
          includes(event.entityType, queryText) ||
          includes(event.entityId, queryText) ||
          includes(event.actor?.firstName, queryText) ||
          includes(event.actor?.lastName, queryText) ||
          includes(event.actor?.uniqueId, queryText)
        )
      ) {
        return false;
      }
      return true;
    });
  },
});

export const listPage = query({
  args: {
    paginationOpts: paginationOptsValidator,
    query: v.optional(v.string()),
    actor: v.optional(v.string()),
    entityId: v.optional(v.string()),
    action: v.optional(v.string()),
    entityType: v.optional(v.string()),
    actorScope: v.optional(v.union(v.literal("USER"), v.literal("SYSTEM"))),
    startDate: v.optional(v.string()),
    endDate: v.optional(v.string()),
  },
  returns: auditPageValidator,
  handler: async (ctx, args) => {
    const viewer = await getCurrentAppUser(ctx);
    requireAnyRole(viewer, ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"]);

    const queryText = args.query?.trim().toLowerCase();
    const actorText = args.actor?.trim().toLowerCase();
    const entityIdText = args.entityId?.trim().toLowerCase();

    const result = await ctx.db
      .query("auditEvents")
      .withIndex("by_createdAt")
      .order("desc")
      .paginate(args.paginationOpts);

    const hydrated = await Promise.all(result.page.map((row) => toAuditEvent(ctx, row)));

    return {
      ...result,
      page: hydrated.filter((event) => {
        if (args.action && event.action !== args.action) return false;
        if (args.entityType && event.entityType !== args.entityType) return false;
        if (args.actorScope === "SYSTEM" && event.actor) return false;
        if (args.actorScope === "USER" && !event.actor) return false;
        if (!matchesDateRange(Date.parse(event.createdAt), args.startDate, args.endDate)) {
          return false;
        }
        if (entityIdText && !includes(event.entityId, entityIdText)) return false;
        if (
          actorText &&
          !(
            includes(event.actor?.firstName, actorText) ||
            includes(event.actor?.lastName, actorText) ||
            includes(event.actor?.uniqueId, actorText)
          )
        ) {
          return false;
        }
        if (
          queryText &&
          !(
            includes(event.action, queryText) ||
            includes(event.entityType, queryText) ||
            includes(event.entityId, queryText) ||
            includes(event.actor?.firstName, queryText) ||
            includes(event.actor?.lastName, queryText) ||
            includes(event.actor?.uniqueId, queryText)
          )
        ) {
          return false;
        }
        return true;
      }),
    };
  },
});

export const getOne = query({
  args: {
    auditEventId: v.id("auditEvents"),
  },
  returns: v.union(
    v.object({
      id: v.id("auditEvents"),
      action: v.string(),
      entityType: v.string(),
      entityId: v.union(v.string(), v.null()),
      createdAt: v.string(),
      meta: v.union(v.any(), v.null()),
      actor: actorValidator,
      entityPreview: v.null(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const viewer = await getCurrentAppUser(ctx);
    requireAnyRole(viewer, ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"]);

    const row = await ctx.db.get(args.auditEventId);
    if (!row) return null;
    const event = await toAuditEvent(ctx, row);
    return {
      ...event,
      entityPreview: null,
    };
  },
});
