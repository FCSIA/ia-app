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

/** Elements a single save may carry; clients chunk larger flushes. */
export const MAX_WHITEBOARD_ELEMENTS_PER_SAVE = 200;
/** Serialized bytes a single save may carry across all elements. */
export const MAX_WHITEBOARD_SAVE_BYTES = 1_000_000;
export const MAX_WHITEBOARD_TITLE_CHARACTERS = 80;
export const MAX_WHITEBOARD_THUMBNAIL_CHARACTERS = 64_000;

/**
 * Clients stay under the server bounds by a margin, so a save never fails on a
 * limit the client could have known about (request envelope, encoding drift).
 */
export const CLIENT_WHITEBOARD_ELEMENTS_PER_SAVE = MAX_WHITEBOARD_ELEMENTS_PER_SAVE / 2;
export const CLIENT_WHITEBOARD_SAVE_BYTES = MAX_WHITEBOARD_SAVE_BYTES - 100_000;
export const CLIENT_WHITEBOARD_THUMBNAIL_CHARACTERS = MAX_WHITEBOARD_THUMBNAIL_CHARACTERS - 4_000;
