'use client';

import '@excalidraw/excalidraw/index.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CaptureUpdateAction,
  Excalidraw,
  exportToBlob,
  reconcileElements,
  restoreElements,
} from '@excalidraw/excalidraw';
import type {
  AppState,
  Collaborator,
  ExcalidrawImperativeAPI,
  SocketId,
} from '@excalidraw/excalidraw/types';
import type {
  ExcalidrawElement,
  OrderedExcalidrawElement,
} from '@excalidraw/excalidraw/element/types';
import type { RemoteExcalidrawElement } from '@excalidraw/excalidraw/data/reconcile';
import { useConvex, useMutation } from '@/lib/convex-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { WHITEBOARD_ELEMENT_TYPES } from '~/apps/convex/src/clubs/whiteboardElements';
import {
  chunkWhiteboardElements,
  cursorActiveSince,
  cursorColor,
  pendingWhiteboardElements,
  stepCursor,
  type CursorPoint,
} from './whiteboard-sync';

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[];
  }
}

// Fonts are served from this app so the canvas works under the site CSP.
if (typeof window !== 'undefined') {
  window.EXCALIDRAW_ASSET_PATH = '/excalidraw-assets/';
}

const SUPPORTED_TYPES = new Set<string>(WHITEBOARD_ELEMENT_TYPES);
/** Local edits are flushed at most this often. */
const FLUSH_INTERVAL_MS = 250;
/** Pointer positions are sent at most this often (about 6-7 per second). */
const CURSOR_SEND_INTERVAL_MS = 150;
/** Idle viewers re-announce themselves so others keep seeing them. */
const CURSOR_HEARTBEAT_MS = 10_000;
/** Advance the change subscription window after this many applied rows. */
const REBASE_AFTER_ROWS = 64;

type RemoteCursor = {
  userId: string;
  name: string;
  /** Null until that person's pointer has entered the canvas. */
  target: CursorPoint | null;
  shown: CursorPoint | null;
  button: 'up' | 'down';
};

export type WhiteboardSyncState = 'saved' | 'saving' | 'error';

/** Imperative handle the board view uses for duplicate and preview refresh. */
export type WhiteboardCanvasHandle = {
  getElementsJson: () => string[];
  refreshThumbnail: () => void;
};

type WhiteboardCanvasProps = {
  boardId: Id<'clubWhiteboards'>;
  theme: 'light' | 'dark';
  /** Archived boards open read-only until someone restores them. */
  readOnly: boolean;
  onSyncStateChange?: (state: WhiteboardSyncState) => void;
  onReady?: (handle: WhiteboardCanvasHandle) => void;
};

/** Wait after the last local save before rendering a new list preview. */
const THUMBNAIL_DELAY_MS = 4_000;
const THUMBNAIL_MAX_CHARACTERS = 60_000;

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function errorMessage(error: unknown) {
  if (!(error instanceof Error)) return undefined;
  const data = (error as { data?: unknown }).data;
  return typeof data === 'string' ? data : undefined;
}

