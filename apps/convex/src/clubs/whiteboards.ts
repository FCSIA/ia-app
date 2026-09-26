import { ConvexError, v } from "convex/values";
import {
  paginationOptsValidator,
  paginationResultValidator,
  type PaginationOptions,
} from "convex/server";
import { internal } from "../_generated/api";
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  getCurrentAppUser,
  getMaybeCurrentAppUser,
  requireAnyRoleSafe,
} from "../../lib/currentUser";
import { logAuditEvent } from "../audit/_lib";
import { contentRateLimiter } from "../rateLimits";
import { getChannelViewerContext } from "./access";
import { getChannelAccess } from "./channelAccess";
import {
  MAX_WHITEBOARD_LIVE_ELEMENTS,
  WHITEBOARD_CHANGE_PAGE_SIZE,
  assertWhiteboardSaveBounds,
  assertWhiteboardThumbnail,
  classifyWhiteboardChange,
  liveElementDelta,
  normalizeWhiteboardTitle,
  planWhiteboardRestore,
  sanitizeWhiteboardElement,
  shouldAcceptWhiteboardWrite,
  shouldCoalesceWhiteboardRevision,
  whiteboardEditAuditMeta,
  type SanitizedWhiteboardElement,
  type WhiteboardAuditChange,
} from "./whiteboardElements";

type WhiteboardDbCtx = QueryCtx | MutationCtx;

/** Roles that review audit rows may also inspect audited board snapshots. */
const WHITEBOARD_REVIEW_ROLES = ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"] as const;
const MAX_BOARDS_PER_CHANNEL = 100;
const MAX_ACTIVE_VIEWERS_COUNTED = 20;
const MAX_CURSORS = 50;
/** Skip cursor writes that arrive faster than the client throttle intends. */
const MIN_CURSOR_WRITE_INTERVAL_MS = 80;
const MIN_THUMBNAIL_INTERVAL_MS = 3_000;
const MAX_SNAPSHOT_HISTORY_ROWS = 8_000;
const MAX_SNAPSHOT_BYTES = 8_000_000;
const MAX_RESTORE_SCAN_ROWS = 10_000;
const MAX_RESTORE_WRITES = 3_000;
const CLEANUP_BATCH_SIZE = 200;

// ── Access ──────────────────────────────────────────────────────────────

/**
 * A whiteboard belongs to its channel and is never narrower than it: anyone
 * who can read the channel can open and edit every board in it, including
 * read-only channel members, and admins through their elevated channel access.
 */
async function getWhiteboardChannel(
  ctx: WhiteboardDbCtx,
  user: Doc<"users">,
  channelId: Id<"clubChannels">,
) {
  const channel = await ctx.db.get(channelId);
  if (!channel) return null;
  const club = await ctx.db.get(channel.clubId);
  if (!club || !club.isActive) return null;
  const context = await getChannelViewerContext(ctx, club, user);
  const access = await getChannelAccess(ctx, channel, context, user._id);
  if (!access.canView) return null;
  return { channel, club };
}

async function getWhiteboardForUser(
  ctx: WhiteboardDbCtx,
  user: Doc<"users">,
  boardId: Id<"clubWhiteboards">,
) {
  const board = await ctx.db.get(boardId);
  if (!board) return null;
  const resolved = await getWhiteboardChannel(ctx, user, board.channelId);
  if (!resolved) return null;
  return { board, ...resolved };
}

async function requireEditableBoard(
  ctx: MutationCtx,
  user: Doc<"users">,
  boardId: Id<"clubWhiteboards">,
) {
  const resolved = await getWhiteboardForUser(ctx, user, boardId);
  if (!resolved) throw new ConvexError("Not authorized");
  if (resolved.board.isArchived) {
    throw new ConvexError("This whiteboard is archived. Restore it to keep editing.");
  }
  return resolved;
}

async function limitManagement(ctx: MutationCtx, user: Doc<"users">) {
  const rate = await contentRateLimiter.limit(ctx, "whiteboardManagementByUser", {
    key: user._id,
  });
  if (!rate.ok) throw new ConvexError("Too many whiteboard changes. Try again shortly.");
}

async function userNames(ctx: WhiteboardDbCtx, ids: Array<Id<"users"> | undefined>) {
  const unique = Array.from(new Set(ids.filter((id): id is Id<"users"> => !!id)));
  const users = await Promise.all(unique.map((id) => ctx.db.get(id)));
  return new Map(
    unique.map((id, index) => {
      const user = users[index];
      return [id, user ? `${user.firstName} ${user.lastName}`.trim() : "Former member"];
    }),
  );
}

// ── Board lifecycle ─────────────────────────────────────────────────────

