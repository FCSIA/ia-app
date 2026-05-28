import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser, requireAnyRole, requireAnyRoleSafe } from "../../lib/currentUser";
import {
  auditEventValidator,
  auditPageValidator,
  includes,
  matchesDateRange,
  toAuditEvent,
} from "./_lib";

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
    const viewer = await getMaybeCurrentAppUser(ctx);
    if (!viewer || !requireAnyRoleSafe(viewer, ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"])) {
      return [];
    }

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
    const viewer = await getMaybeCurrentAppUser(ctx);
    if (!viewer || !requireAnyRoleSafe(viewer, ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"])) {
      return {
        page: [],
        isDone: true,
        continueCursor: "",
      };
    }

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

export const get = query({
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
      actor: auditEventValidator.fields.actor,
      entityPreview: v.null(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const viewer = await getMaybeCurrentAppUser(ctx);
    if (!viewer || !requireAnyRoleSafe(viewer, ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"])) {
      return null;
    }

    const row = await ctx.db.get(args.auditEventId);
    if (!row) return null;
    const event = await toAuditEvent(ctx, row);
    return {
      ...event,
      entityPreview: null,
    };
  },
});
