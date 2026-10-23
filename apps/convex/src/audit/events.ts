import { mergedStream, stream } from "convex-helpers/server/stream";
import schema from "../schema";
import { AUDIT_ACTIONS, AUDIT_CATEGORIES, AUDIT_ENTITY_TYPES, auditEntityKey, auditCategory, isFlexAudit, type AuditCategory } from "../../../shared/audit";
import { auditByActor, auditByCategory, auditIndexReady } from "./_aggregates";
import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  getMaybeCurrentAppUser,
  requireAnyRoleSafe,
} from "../../lib/currentUser";
import {
  auditEventValidator,
  auditPageValidator,
  auditEventSerializer,
  toAuditEvent,
  toAuditEvents,
} from "./_lib";

import { auditFilters, auditMatcher } from "./_filters";

const auditFilterOptionsValidator = v.object({
  actions: v.array(v.string()),
  entityTypes: v.array(v.string()),
});

const entityPreviewValidator = v.object({
  kind: v.string(),
  title: v.string(),
  subtitle: v.union(v.string(), v.null()),
  body: v.union(v.string(), v.null()),
  href: v.union(v.string(), v.null()),
  hrefLabel: v.union(v.string(), v.null()),
  fields: v.array(v.object({ label: v.string(), value: v.string() })),
});

function metaRecord(meta: unknown): Record<string, unknown> {
  return typeof meta === "object" && meta !== null && !Array.isArray(meta)
    ? (meta as Record<string, unknown>)
    : {};
}

function whiteboardHref(
  clubId: Id<"clubs">,
  channelId: Id<"clubChannels">,
  boardId: Id<"clubWhiteboards">,
) {
  return `/clubs/${clubId}/channels/${channelId}?view=whiteboard&board=${boardId}`;
}

/** Resolves the current context of whiteboard audit rows for reviewers. */
async function resolveEntityPreview(ctx: QueryCtx, row: Doc<"auditEvents">) {
  if (row.entityType !== "ClubWhiteboard" || !row.entityId) return null;
  const boardId = ctx.db.normalizeId("clubWhiteboards", row.entityId);
  const board = boardId ? await ctx.db.get(boardId) : null;
  if (!board) return null;
  const [club, channel] = await Promise.all([
    ctx.db.get(board.clubId),
    ctx.db.get(board.channelId),
  ]);
  const meta = metaRecord(row.meta);
  const changes = Array.isArray(meta.changes) ? meta.changes : [];
  const text = changes
    .map((change) => metaRecord(change).textPreview)
    .filter(
      (value): value is string =>
        typeof value === "string" && value.trim() !== "",
    )
    .join("\n");
  const count = (key: string) =>
    typeof meta[key] === "number" ? String(meta[key]) : "0";
  return {
    kind: "whiteboard",
    title: `“${board.title}”`,
    subtitle: [club?.name, channel ? `#${channel.name}` : "deleted channel"]
      .filter(Boolean)
      .join(" · "),
    body: text || null,
    href: channel
      ? whiteboardHref(board.clubId, board.channelId, board._id)
      : null,
    hrefLabel: channel ? "Open whiteboard" : null,
    fields:
      row.action === "CLUB_WHITEBOARD_EDITED" ||
      row.action === "CLUB_WHITEBOARD_RESTORED"
        ? [
            { label: "Created", value: count("created") },
            { label: "Updated", value: count("updated") },
            { label: "Deleted", value: count("deleted") },
            { label: "Restored", value: count("restored") },
          ]
        : [],
  };
}