const ACTIVE_LIMIT_MESSAGE = `A channel can have ${MAX_BOARDS_PER_CHANNEL} active whiteboards. Archive one first.`;

export async function getWhiteboardCounts(
  ctx: WhiteboardDbCtx,
  channelId: Id<"clubChannels">,
) {
  const row = await ctx.db
    .query("clubWhiteboardChannelCounts")
    .withIndex("by_channelId", (q) => q.eq("channelId", channelId))
    .unique();
  return { active: row?.active ?? 0, archived: row?.archived ?? 0 };
}

async function adjustWhiteboardCounts(
  ctx: MutationCtx,
  channelId: Id<"clubChannels">,
  delta: { active?: number; archived?: number },
) {
  const row = await ctx.db
    .query("clubWhiteboardChannelCounts")
    .withIndex("by_channelId", (q) => q.eq("channelId", channelId))
    .unique();
  const next = {
    active: Math.max(0, (row?.active ?? 0) + (delta.active ?? 0)),
    archived: Math.max(0, (row?.archived ?? 0) + (delta.archived ?? 0)),
  };
  if (row) await ctx.db.patch(row._id, next);
  else await ctx.db.insert("clubWhiteboardChannelCounts", { channelId, ...next });
}

export async function createWhiteboard(
  ctx: MutationCtx,
  user: Doc<"users">,
  channelId: Id<"clubChannels">,
  input: { title?: string; duplicatedFromBoardId?: Id<"clubWhiteboards"> } = {},
) {
  const resolved = await getWhiteboardChannel(ctx, user, channelId);
  if (!resolved) throw new ConvexError("Not authorized");
  const counts = await getWhiteboardCounts(ctx, channelId);
  if (counts.active >= MAX_BOARDS_PER_CHANNEL) throw new ConvexError(ACTIVE_LIMIT_MESSAGE);
  if (input.duplicatedFromBoardId) {
    const source = await ctx.db.get(input.duplicatedFromBoardId);
    if (!source || source.channelId !== channelId) {
      throw new ConvexError("Whiteboard not found");
    }
  }
  const now = Date.now();
  const title = normalizeWhiteboardTitle(input.title);
  const boardId = await ctx.db.insert("clubWhiteboards", {
    clubId: resolved.channel.clubId,
    channelId,
    title,
    seq: 0,
    liveElementCount: 0,
    createdById: user._id,
    createdAt: now,
    updatedAt: now,
    updatedById: user._id,
    isArchived: false,
  });
  await adjustWhiteboardCounts(ctx, channelId, { active: 1 });
  if (input.duplicatedFromBoardId) {
    // A copy starts with the source's preview until someone edits it.
    const thumbnail = await ctx.db
      .query("clubWhiteboardThumbnails")
      .withIndex("by_boardId", (q) => q.eq("boardId", input.duplicatedFromBoardId!))
      .unique();
    if (thumbnail) {
      await ctx.db.insert("clubWhiteboardThumbnails", {
        boardId,
        dataUrl: thumbnail.dataUrl,
        updatedAt: now,
      });
    }
  }
  await logAuditEvent(ctx, {
    actorId: user._id,
    action: "CLUB_WHITEBOARD_CREATED",
    entityType: "ClubWhiteboard",
    entityId: boardId,
    meta: {
      clubId: resolved.channel.clubId,
      channelId,
      boardId,
      title,
      duplicatedFromBoardId: input.duplicatedFromBoardId ?? null,
    },
  });
  return boardId;
}

export async function renameWhiteboard(
  ctx: MutationCtx,
  user: Doc<"users">,
  boardId: Id<"clubWhiteboards">,
  rawTitle: string,
) {
  const { board } = await requireEditableBoard(ctx, user, boardId);
  const title = normalizeWhiteboardTitle(rawTitle);
  if (title === board.title) return null;
  await ctx.db.patch(board._id, { title });
  await logAuditEvent(ctx, {
    actorId: user._id,
    action: "CLUB_WHITEBOARD_RENAMED",
    entityType: "ClubWhiteboard",
    entityId: board._id,
    meta: {
      clubId: board.clubId,
      channelId: board.channelId,
      boardId: board._id,
      previousTitle: board.title,
      title,
    },
  });
  return null;
}

