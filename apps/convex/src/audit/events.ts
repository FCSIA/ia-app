import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, type QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { getCurrentAppUser, getMaybeCurrentAppUser, requireAnyRole, requireAnyRoleSafe } from "../../lib/currentUser";
import {
  auditEventValidator,
  auditPageValidator,
  includes,
  matchesDateRange,
  toAuditEvent,
  toAuditEvents,
} from "./_lib";

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
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
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
    href: channel ? whiteboardHref(board.clubId, board.channelId, board._id) : null,
    hrefLabel: channel ? "Open whiteboard" : null,
    fields:
      row.action === "CLUB_WHITEBOARD_EDITED" || row.action === "CLUB_WHITEBOARD_RESTORED"
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

    const hydrated = await toAuditEvents(ctx, rows);

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
            includes(event.actor?.preferredName, actorText) ||
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
            includes(event.actor?.preferredName, queryText) ||
          includes(event.actor?.uniqueId, queryText)
        )
      ) {
        return false;
      }
      return true;
    });
  },
});

export const listFilterOptions = query({
  args: {},
  returns: auditFilterOptionsValidator,
  handler: async (ctx) => {
    const viewer = await getMaybeCurrentAppUser(ctx);
    if (!viewer || !requireAnyRoleSafe(viewer, ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"])) {
      return { actions: [], entityTypes: [] };
    }

    // Deliberately avoids actor hydration and event metadata serialization.
    const rows = await ctx.db
      .query("auditEvents")
      .withIndex("by_createdAt")
      .order("desc")
      .take(500);
    return {
      actions: Array.from(new Set(rows.map((row) => row.action))).sort(),
      entityTypes: Array.from(new Set(rows.map((row) => row.entityType))).sort(),
    };
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

    const hydrated = await toAuditEvents(ctx, result.page);

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
            includes(event.actor?.preferredName, actorText) ||
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
            includes(event.actor?.preferredName, queryText) ||
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
      entityPreview: v.union(entityPreviewValidator, v.null()),
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
      entityPreview: await resolveEntityPreview(ctx, row),
    };
  },
});