export default function WhiteboardCanvas({
  boardId,
  theme,
  readOnly,
  onSyncStateChange,
  onReady,
}: WhiteboardCanvasProps) {
  const convex = useConvex();
  const { toast } = useToast();
  const saveElements = useMutation(api.clubs.whiteboards.saveElements);
  const updateCursor = useMutation(api.clubs.whiteboards.updateCursor);
  const leaveBoard = useMutation(api.clubs.whiteboards.leave);
  const setThumbnail = useMutation(api.clubs.whiteboards.setThumbnail);

  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Latest version of every element this client has sent or received, so
  // local edits are distinguishable from remote changes applied to the scene.
  const syncedVersions = useRef(new Map<string, number>());
  const lastAppState = useRef<AppState | null>(null);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushing = useRef(false);
  const warnedUnsupported = useRef(false);

  const thumbnailTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncStateRef = useRef(onSyncStateChange);
  useEffect(() => {
    syncStateRef.current = onSyncStateChange;
  }, [onSyncStateChange]);

  const renderThumbnail = useCallback(async () => {
    thumbnailTimer.current = null;
    if (!excalidrawAPI) return;
    const elements = excalidrawAPI.getSceneElements();
    if (elements.length === 0) return;
    try {
      for (const size of [480, 320, 200]) {
        const blob = await exportToBlob({
          elements,
          appState: { exportBackground: true, viewBackgroundColor: '#ffffff' },
          files: null,
          mimeType: 'image/webp',
          quality: 0.7,
          exportPadding: 24,
          maxWidthOrHeight: size,
        });
        const dataUrl = await blobToDataUrl(blob);
        if (dataUrl.length <= THUMBNAIL_MAX_CHARACTERS) {
          await setThumbnail({ boardId, dataUrl });
          return;
        }
      }
    } catch {
      // Previews are best effort; the board itself is already saved.
    }
  }, [boardId, excalidrawAPI, setThumbnail]);

  const scheduleThumbnail = useCallback(() => {
    if (thumbnailTimer.current) clearTimeout(thumbnailTimer.current);
    thumbnailTimer.current = setTimeout(() => void renderThumbnail(), THUMBNAIL_DELAY_MS);
  }, [renderThumbnail]);

  useEffect(
    () => () => {
      if (thumbnailTimer.current) clearTimeout(thumbnailTimer.current);
    },
    [],
  );

  const flush = useCallback(async () => {
    flushTimer.current = null;
    if (!excalidrawAPI || flushing.current || readOnly) return;
    const pending = pendingWhiteboardElements(
      excalidrawAPI.getSceneElementsIncludingDeleted(),
      lastAppState.current ?? excalidrawAPI.getAppState(),
      syncedVersions.current,
      SUPPORTED_TYPES,
    );
    if (pending.length === 0) return;

    flushing.current = true;
    syncStateRef.current?.('saving');
    const previous = new Map(
      pending.map((element) => [element.id, syncedVersions.current.get(element.id)]),
    );
    for (const element of pending) syncedVersions.current.set(element.id, element.version);
    let saved = false;
    try {
      for (const chunk of chunkWhiteboardElements(pending.map((element) => JSON.stringify(element)))) {
        await saveElements({ boardId, elements: chunk });
      }
      saved = true;
      syncStateRef.current?.('saved');
      scheduleThumbnail();
    } catch (error) {
      syncStateRef.current?.('error');
      // Forget the optimistic versions so the next flush retries them.
      for (const [id, version] of previous) {
        if (version === undefined) syncedVersions.current.delete(id);
        else syncedVersions.current.set(id, version);
      }
      toast({
        title: 'Whiteboard changes not saved',
        description: errorMessage(error),
        variant: 'destructive',
      });
    } finally {
      flushing.current = false;
    }
    // Edits made while this save was in flight go out in the next flush. After
    // a failure, wait for the next edit instead of retrying in a loop.
    if (saved && !flushTimer.current) {
      flushTimer.current = setTimeout(() => void flushRef.current(), FLUSH_INTERVAL_MS);
    }
  }, [boardId, excalidrawAPI, readOnly, saveElements, scheduleThumbnail, toast]);

  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  useEffect(
    () => () => {
      if (flushTimer.current) clearTimeout(flushTimer.current);
      // Send anything left when the board closes.
      void flushRef.current();
    },
    [],
  );

  const handleChange = useCallback(
    (elements: readonly OrderedExcalidrawElement[], appState: AppState) => {
      lastAppState.current = appState;
      if (!excalidrawAPI) return;
      const unsupported = elements.filter(
        (element) => !element.isDeleted && !SUPPORTED_TYPES.has(element.type),
      );
      if (unsupported.length > 0) {
        const unsupportedIds = new Set(unsupported.map((element) => element.id));
        excalidrawAPI.updateScene({
          elements: excalidrawAPI
            .getSceneElementsIncludingDeleted()
            .filter((element) => !unsupportedIds.has(element.id)),
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        if (!warnedUnsupported.current) {
          warnedUnsupported.current = true;
          toast({ title: 'Images and embeds are not supported on whiteboards yet' });
        }
        return;
      }
      if (
        !flushTimer.current &&
        pendingWhiteboardElements(elements, appState, syncedVersions.current, SUPPORTED_TYPES)
          .length > 0
      ) {
        flushTimer.current = setTimeout(() => void flushRef.current(), FLUSH_INTERVAL_MS);
      }
    },
    [excalidrawAPI, toast],
  );

  // Follow remote element changes with an ordered "after seq" window. The
  // window base advances as rows are applied, so each re-run reads only the
  // recent tail of the board rather than the whole board.
  useEffect(() => {
    if (!excalidrawAPI || !onReady) return;
    onReady({
      getElementsJson: () =>
        excalidrawAPI.getSceneElements().map((element) => JSON.stringify(element)),
      refreshThumbnail: scheduleThumbnail,
    });
  }, [excalidrawAPI, onReady, scheduleThumbnail]);

  const [afterSeq, setAfterSeq] = useState(0);
  const appliedSeq = useRef(0);
  const appliedSinceRebase = useRef(0);

  useEffect(() => {
    if (!excalidrawAPI) return;
    const watch = convex.watchQuery(api.clubs.whiteboards.listChanges, { boardId, afterSeq });
    const apply = () => {
      const result = watch.localQueryResult();
      if (!result) return;
      const fresh = result.changes.filter((change) => change.seq > appliedSeq.current);
      if (fresh.length > 0) {
        const remote = restoreElements(
          fresh.map((change) => JSON.parse(change.data) as ExcalidrawElement),
          null,
        ) as unknown as RemoteExcalidrawElement[];
        for (const element of remote) {
          const known = syncedVersions.current.get(element.id) ?? 0;
          if (element.version > known) syncedVersions.current.set(element.id, element.version);
        }
        excalidrawAPI.updateScene({
          elements: reconcileElements(
            excalidrawAPI.getSceneElementsIncludingDeleted(),
            remote,
            excalidrawAPI.getAppState(),
          ),
          captureUpdate: CaptureUpdateAction.NEVER,
        });
        appliedSeq.current = fresh[fresh.length - 1]!.seq;
        appliedSinceRebase.current += fresh.length;
      }
      if (!result.hasMore) setLoaded(true);
      if (result.hasMore || appliedSinceRebase.current >= REBASE_AFTER_ROWS) {
        appliedSinceRebase.current = 0;
        setAfterSeq(appliedSeq.current);
      }
    };
    apply();
    return watch.onUpdate(apply);
  }, [afterSeq, boardId, convex, excalidrawAPI]);

  // Cursors: send throttled pointer positions, and animate other people's
  // cursors toward their latest reported position so 6-7 updates a second
  // still read as continuous motion.
  const pointer = useRef<{ x: number; y: number; button: 'up' | 'down' } | null>(null);
  const lastCursorSend = useRef(0);
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Also serves as the presence heartbeat: before the pointer has entered the
  // canvas it announces the viewer without a position.
  const sendCursor = useCallback(() => {
    cursorTimer.current = null;
    lastCursorSend.current = Date.now();
    void updateCursor({ boardId, ...(pointer.current ?? { button: 'up' as const }) }).catch(
      () => {},
    );
  }, [boardId, updateCursor]);

  const handlePointerUpdate = useCallback(
    (payload: { pointer: { x: number; y: number }; button: 'up' | 'down' }) => {
      const previousButton = pointer.current?.button;
      pointer.current = { x: payload.pointer.x, y: payload.pointer.y, button: payload.button };
      if (cursorTimer.current) return;
      const wait = Math.max(0, CURSOR_SEND_INTERVAL_MS - (Date.now() - lastCursorSend.current));
      if (wait === 0 || previousButton !== payload.button) sendCursor();
      else cursorTimer.current = setTimeout(sendCursor, wait);
    },
    [sendCursor],
  );

  useEffect(() => {
    sendCursor();
    const heartbeat = setInterval(() => {
      if (Date.now() - lastCursorSend.current >= CURSOR_HEARTBEAT_MS) sendCursor();
    }, CURSOR_HEARTBEAT_MS / 2);
    return () => {
      clearInterval(heartbeat);
      if (cursorTimer.current) clearTimeout(cursorTimer.current);
      cursorTimer.current = null;
      void leaveBoard({ boardId }).catch(() => {});
    };
  }, [boardId, leaveBoard, sendCursor]);

  const [activeSince, setActiveSince] = useState(() => cursorActiveSince(Date.now()));
  useEffect(() => {
    const timer = setInterval(() => setActiveSince(cursorActiveSince(Date.now())), 10_000);
    return () => clearInterval(timer);
  }, []);

  const cursors = useRef(new Map<string, RemoteCursor>());
  const frame = useRef<number | null>(null);

  const renderCursors = useCallback(() => {
    frame.current = null;
    if (!excalidrawAPI) return;
    let moving = false;
    const collaborators = new Map<SocketId, Collaborator>();
    for (const cursor of cursors.current.values()) {
      if (cursor.target && cursor.shown) {
        const next = stepCursor(cursor.shown, cursor.target);
        cursor.shown = next.point;
        moving ||= !next.settled;
      }
      const color = cursorColor(cursor.userId);
      collaborators.set(cursor.userId as SocketId, {
        id: cursor.userId,
        username: cursor.name,
        button: cursor.button,
        color: { background: color, stroke: color },
        ...(cursor.shown
          ? { pointer: { x: cursor.shown.x, y: cursor.shown.y, tool: 'pointer' as const } }
          : {}),
      });
    }
    excalidrawAPI.updateScene({ collaborators });
    if (moving) frame.current = requestAnimationFrame(renderCursors);
  }, [excalidrawAPI]);

  useEffect(() => {
    if (!excalidrawAPI) return;
    const watch = convex.watchQuery(api.clubs.whiteboards.listCursors, { boardId, activeSince });
    const apply = () => {
      const rows = watch.localQueryResult();
      if (!rows) return;
      const seen = new Set<string>();
      for (const row of rows) {
        seen.add(row.userId);
        const target = row.x !== null && row.y !== null ? { x: row.x, y: row.y } : null;
        cursors.current.set(row.userId, {
          userId: row.userId,
          name: row.name,
          target,
          shown: cursors.current.get(row.userId)?.shown ?? target,
          button: row.button,
        });
      }
      for (const userId of cursors.current.keys()) {
        if (!seen.has(userId)) cursors.current.delete(userId);
      }
      if (frame.current === null) frame.current = requestAnimationFrame(renderCursors);
    };
    apply();
    const unsubscribe = watch.onUpdate(apply);
    return () => {
      unsubscribe();
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [activeSince, boardId, convex, excalidrawAPI, renderCursors]);

  return (
    <div className="relative size-full" data-whiteboard-loaded={loaded ? 'true' : 'false'}>
      <Excalidraw
        excalidrawAPI={setExcalidrawAPI}
        onChange={handleChange}
        onPointerUpdate={handlePointerUpdate}
        // Returning false cancels the paste; images are not stored on boards.
        onPaste={(data) => !(data.files && Object.keys(data.files).length > 0)}
        isCollaborating
        viewModeEnabled={readOnly}
        theme={theme}
        name="Whiteboard"
        aiEnabled={false}
        UIOptions={{
          tools: { image: false },
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            toggleTheme: null,
          },
        }}
      />
      {!loaded ? (
        <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center">
          <span className="rounded-md bg-background/90 px-3 py-1.5 text-sm text-muted-foreground shadow-sm">
            Loading whiteboard…
          </span>
        </div>
      ) : null}
    </div>
  );
}