export async function setWhiteboardArchived(
  ctx: MutationCtx,
  user: Doc<"users">,
  boardId: Id<"clubWhiteboards">,
  archived: boolean,
) {
  const resolved = await getWhiteboardForUser(ctx, user, boardId);
  if (!resolved) throw new ConvexError("Not authorized");
  const { board } = resolved;
  if (board.isArchived === archived) return null;
  if (!archived) {
    const counts = await getWhiteboardCounts(ctx, board.channelId);
    if (counts.active >= MAX_BOARDS_PER_CHANNEL) throw new ConvexError(ACTIVE_LIMIT_MESSAGE);
  }
  await ctx.db.patch(board._id, {
    isArchived: archived,
    archivedAt: archived ? Date.now() : undefined,
    archivedById: archived ? user._id : undefined,
  });
  await adjustWhiteboardCounts(ctx, board.channelId, {
    active: archived ? -1 : 1,
    archived: archived ? 1 : -1,
  });
  await logAuditEvent(ctx, {
    actorId: user._id,
    action: archived ? "CLUB_WHITEBOARD_ARCHIVED" : "CLUB_WHITEBOARD_UNARCHIVED",
    entityType: "ClubWhiteboard",
    entityId: board._id,
    meta: {
      clubId: board.clubId,
      channelId: board.channelId,
      boardId: board._id,
      title: board.title,
    },
  });
  return null;
}

// ── Element writes ──────────────────────────────────────────────────────

/**
 * The single write path for element changes. Accepts only writes that win
 * Excalidraw's version rule, assigns board sequence numbers, appends history,
 * maintains the member-facing revision log, and audits the save.
 */
async function applyElementWrites(
  ctx: MutationCtx,
  user: Doc<"users">,
  board: Doc<"clubWhiteboards">,
  elements: Iterable<SanitizedWhiteboardElement>,
  kind: "EDIT" | "RESTORE",
  restoredToSeq?: number,
) {
  const now = Date.now();
  const fromSeq = board.seq + 1;
  let seq = board.seq;
  let liveElementCount = board.liveElementCount;
  const changes: WhiteboardAuditChange[] = [];

  for (const element of elements) {
    const existing = await ctx.db
      .query("clubWhiteboardElements")
      .withIndex("by_boardId_and_elementId", (q) =>
        q.eq("boardId", board._id).eq("elementId", element.elementId),
      )
      .unique();
    if (!shouldAcceptWhiteboardWrite(existing, element)) continue;

    liveElementCount += liveElementDelta(existing, element);
    if (liveElementCount > MAX_WHITEBOARD_LIVE_ELEMENTS) {
      throw new ConvexError("This whiteboard is full");
    }
    seq += 1;
    const row = {
      seq,
      version: element.version,
      versionNonce: element.versionNonce,
      isDeleted: element.isDeleted,
      data: element.data,
      updatedById: user._id,
      updatedAt: now,
    };
    if (existing) {
      await ctx.db.patch(existing._id, row);
    } else {
      await ctx.db.insert("clubWhiteboardElements", {
        boardId: board._id,
        elementId: element.elementId,
        ...row,
      });
    }
    await ctx.db.insert("clubWhiteboardHistory", {
      boardId: board._id,
      seq,
      elementId: element.elementId,
      isDeleted: element.isDeleted,
      data: element.data,
      actorId: user._id,
      createdAt: now,
    });
    changes.push({
      elementId: element.elementId,
      type: element.type,
      change: classifyWhiteboardChange(existing, element),
      ...(element.text !== null ? { textPreview: element.text } : {}),
    });
  }

  if (changes.length === 0) return changes;

  await ctx.db.patch(board._id, {
    seq,
    liveElementCount,
    updatedAt: now,
    updatedById: user._id,
  });

  const meta = whiteboardEditAuditMeta({
    clubId: board.clubId,
    channelId: board.channelId,
    boardId: board._id,
    fromSeq,
    toSeq: seq,
    changes,
  });
  const lastRevision = await ctx.db
    .query("clubWhiteboardRevisions")
    .withIndex("by_boardId_and_toSeq", (q) => q.eq("boardId", board._id))
    .order("desc")
    .first();
  if (
    lastRevision &&
    shouldCoalesceWhiteboardRevision(lastRevision, {
      kind,
      actorId: user._id,
      now,
      deleted: meta.deleted,
    })
  ) {
    await ctx.db.patch(lastRevision._id, {
      toSeq: seq,
      created: lastRevision.created + meta.created,
      updated: lastRevision.updated + meta.updated,
      deleted: lastRevision.deleted + meta.deleted,
      restored: lastRevision.restored + meta.restored,
      updatedAt: now,
    });
  } else {
    await ctx.db.insert("clubWhiteboardRevisions", {
      boardId: board._id,
      actorId: user._id,
      kind,
      fromSeq,
      toSeq: seq,
      created: meta.created,
      updated: meta.updated,
      deleted: meta.deleted,
      restored: meta.restored,
      restoredToSeq,
      startedAt: now,
      updatedAt: now,
    });
  }

  await logAuditEvent(ctx, {
    actorId: user._id,
    action: kind === "RESTORE" ? "CLUB_WHITEBOARD_RESTORED" : "CLUB_WHITEBOARD_EDITED",
    entityType: "ClubWhiteboard",
    entityId: board._id,
    meta: {
      ...meta,
      title: board.title,
      ...(restoredToSeq !== undefined ? { restoredToSeq } : {}),
    },
  });
  return changes;
}

