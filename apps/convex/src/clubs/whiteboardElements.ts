import { ConvexError } from "convex/values";

/** Elements a single save may carry; clients chunk larger flushes. */
export const MAX_WHITEBOARD_ELEMENTS_PER_SAVE = 200;
/** Serialized bytes a single save may carry across all elements. */
export const MAX_WHITEBOARD_SAVE_BYTES = 1_000_000;
/** One element's serialized JSON. Long freehand strokes are the largest. */
export const MAX_WHITEBOARD_ELEMENT_BYTES = 256_000;
/** Non-deleted elements a board may hold. */
export const MAX_WHITEBOARD_LIVE_ELEMENTS = 5_000;
export const MAX_WHITEBOARD_TEXT_CHARACTERS = 10_000;
/** Changes returned by one "after seq" subscription window. */
export const WHITEBOARD_CHANGE_PAGE_SIZE = 256;
/** Element changes itemized in one audit row; the rest are counted. */
export const MAX_WHITEBOARD_AUDIT_CHANGES = 25;
export const WHITEBOARD_AUDIT_TEXT_PREVIEW = 240;

/**
 * Drawing primitives only. Images need the upload pipeline, and embeddables
 * or iframes would let a board load arbitrary third-party pages, so both are
 * rejected until they have their own reviewed storage and allowlist.
 */
export const WHITEBOARD_ELEMENT_TYPES = [
  "rectangle",
  "diamond",
  "ellipse",
  "arrow",
  "line",
  "freedraw",
  "text",
  "frame",
] as const;

export type WhiteboardElementType = (typeof WHITEBOARD_ELEMENT_TYPES)[number];

const ELEMENT_TYPES = new Set<string>(WHITEBOARD_ELEMENT_TYPES);
const ELEMENT_ID = /^[A-Za-z0-9_-]{1,64}$/;
const SAFE_LINK = /^(https?:\/\/|mailto:)/i;

