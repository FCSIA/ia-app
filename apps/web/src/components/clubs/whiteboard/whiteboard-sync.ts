/**
 * Pure helpers for the channel whiteboard's Convex sync. Kept free of
 * Excalidraw and React so the rules can be unit tested directly.
 */

type SyncableElement = {
  id: string;
  type: string;
  version: number;
  isDeleted: boolean;
};

type InteractionState = {
  newElement?: { id: string } | null;
  editingTextElement?: { id: string } | null;
  multiElement?: { id: string } | null;
  selectedElementIds?: Readonly<Record<string, true | boolean>>;
  selectedElementsAreBeingDragged?: boolean;
  isResizing?: boolean;
  isRotating?: boolean;
};

/**
 * Elements whose local version has not been sent or received yet. Anything
 * still being drawn, typed, dragged, resized, or rotated is held back until
 * the gesture ends, so one stroke becomes one save rather than dozens.
 */
export function pendingWhiteboardElements<T extends SyncableElement>(
  elements: readonly T[],
  appState: InteractionState,
  synced: ReadonlyMap<string, number>,
  supportedTypes: ReadonlySet<string>,
): T[] {
  const inProgress = new Set<string>();
  for (const element of [
    appState.newElement,
    appState.editingTextElement,
    appState.multiElement,
  ]) {
    if (element) inProgress.add(element.id);
  }
  if (
    appState.selectedElementsAreBeingDragged ||
    appState.isResizing ||
    appState.isRotating
  ) {
    for (const [id, selected] of Object.entries(appState.selectedElementIds ?? {})) {
      if (selected) inProgress.add(id);
    }
  }
  return elements.filter((element) => {
    if (!supportedTypes.has(element.type) || inProgress.has(element.id)) return false;
    const known = synced.get(element.id);
    // Created and deleted before it was ever shared: nothing to tell others.
    if (known === undefined && element.isDeleted) return false;
    return known !== element.version;
  });
}

export const MAX_ELEMENTS_PER_SAVE = 100;
export const MAX_SAVE_BYTES = 900_000;

/** Splits serialized elements into saves within the server's bounds. */
export function chunkWhiteboardElements(serialized: readonly string[]) {
  const chunks: string[][] = [];
  let current: string[] = [];
  let bytes = 0;
  for (const element of serialized) {
    const size = new TextEncoder().encode(element).length;
    if (
      current.length > 0 &&
      (current.length >= MAX_ELEMENTS_PER_SAVE || bytes + size > MAX_SAVE_BYTES)
    ) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(element);
    bytes += size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

const CURSOR_STALE_MS = 30_000;
const CURSOR_BUCKET_MS = 10_000;

/**
 * Oldest cursor update still shown. Rounded to a bucket so the query argument
 * changes every ten seconds rather than on every render.
 */
export function cursorActiveSince(now: number) {
  return Math.floor((now - CURSOR_STALE_MS) / CURSOR_BUCKET_MS) * CURSOR_BUCKET_MS;
}

export type CursorPoint = { x: number; y: number };

const CURSOR_EASING = 0.3;
const CURSOR_SETTLE_DISTANCE = 0.5;

/**
 * One animation frame of cursor smoothing: move part of the way toward the
 * latest reported position, snapping once close enough to stop animating.
 */
export function stepCursor(shown: CursorPoint, target: CursorPoint) {
  const dx = target.x - shown.x;
  const dy = target.y - shown.y;
  if (Math.hypot(dx, dy) < CURSOR_SETTLE_DISTANCE) {
    return { point: target, settled: true };
  }
  return {
    point: { x: shown.x + dx * CURSOR_EASING, y: shown.y + dy * CURSOR_EASING },
    settled: false,
  };
}

const CURSOR_COLORS = [
  '#e03131',
  '#1971c2',
  '#2f9e44',
  '#f08c00',
  '#9c36b5',
  '#0c8599',
  '#c2255c',
  '#5c7cfa',
];

/** A stable color per person so each cursor keeps its identity. */
export function cursorColor(userId: string) {
  let hash = 0;
  for (const character of userId) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length]!;
}