export async function saveWhiteboardElements(
  ctx: MutationCtx,
  user: Doc<"users">,
  boardId: Id<"clubWhiteboards">,
  rawElements: string[],
) {
  assertWhiteboardSaveBounds(rawElements);
  const { board } = await requireEditableBoard(ctx, user, boardId);
  // Validate everything before any write so one bad element rejects the batch.
  const incoming = new Map(
    rawElements.map((raw) => {
      const element = sanitizeWhiteboardElement(raw);
      return [element.elementId, element] as const;
    }),
  );
  const changes = await applyElementWrites(ctx, user, board, incoming.values(), "EDIT");
  return { accepted: changes.length, ignored: incoming.size - changes.length };
}

/**
 * Collects each element's latest history row at or before `atSeq`, walking
 * newest-first so a bounded scan keeps the most recent state.
 */
async function historyAt(
  ctx: WhiteboardDbCtx,
  boardId: Id<"clubWhiteboards">,
  atSeq: number,
  limits: { rows: number; bytes: number },
) {
  const latest = new Map<string, Doc<"clubWhiteboardHistory">>();
  let rows = 0;
  let bytes = 0;
  let truncated = false;
  const history = ctx.db
    .query("clubWhiteboardHistory")
    .withIndex("by_boardId_and_seq", (q) => q.eq("boardId", boardId).lte("seq", atSeq))
    .order("desc");
  for await (const row of history) {
    if (rows >= limits.rows || bytes >= limits.bytes) {
      truncated = true;
      break;
    }
    rows += 1;
    bytes += row.data.length;
    if (!latest.has(row.elementId)) latest.set(row.elementId, row);
  }
  return { latest, truncated };
}

export async function restoreWhiteboardVersion(
  ctx: MutationCtx,
  user: Doc<"users">,
  boardId: Id<"clubWhiteboards">,
  atSeq: number,
) {
  const { board } = await requireEditableBoard(ctx, user, boardId);
  if (!Number.isSafeInteger(atSeq) || atSeq < 0 || atSeq > board.seq) {
    throw new ConvexError("That version does not exist");
  }
  const { latest, truncated } = await historyAt(ctx, boardId, atSeq, {
    rows: MAX_RESTORE_SCAN_ROWS,
    bytes: MAX_SNAPSHOT_BYTES,
  });
  if (truncated) {
    throw new ConvexError("This version is too far back to restore in one step");
  }
  const current = await ctx.db
    .query("clubWhiteboardElements")
    .withIndex("by_boardId_and_seq", (q) => q.eq("boardId", boardId))
    .take(MAX_RESTORE_SCAN_ROWS + 1);
  if (current.length > MAX_RESTORE_SCAN_ROWS) {
    throw new ConvexError("This whiteboard is too large to restore in one step");
  }
  const writes = planWhiteboardRestore(
    current,
    new Map(
      Array.from(latest, ([elementId, row]) => [
        elementId,
        { isDeleted: row.isDeleted, data: row.data },
      ]),
    ),
    () => Math.floor(Math.random() * 2 ** 31),
  );
  if (writes.length > MAX_RESTORE_WRITES) {
    throw new ConvexError("This version differs too much to restore in one step");
  }
  const changes = await applyElementWrites(
    ctx,
    user,
    board,
    writes.map(sanitizeWhiteboardElement),
    "RESTORE",
    atSeq,
  );
  return { changed: changes.length };
}

/**
 * Reconstructs a board as of one sequence number from its append-only
 * history, for version previews and audit review.
 */
export async function getWhiteboardSnapshot(
  ctx: QueryCtx,
  boardId: Id<"clubWhiteboards">,
  atSeq: number,
) {
  const board = await ctx.db.get(boardId);
  if (!board) return null;
  const [club, channel] = await Promise.all([
    ctx.db.get(board.clubId),
    ctx.db.get(board.channelId),
  ]);
  const { latest, truncated } = await historyAt(ctx, boardId, atSeq, {
    rows: MAX_SNAPSHOT_HISTORY_ROWS,
    bytes: MAX_SNAPSHOT_BYTES,
  });
  const elements = Array.from(latest.values())
    .filter((row) => !row.isDeleted)
    .sort((a, b) => a.seq - b.seq)
    .map((row) => row.data);
  return {
    boardId,
    clubId: board.clubId,
    channelId: board.channelId,
    title: board.title,
    clubName: club?.name ?? null,
    channelName: channel?.name ?? null,
    atSeq: Math.min(atSeq, board.seq),
    currentSeq: board.seq,
    elements,
    truncated,
  };
}