export type SanitizedWhiteboardElement = {
  elementId: string;
  type: WhiteboardElementType;
  version: number;
  versionNonce: number;
  isDeleted: boolean;
  text: string | null;
  data: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function byteLength(value: string) {
  return new TextEncoder().encode(value).length;
}

/**
 * Parses one client element and returns a normalized copy that is safe to
 * store and replay to every channel member.
 */
export function sanitizeWhiteboardElement(raw: string): SanitizedWhiteboardElement {
  if (byteLength(raw) > MAX_WHITEBOARD_ELEMENT_BYTES) {
    throw new ConvexError("A whiteboard element is too large");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ConvexError("Invalid whiteboard element");
  }
  if (!isRecord(parsed)) throw new ConvexError("Invalid whiteboard element");

  const { id, type, version, versionNonce, isDeleted } = parsed;
  if (typeof id !== "string" || !ELEMENT_ID.test(id)) {
    throw new ConvexError("Invalid whiteboard element id");
  }
  if (typeof type !== "string" || !ELEMENT_TYPES.has(type)) {
    throw new ConvexError("This kind of element is not supported on whiteboards");
  }
  if (!Number.isSafeInteger(version) || (version as number) < 1) {
    throw new ConvexError("Invalid whiteboard element version");
  }
  if (!Number.isSafeInteger(versionNonce)) {
    throw new ConvexError("Invalid whiteboard element version");
  }
  if (typeof isDeleted !== "boolean") {
    throw new ConvexError("Invalid whiteboard element");
  }

  let text: string | null = null;
  if (type === "text") {
    if (typeof parsed.text !== "string") {
      throw new ConvexError("Invalid whiteboard text");
    }
    if (Array.from(parsed.text).length > MAX_WHITEBOARD_TEXT_CHARACTERS) {
      throw new ConvexError("Whiteboard text is too long");
    }
    text = parsed.text;
  }

  const element: Record<string, unknown> = { ...parsed };
  // Links render as clickable anchors for everyone viewing the board.
  if (element.link != null) {
    element.link =
      typeof element.link === "string" && SAFE_LINK.test(element.link.trim())
        ? element.link.trim()
        : null;
  }
  // Editor-extension payloads are not part of the drawing and are not shown.
  delete element.customData;

  return {
    elementId: id,
    type: type as WhiteboardElementType,
    version: version as number,
    versionNonce: versionNonce as number,
    isDeleted,
    text,
    data: JSON.stringify(element),
  };
}

/**
 * Excalidraw's reconciliation rule: the higher version wins, and a version
 * tie is broken deterministically by the lower nonce so every replica
 * converges on the same element.
 */
export function shouldAcceptWhiteboardWrite(
  existing: { version: number; versionNonce: number } | null,
  incoming: { version: number; versionNonce: number },
) {
  if (!existing) return true;
  if (incoming.version !== existing.version) {
    return incoming.version > existing.version;
  }
  return incoming.versionNonce < existing.versionNonce;
}

export function assertWhiteboardSaveBounds(elements: string[]) {
  if (elements.length === 0) throw new ConvexError("Nothing to save");
  if (elements.length > MAX_WHITEBOARD_ELEMENTS_PER_SAVE) {
    throw new ConvexError("Too many whiteboard changes in one save");
  }
  const total = elements.reduce((sum, raw) => sum + byteLength(raw), 0);
  if (total > MAX_WHITEBOARD_SAVE_BYTES) {
    throw new ConvexError("Whiteboard save is too large");
  }
}

export type WhiteboardChangeKind = "created" | "updated" | "deleted" | "restored";

export function classifyWhiteboardChange(
  existing: { isDeleted: boolean } | null,
  incoming: { isDeleted: boolean },
): WhiteboardChangeKind {
  if (!existing) return incoming.isDeleted ? "deleted" : "created";
  if (!existing.isDeleted && incoming.isDeleted) return "deleted";
  if (existing.isDeleted && !incoming.isDeleted) return "restored";
  return "updated";
}

/** Net change in live (non-deleted) elements for one accepted write. */
export function liveElementDelta(
  existing: { isDeleted: boolean } | null,
  incoming: { isDeleted: boolean },
) {
  const before = existing && !existing.isDeleted ? 1 : 0;
  const after = incoming.isDeleted ? 0 : 1;
  return after - before;
}

/** Whiteboards are on for a channel unless its managers have turned them off. */
export function channelWhiteboardsEnabled(channel: { whiteboardsEnabled?: boolean }) {
  return channel.whiteboardsEnabled !== false;
}

export const MAX_WHITEBOARD_TITLE_CHARACTERS = 80;
export const DEFAULT_WHITEBOARD_TITLE = "Untitled whiteboard";

export function normalizeWhiteboardTitle(title: string | undefined) {
  const normalized = Array.from((title ?? "").replace(/\s+/g, " ").trim())
    .slice(0, MAX_WHITEBOARD_TITLE_CHARACTERS)
    .join("")
    .trim();
  return normalized || DEFAULT_WHITEBOARD_TITLE;
}

export const MAX_WHITEBOARD_THUMBNAIL_CHARACTERS = 64_000;
const THUMBNAIL_DATA_URL = /^data:image\/(png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/**
 * Thumbnails are rendered through <img>, which never executes content, and
 * are further restricted to small base64 PNG or WebP images.
 */
export function assertWhiteboardThumbnail(dataUrl: string) {
  if (
    dataUrl.length > MAX_WHITEBOARD_THUMBNAIL_CHARACTERS ||
    !THUMBNAIL_DATA_URL.test(dataUrl)
  ) {
    throw new ConvexError("Invalid whiteboard preview");
  }
}

/** Consecutive saves by one person within this window form one revision. */
export const WHITEBOARD_REVISION_COALESCE_MS = 5 * 60 * 1000;

/**
 * Removals never merge with additive edits (in either direction), so there is
 * always a restore point from just before something was erased.
 */
export function shouldCoalesceWhiteboardRevision(
  last: {
    kind: "EDIT" | "RESTORE";
    actorId: string;
    updatedAt: number;
    deleted: number;
  } | null,
  next: { kind: "EDIT" | "RESTORE"; actorId: string; now: number; deleted: number },
) {
  return (
    !!last &&
    last.kind === "EDIT" &&
    next.kind === "EDIT" &&
    last.actorId === next.actorId &&
    next.now - last.updatedAt < WHITEBOARD_REVISION_COALESCE_MS &&
    last.deleted > 0 === next.deleted > 0
  );
}

type ElementState = { isDeleted: boolean; data: string };

/** One element changed since the version being restored. */
export type WhiteboardRestoreCandidate = {
  /** The live row, or null once an erased element's tombstone was pruned. */
  current: ElementState | null;
  /** Its state as of the restored version, or null if it did not exist yet. */
  target: ElementState | null;
  /** The newest version any client may hold for this element. */
  latestVersion: number;
};

/**
 * Plans the writes that make the live board match a past version. Only
 * elements changed since that version are considered. Each write is a new,
 * higher element version so every open client converges on it and the
 * restore itself can later be undone like any other edit.
 */
export function planWhiteboardRestore(
  candidates: Iterable<WhiteboardRestoreCandidate>,
  nonce: () => number,
) {
  const writes: string[] = [];
  for (const { current, target, latestVersion } of candidates) {
    const currentlyLive = !!current && !current.isDeleted;
    // Created after the version: remove it if it is still on the board.
    const wanted = target ?? (currentlyLive ? { ...current, isDeleted: true } : null);
    if (!wanted) continue;
    if (current && wanted.data === current.data && wanted.isDeleted === current.isDeleted) {
      continue;
    }
    // Already gone, and gone in the version too.
    if (wanted.isDeleted && !currentlyLive) continue;
    const element = JSON.parse(wanted.data) as Record<string, unknown>;
    writes.push(
      JSON.stringify({
        ...element,
        isDeleted: wanted.isDeleted,
        version: latestVersion + 1,
        versionNonce: nonce(),
      }),
    );
  }
  return writes;
}

/** An element's version as stored in its serialized data. */
export function whiteboardElementVersion(data: string) {
  const version = (JSON.parse(data) as { version?: unknown }).version;
  return typeof version === "number" && Number.isSafeInteger(version) ? version : 0;
}

export type WhiteboardAuditChange = {
  elementId: string;
  type: WhiteboardElementType;
  change: WhiteboardChangeKind;
  textPreview?: string;
};

/**
 * One audit row per save. Itemizes a bounded set of element changes with
 * text previews; the complete element data is in `clubWhiteboardHistory`.
 */
export function whiteboardEditAuditMeta(input: {
  clubId: string;
  channelId: string;
  boardId: string;
  fromSeq: number;
  toSeq: number;
  changes: WhiteboardAuditChange[];
}) {
  const counts = { created: 0, updated: 0, deleted: 0, restored: 0 };
  for (const change of input.changes) counts[change.change] += 1;
  const itemized = input.changes
    .slice(0, MAX_WHITEBOARD_AUDIT_CHANGES)
    .map((change) =>
      change.textPreview === undefined
        ? change
        : {
            ...change,
            textPreview: Array.from(change.textPreview)
              .slice(0, WHITEBOARD_AUDIT_TEXT_PREVIEW)
              .join(""),
          },
    );
  return {
    clubId: input.clubId,
    channelId: input.channelId,
    boardId: input.boardId,
    fromSeq: input.fromSeq,
    toSeq: input.toSeq,
    saveCount: 1,
    changeCount: input.changes.length,
    ...counts,
    changes: itemized,
    omittedChangeCount: Math.max(
      0,
      input.changes.length - MAX_WHITEBOARD_AUDIT_CHANGES,
    ),
  };
}

type WhiteboardEditAuditMeta = ReturnType<typeof whiteboardEditAuditMeta>;

/**
 * Folds one more save into the audit row of the revision it coalesced into:
 * counts add up, the range extends, and itemized changes stay bounded. Every
 * individual write remains in `clubWhiteboardHistory`.
 */
export function mergeWhiteboardEditAuditMeta(
  previous: unknown,
  next: WhiteboardEditAuditMeta,
) {
  const base =
    typeof previous === "object" && previous !== null && !Array.isArray(previous)
      ? (previous as Record<string, unknown>)
      : {};
  const count = (key: string) => (typeof base[key] === "number" ? (base[key] as number) : 0);
  const changes = [...(Array.isArray(base.changes) ? base.changes : []), ...next.changes].slice(
    0,
    MAX_WHITEBOARD_AUDIT_CHANGES,
  );
  const changeCount = count("changeCount") + next.changeCount;
  return {
    ...base,
    toSeq: next.toSeq,
    saveCount: (count("saveCount") || 1) + 1,
    changeCount,
    created: count("created") + next.created,
    updated: count("updated") + next.updated,
    deleted: count("deleted") + next.deleted,
    restored: count("restored") + next.restored,
    changes,
    omittedChangeCount: Math.max(0, changeCount - changes.length),
  };
}
