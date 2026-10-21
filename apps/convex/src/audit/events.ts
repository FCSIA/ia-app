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
    // Suggestions only; advanced search accepts older and future action/type codes too.
    const rows = await ctx.db
      .query("auditEvents")
      .withIndex("by_createdAt")
      .order("desc")
      .take(500);
    return {
      actions: Array.from(new Set(rows.map((row) => row.action))).sort(),
      entityTypes: Array.from(
        new Set(rows.map((row) => row.entityType)),
      ).sort(),
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
    // Date controls use the browser's local day boundaries, then range the index.
    const result = await ctx.db
      .query("auditEvents")
      .withIndex("by_createdAt", (q) => {
        const lower =
          args.startAt === undefined ? q : q.gte("createdAt", args.startAt);
        return args.endAt === undefined
          ? lower
          : lower.lte("createdAt", args.endAt);
      })
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: (await toAuditEvents(ctx, result.page)).filter(matches),
    };
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