export async function listWhiteboardChanges(
  ctx: WhiteboardDbCtx,
  user: Doc<"users">,
  boardId: Id<"clubWhiteboards">,
  afterSeq: number,
) {
  const resolved = await getWhiteboardForUser(ctx, user, boardId);
  if (!resolved) return null;
  const rows = await ctx.db
    .query("clubWhiteboardElements")
    .withIndex("by_boardId_and_seq", (q) => q.eq("boardId", boardId).gt("seq", afterSeq))
    .take(WHITEBOARD_CHANGE_PAGE_SIZE + 1);
  const page = rows.slice(0, WHITEBOARD_CHANGE_PAGE_SIZE);
  return {
    changes: page.map((row) => ({ seq: row.seq, data: row.data })),
    hasMore: rows.length > WHITEBOARD_CHANGE_PAGE_SIZE,
  };
}

// ── Queries ─────────────────────────────────────────────────────────────

const boardSummaryValidator = v.object({
  _id: v.id("clubWhiteboards"),
  title: v.string(),
  createdAt: v.number(),
  createdByName: v.string(),
  updatedAt: v.number(),
  updatedByName: v.union(v.string(), v.null()),
  elementCount: v.number(),
  archivedAt: v.union(v.number(), v.null()),
  activeViewerCount: v.number(),
});

async function toBoardSummaries(
  ctx: QueryCtx,
  boards: Doc<"clubWhiteboards">[],
  activeSince: number | null,
) {
  const names = await userNames(
    ctx,
    boards.flatMap((board) => [board.createdById, board.updatedById]),
  );
  const viewerCounts = await Promise.all(
    boards.map(async (board) => {
      if (board.isArchived || activeSince === null) return 0;
      const cursors = await ctx.db
        .query("clubWhiteboardCursors")
        .withIndex("by_boardId_and_updatedAt", (q) =>
          q.eq("boardId", board._id).gte("updatedAt", activeSince),
        )
        .take(MAX_ACTIVE_VIEWERS_COUNTED);
      return cursors.length;
    }),
  );
  return boards.map((board, index) => ({
    _id: board._id,
    title: board.title,
    createdAt: board.createdAt,
    createdByName: names.get(board.createdById) ?? "Former member",
    updatedAt: board.updatedAt,
    updatedByName: board.updatedById ? (names.get(board.updatedById) ?? null) : null,
    elementCount: board.liveElementCount,
    archivedAt: board.archivedAt ?? null,
    activeViewerCount: viewerCounts[index]!,
  }));
}

/**
 * Active boards (at most the per-channel limit, newest activity first) and
 * exact counts. Archived boards are paged separately by `listArchived`.
 */
export async function listChannelWhiteboards(
  ctx: QueryCtx,
  user: Doc<"users">,
  channelId: Id<"clubChannels">,
  activeSince: number,
) {
  const resolved = await getWhiteboardChannel(ctx, user, channelId);
  if (!resolved) return null;
  const [boards, counts] = await Promise.all([
    ctx.db
      .query("clubWhiteboards")
      .withIndex("by_channelId_and_isArchived_and_updatedAt", (q) =>
        q.eq("channelId", channelId).eq("isArchived", false),
      )
      .order("desc")
      .take(MAX_BOARDS_PER_CHANNEL),
    getWhiteboardCounts(ctx, channelId),
  ]);
  return {
    boards: await toBoardSummaries(ctx, boards, activeSince),
    archivedCount: counts.archived,
    activeLimit: MAX_BOARDS_PER_CHANNEL,
  };
}