export const list = query({
  args: { limit: v.optional(v.number()), ...auditFilters },
  returns: v.array(auditEventValidator),
  handler: async (ctx, args) => {
    const viewer = await getMaybeCurrentAppUser(ctx);
    if (
      !viewer ||
      !requireAnyRoleSafe(viewer, ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"])
    )
      return [];
    const matches = auditMatcher(args);
    const rows = await ctx.db
      .query("auditEvents")
      .withIndex("by_createdAt")
      .order("desc")
      .take(Math.min(Math.max(args.limit ?? 100, 1), 500));
    return (await toAuditEvents(ctx, rows)).filter(matches);
  },
});

export const listFilterOptions = query({
  args: {},
  returns: auditFilterOptionsValidator,
  handler: async (ctx) => {
    const viewer = await getMaybeCurrentAppUser(ctx);
    if (
      !viewer ||
      !requireAnyRoleSafe(viewer, ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"])
    )
      return { actions: [], entityTypes: [] };
    return {
      actions: Object.keys(AUDIT_ACTIONS).sort((a, b) => AUDIT_ACTIONS[a]!.label.localeCompare(AUDIT_ACTIONS[b]!.label)),
      entityTypes: AUDIT_ENTITY_TYPES.filter((type, index, types) => types.findIndex((candidate) => auditEntityKey(candidate) === auditEntityKey(type)) === index),
    };
  },
});

export const listPage = query({
  args: { paginationOpts: paginationOptsValidator, ...auditFilters },
  returns: auditPageValidator,
  handler: async (ctx, args) => {
    const viewer = await getMaybeCurrentAppUser(ctx);
    if (
      !viewer ||
      !requireAnyRoleSafe(viewer, ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"])
    )
      return { page: [], isDone: true, continueCursor: "" };
    const matches = auditMatcher(args);
    const db = stream(ctx.db, schema);
    const actorId = args.actorId ? ctx.db.normalizeId("users", args.actorId) : null;
    if (args.actorId && !actorId) return { page: [], isDone: true, continueCursor: "" };
    const ready = (await ctx.db.query("auditIndexState").withIndex("by_key", (q) => q.eq("key", "v1")).unique())?.ready;
    // Prefer exact identities/records; never page a global feed and then
    // discard a sparse batch in the browser. Legacy text filters remain supported.
    const source = actorId
      ? db.query("auditEvents").withIndex("by_actorId_and_createdAt", (q) => { const lower = args.startAt === undefined ? q.eq("actorId", actorId) : q.eq("actorId", actorId).gte("createdAt", args.startAt); return args.endAt === undefined ? lower : lower.lte("createdAt", args.endAt); })
      : args.entityType && args.recordId
        ? db.query("auditEvents").withIndex("by_entityType_and_entityId_and_createdAt", (q) => { const lower = args.startAt === undefined ? q.eq("entityType", args.entityType!).eq("entityId", args.recordId!) : q.eq("entityType", args.entityType!).eq("entityId", args.recordId!).gte("createdAt", args.startAt); return args.endAt === undefined ? lower : lower.lte("createdAt", args.endAt); })
        : args.category && args.category !== "general" && args.category !== "flex" && ready
          ? db.query("auditEvents").withIndex("by_category_and_createdAt", (q) => { const lower = args.startAt === undefined ? q.eq("category", args.category!) : q.eq("category", args.category!).gte("createdAt", args.startAt); return args.endAt === undefined ? lower : lower.lte("createdAt", args.endAt); })
          : args.action
            ? db.query("auditEvents").withIndex("by_action_and_createdAt", (q) => { const lower = args.startAt === undefined ? q.eq("action", args.action!) : q.eq("action", args.action!).gte("createdAt", args.startAt); return args.endAt === undefined ? lower : lower.lte("createdAt", args.endAt); })
            : args.entityType
              ? db.query("auditEvents").withIndex("by_entityType_and_createdAt", (q) => { const lower = args.startAt === undefined ? q.eq("entityType", args.entityType!) : q.eq("entityType", args.entityType!).gte("createdAt", args.startAt); return args.endAt === undefined ? lower : lower.lte("createdAt", args.endAt); })
              : db.query("auditEvents").withIndex("by_createdAt", (q) => { const lower = args.startAt === undefined ? q : q.gte("createdAt", args.startAt); return args.endAt === undefined ? lower : lower.lte("createdAt", args.endAt); });
    // Legacy lower-case and FLEX_* spellings remain queryable under one label.
    // Merge their ordered indexes before pagination rather than losing old rows.
    const aliases = args.entityType ? [...new Set([args.entityType, ...AUDIT_ENTITY_TYPES.filter((type) => auditEntityKey(type) === auditEntityKey(args.entityType!))])] : [];
    const actions = [...new Set(args.actions ?? [])];
    const categories = [...new Set(args.categories ?? [])];
    const ordered = aliases.length && !actorId
      ? mergedStream(aliases.map((type) => args.recordId
        ? db.query('auditEvents').withIndex('by_entityType_and_entityId_and_createdAt', (q) => { const lower = args.startAt === undefined ? q.eq('entityType', type).eq('entityId', args.recordId!) : q.eq('entityType', type).eq('entityId', args.recordId!).gte('createdAt', args.startAt); return args.endAt === undefined ? lower : lower.lte('createdAt', args.endAt); }).order('desc')
        : db.query('auditEvents').withIndex('by_entityType_and_createdAt', (q) => { const lower = args.startAt === undefined ? q.eq('entityType', type) : q.eq('entityType', type).gte('createdAt', args.startAt); return args.endAt === undefined ? lower : lower.lte('createdAt', args.endAt); }).order('desc')), ['createdAt'])
      : actions.length && !actorId
        ? mergedStream(actions.map((action) => db.query('auditEvents').withIndex('by_action_and_createdAt', (q) => { const lower = args.startAt === undefined ? q.eq('action', action) : q.eq('action', action).gte('createdAt', args.startAt); return args.endAt === undefined ? lower : lower.lte('createdAt', args.endAt); }).order('desc')), ['createdAt'])
        : categories.length && ready && !actorId
          ? mergedStream(categories.map((category) => db.query('auditEvents').withIndex('by_category_and_createdAt', (q) => { const lower = args.startAt === undefined ? q.eq('category', category) : q.eq('category', category).gte('createdAt', args.startAt); return args.endAt === undefined ? lower : lower.lte('createdAt', args.endAt); }).order('desc')), ['createdAt'])
          : source.order('desc');
    return ordered
      .filterWith(async (row) => (!args.action || row.action === args.action)
        && (!actions.length || actions.includes(row.action))
        && (!categories.length || categories.includes(auditCategory(row.entityType, row.action)))
        && (!args.entityType || auditEntityKey(row.entityType) === auditEntityKey(args.entityType))
        && (!args.recordId || row.entityId === args.recordId)
        && (!args.category || (args.category === 'general' || args.category === 'flex'
          ? isFlexAudit(row.entityType) === (args.category === 'flex')
          : auditCategory(row.entityType, row.action) === args.category)))
      .map(auditEventSerializer(ctx))
      .filterWith(async (row) => matches(row))
      .paginate({ ...args.paginationOpts, maximumRowsRead: 1000, maximumBytesRead: 4_000_000 });
  },
});

export const get = query({
  args: { auditEventId: v.id("auditEvents") },
  returns: v.union(
    v.object({
      ...auditEventValidator.fields,
      entityPreview: v.union(entityPreviewValidator, v.null()),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const viewer = await getMaybeCurrentAppUser(ctx);
    if (
      !viewer ||
      !requireAnyRoleSafe(viewer, ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"])
    )
      return null;
    const row = await ctx.db.get(args.auditEventId);
    if (!row) return null;
    return {
      ...(await toAuditEvent(ctx, row)),
      entityPreview: await resolveEntityPreview(ctx, row),
    };
  },
});

/** Counts remain unavailable until every historical row has been indexed. */
export const counts = query({
  args: auditFilters,
  returns: v.object({ total: v.union(v.number(), v.null()), exact: v.boolean(), byCategory: v.array(v.object({ category: v.string(), count: v.number() })) }),
  handler: async (ctx, args) => {
    const viewer = await getMaybeCurrentAppUser(ctx);
    if (!viewer || !requireAnyRoleSafe(viewer, ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"])) return { total: null, exact: false, byCategory: [] };
    if (!(await auditIndexReady(ctx))) return { total: null, exact: false, byCategory: [] };
    const byCategory = await Promise.all((Object.keys(AUDIT_CATEGORIES) as AuditCategory[]).map(async (category) => ({
      category,
      count: args.actorId
        ? await auditByActor.count(ctx, { namespace: args.actorId, bounds: {
          lower: { key: [category, args.startAt ?? -Number.MAX_VALUE], inclusive: true },
          upper: { key: [category, args.endAt ?? Number.MAX_VALUE], inclusive: true },
        } })
        : await auditByCategory.count(ctx, { namespace: category, bounds: {
          ...(args.startAt === undefined ? {} : { lower: { key: args.startAt, inclusive: true } }),
          ...(args.endAt === undefined ? {} : { upper: { key: args.endAt, inclusive: true } }),
        } }),
    })));
    const total = byCategory.filter((row) => (!args.categories?.length || args.categories.includes(row.category)) && (!args.category || (args.category === 'general' ? row.category !== 'flex-events' : args.category === 'flex' ? row.category === 'flex-events' : row.category === args.category))).reduce((sum, row) => sum + row.count, 0);
    const exact = !args.query && !args.advancedQuery && !args.actor && !args.action && !args.actions?.length && !args.entityType && !args.entityId && !args.recordId && !args.actorScope;
    return { total, exact, byCategory };
  },
});