export const listForChannel = query({
  args: {
    channelId: v.id("clubChannels"),
    // Supplied by the client (rounded) because queries must not read the clock.
    activeSince: v.number(),
  },
  returns: v.union(
    v.object({
      boards: v.array(boardSummaryValidator),
      archivedCount: v.number(),
      activeLimit: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return null;
    return await listChannelWhiteboards(ctx, user, args.channelId, args.activeSince);
  },
});

/** Every archived board, most recently edited first, one page at a time. */
export async function listArchivedWhiteboards(
  ctx: QueryCtx,
  user: Doc<"users">,
  channelId: Id<"clubChannels">,
  paginationOpts: PaginationOptions,
) {
  if (!(await getWhiteboardChannel(ctx, user, channelId))) {
    return { page: [], isDone: true, continueCursor: "" };
  }
  const result = await ctx.db
    .query("clubWhiteboards")
    .withIndex("by_channelId_and_isArchived_and_updatedAt", (q) =>
      q.eq("channelId", channelId).eq("isArchived", true),
    )
    .order("desc")
    .paginate(paginationOpts);
  return { ...result, page: await toBoardSummaries(ctx, result.page, null) };
}

export const listArchived = query({
  args: { channelId: v.id("clubChannels"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(boardSummaryValidator),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return { page: [], isDone: true, continueCursor: "" };
    return await listArchivedWhiteboards(ctx, user, args.channelId, args.paginationOpts);
  },
});

export const get = query({
  args: { boardId: v.id("clubWhiteboards") },
  returns: v.union(
    v.object({
      _id: v.id("clubWhiteboards"),
      channelId: v.id("clubChannels"),
      title: v.string(),
      seq: v.number(),
      elementCount: v.number(),
      archivedAt: v.union(v.number(), v.null()),
      createdAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return null;
    const resolved = await getWhiteboardForUser(ctx, user, args.boardId);
    if (!resolved) return null;
    const { board } = resolved;
    return {
      _id: board._id,
      channelId: board.channelId,
      title: board.title,
      seq: board.seq,
      elementCount: board.liveElementCount,
      archivedAt: board.archivedAt ?? null,
      createdAt: board.createdAt,
    };
  },
});

export const getThumbnail = query({
  args: { boardId: v.id("clubWhiteboards") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return null;
    if (!(await getWhiteboardForUser(ctx, user, args.boardId))) return null;
    const thumbnail = await ctx.db
      .query("clubWhiteboardThumbnails")
      .withIndex("by_boardId", (q) => q.eq("boardId", args.boardId))
      .unique();
    return thumbnail?.dataUrl ?? null;
  },
});

export const listChanges = query({
  args: { boardId: v.id("clubWhiteboards"), afterSeq: v.number() },
  returns: v.union(
    v.object({
      changes: v.array(v.object({ seq: v.number(), data: v.string() })),
      hasMore: v.boolean(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return null;
    return await listWhiteboardChanges(ctx, user, args.boardId, args.afterSeq);
  },
});

const revisionValidator = v.object({
  _id: v.id("clubWhiteboardRevisions"),
  kind: v.union(v.literal("EDIT"), v.literal("RESTORE")),
  actorName: v.string(),
  toSeq: v.number(),
  created: v.number(),
  updated: v.number(),
  deleted: v.number(),
  restored: v.number(),
  restoredToSeq: v.union(v.number(), v.null()),
  startedAt: v.number(),
  updatedAt: v.number(),
});

export const listRevisions = query({
  args: { boardId: v.id("clubWhiteboards"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(revisionValidator),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user || !(await getWhiteboardForUser(ctx, user, args.boardId))) {
      return { page: [], isDone: true, continueCursor: "" };
    }
    const result = await ctx.db
      .query("clubWhiteboardRevisions")
      .withIndex("by_boardId_and_toSeq", (q) => q.eq("boardId", args.boardId))
      .order("desc")
      .paginate(args.paginationOpts);
    const names = await userNames(ctx, result.page.map((row) => row.actorId));
    return {
      ...result,
      page: result.page.map((row) => ({
        _id: row._id,
        kind: row.kind,
        actorName: names.get(row.actorId) ?? "Former member",
        toSeq: row.toSeq,
        created: row.created,
        updated: row.updated,
        deleted: row.deleted,
        restored: row.restored,
        restoredToSeq: row.restoredToSeq ?? null,
        startedAt: row.startedAt,
        updatedAt: row.updatedAt,
      })),
    };
  },
});

const snapshotValidator = v.object({
  boardId: v.id("clubWhiteboards"),
  clubId: v.id("clubs"),
  channelId: v.id("clubChannels"),
  title: v.string(),
  clubName: v.union(v.string(), v.null()),
  channelName: v.union(v.string(), v.null()),
  atSeq: v.number(),
  currentSeq: v.number(),
  elements: v.array(v.string()),
  truncated: v.boolean(),
});

/** A past version for members previewing history before restoring it. */
export const getVersion = query({
  args: { boardId: v.id("clubWhiteboards"), atSeq: v.number() },
  returns: v.union(snapshotValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user || !(await getWhiteboardForUser(ctx, user, args.boardId))) return null;
    return await getWhiteboardSnapshot(ctx, args.boardId, args.atSeq);
  },
});

/** Staff review of an audited edit, including boards in deleted channels. */
export const getAuditSnapshot = query({
  args: { boardId: v.id("clubWhiteboards"), atSeq: v.number() },
  returns: v.union(snapshotValidator, v.null()),
  handler: async (ctx, args) => {
    const viewer = await getMaybeCurrentAppUser(ctx);
    if (!viewer || !requireAnyRoleSafe(viewer, [...WHITEBOARD_REVIEW_ROLES])) {
      return null;
    }
    return await getWhiteboardSnapshot(ctx, args.boardId, args.atSeq);
  },
});

// ── Mutations ───────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    channelId: v.id("clubChannels"),
    title: v.optional(v.string()),
    duplicatedFromBoardId: v.optional(v.id("clubWhiteboards")),
  },
  returns: v.id("clubWhiteboards"),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await limitManagement(ctx, user);
    return await createWhiteboard(ctx, user, args.channelId, {
      title: args.title,
      duplicatedFromBoardId: args.duplicatedFromBoardId,
    });
  },
});

export const rename = mutation({
  args: { boardId: v.id("clubWhiteboards"), title: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await limitManagement(ctx, user);
    return await renameWhiteboard(ctx, user, args.boardId, args.title);
  },
});

export const setArchived = mutation({
  args: { boardId: v.id("clubWhiteboards"), archived: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await limitManagement(ctx, user);
    return await setWhiteboardArchived(ctx, user, args.boardId, args.archived);
  },
});

export const saveElements = mutation({
  args: { boardId: v.id("clubWhiteboards"), elements: v.array(v.string()) },
  returns: v.object({ accepted: v.number(), ignored: v.number() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const rate = await contentRateLimiter.limit(ctx, "whiteboardSavesByUser", {
      key: user._id,
    });
    if (!rate.ok) throw new ConvexError("You are drawing too quickly");
    return await saveWhiteboardElements(ctx, user, args.boardId, args.elements);
  },
});

export const restoreVersion = mutation({
  args: { boardId: v.id("clubWhiteboards"), atSeq: v.number() },
  returns: v.object({ changed: v.number() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await limitManagement(ctx, user);
    return await restoreWhiteboardVersion(ctx, user, args.boardId, args.atSeq);
  },
});

export const setThumbnail = mutation({
  args: { boardId: v.id("clubWhiteboards"), dataUrl: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    assertWhiteboardThumbnail(args.dataUrl);
    const user = await getCurrentAppUser(ctx);
    if (!(await getWhiteboardForUser(ctx, user, args.boardId))) {
      throw new ConvexError("Not authorized");
    }
    const existing = await ctx.db
      .query("clubWhiteboardThumbnails")
      .withIndex("by_boardId", (q) => q.eq("boardId", args.boardId))
      .unique();
    const now = Date.now();
    if (existing) {
      if (now - existing.updatedAt < MIN_THUMBNAIL_INTERVAL_MS) return null;
      await ctx.db.patch(existing._id, { dataUrl: args.dataUrl, updatedAt: now });
    } else {
      await ctx.db.insert("clubWhiteboardThumbnails", {
        boardId: args.boardId,
        dataUrl: args.dataUrl,
        updatedAt: now,
      });
    }
    return null;
  },
});

// ── Cursors ─────────────────────────────────────────────────────────────

const cursorValidator = v.object({
  userId: v.id("users"),
  name: v.string(),
  x: v.union(v.number(), v.null()),
  y: v.union(v.number(), v.null()),
  button: v.union(v.literal("up"), v.literal("down")),
  updatedAt: v.number(),
});

export const listCursors = query({
  args: {
    boardId: v.id("clubWhiteboards"),
    // Supplied by the client (rounded) because queries must not read the
    // clock; cursors older than this are treated as having left.
    activeSince: v.number(),
  },
  returns: v.array(cursorValidator),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];
    if (!(await getWhiteboardForUser(ctx, user, args.boardId))) return [];
    const rows = await ctx.db
      .query("clubWhiteboardCursors")
      .withIndex("by_boardId_and_updatedAt", (q) =>
        q.eq("boardId", args.boardId).gte("updatedAt", args.activeSince),
      )
      .order("desc")
      .take(MAX_CURSORS + 1);
    const others = rows.filter((row) => row.userId !== user._id).slice(0, MAX_CURSORS);
    const names = await userNames(ctx, others.map((row) => row.userId));
    return others.map((row) => ({
      userId: row.userId,
      name: names.get(row.userId) ?? "Former member",
      x: row.x ?? null,
      y: row.y ?? null,
      button: row.button,
      updatedAt: row.updatedAt,
    }));
  },
});

export const updateCursor = mutation({
  args: {
    boardId: v.id("clubWhiteboards"),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    button: v.union(v.literal("up"), v.literal("down")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const hasPosition = args.x !== undefined && args.y !== undefined;
    if (
      (args.x === undefined) !== (args.y === undefined) ||
      (hasPosition && (!Number.isFinite(args.x) || !Number.isFinite(args.y)))
    ) {
      throw new ConvexError("Invalid cursor position");
    }
    const user = await getCurrentAppUser(ctx);
    const existing = await ctx.db
      .query("clubWhiteboardCursors")
      .withIndex("by_boardId_and_userId", (q) =>
        q.eq("boardId", args.boardId).eq("userId", user._id),
      )
      .unique();
    const now = Date.now();
    if (
      existing &&
      existing.button === args.button &&
      now - existing.updatedAt < MIN_CURSOR_WRITE_INTERVAL_MS
    ) {
      return null;
    }
    if (!(await getWhiteboardForUser(ctx, user, args.boardId))) {
      throw new ConvexError("Not authorized");
    }
    // A presence-only heartbeat keeps the last known position.
    const position = hasPosition
      ? { x: args.x, y: args.y, button: args.button, updatedAt: now }
      : { button: args.button, updatedAt: now };
    if (existing) {
      await ctx.db.patch(existing._id, position);
    } else {
      await ctx.db.insert("clubWhiteboardCursors", {
        boardId: args.boardId,
        userId: user._id,
        ...position,
      });
    }
    return null;
  },
});

export const leave = mutation({
  args: { boardId: v.id("clubWhiteboards") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const existing = await ctx.db
      .query("clubWhiteboardCursors")
      .withIndex("by_boardId_and_userId", (q) =>
        q.eq("boardId", args.boardId).eq("userId", user._id),
      )
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});

// ── Channel deletion ────────────────────────────────────────────────────

/** Deletes one bounded batch of a board's live state; true when finished. */
async function clearBoardLiveState(ctx: MutationCtx, boardId: Id<"clubWhiteboards">) {
  const [elements, cursors, thumbnails] = await Promise.all([
    ctx.db
      .query("clubWhiteboardElements")
      .withIndex("by_boardId_and_seq", (q) => q.eq("boardId", boardId))
      .take(CLEANUP_BATCH_SIZE),
    ctx.db
      .query("clubWhiteboardCursors")
      .withIndex("by_boardId_and_userId", (q) => q.eq("boardId", boardId))
      .take(CLEANUP_BATCH_SIZE),
    ctx.db
      .query("clubWhiteboardThumbnails")
      .withIndex("by_boardId", (q) => q.eq("boardId", boardId))
      .take(1),
  ]);
  for (const row of [...elements, ...cursors, ...thumbnails]) {
    await ctx.db.delete(row._id);
  }
  return elements.length < CLEANUP_BATCH_SIZE && cursors.length < CLEANUP_BATCH_SIZE;
}

/**
 * Clears a deleted channel's live board state one board and one bounded batch
 * per run: active boards are cleared and archived first, then archived boards
 * are paged through without limit. Board rows, element history, revisions, and
 * audit rows are retained so staff can still review what was drawn.
 */
export const cleanupChannelWhiteboard = internalMutation({
  args: {
    channelId: v.id("clubChannels"),
    archivedCursor: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const next = (archivedCursor?: string | null) =>
      ctx.scheduler.runAfter(0, internal.clubs.whiteboards.cleanupChannelWhiteboard, {
        channelId: args.channelId,
        archivedCursor,
      });

    const active = await ctx.db
      .query("clubWhiteboards")
      .withIndex("by_channelId_and_isArchived_and_updatedAt", (q) =>
        q.eq("channelId", args.channelId).eq("isArchived", false),
      )
      .first();
    if (active) {
      if (await clearBoardLiveState(ctx, active._id)) {
        await ctx.db.patch(active._id, {
          isArchived: true,
          archivedAt: Date.now(),
          liveElementCount: 0,
        });
        await adjustWhiteboardCounts(ctx, args.channelId, { active: -1, archived: 1 });
      }
      await next(null);
      return null;
    }

    const archived = await ctx.db
      .query("clubWhiteboards")
      .withIndex("by_channelId_and_isArchived_and_updatedAt", (q) =>
        q.eq("channelId", args.channelId).eq("isArchived", true),
      )
      .order("desc")
      .paginate({ numItems: 1, cursor: args.archivedCursor ?? null });
    const board = archived.page[0];
    if (!board) return null;
    if (!(await clearBoardLiveState(ctx, board._id))) {
      await next(args.archivedCursor ?? null);
      return null;
    }
    if (board.liveElementCount !== 0) {
      await ctx.db.patch(board._id, { liveElementCount: 0 });
    }
    if (!archived.isDone) await next(archived.continueCursor);
    return null;
  },
});
