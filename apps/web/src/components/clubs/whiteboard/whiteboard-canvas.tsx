'use client';

import '@excalidraw/excalidraw/index.css';
import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import {
  CaptureUpdateAction,
  Excalidraw,
  reconcileElements,
  restoreElements,
} from '@excalidraw/excalidraw';
import type { AppState, ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import type {
  ExcalidrawElement,
  OrderedExcalidrawElement,
} from '@excalidraw/excalidraw/element/types';
import type { RemoteExcalidrawElement } from '@excalidraw/excalidraw/data/reconcile';
import { useMutation } from '@/lib/convex-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { WHITEBOARD_ELEMENT_TYPES } from '~/apps/convex/src/clubs/whiteboardElements';
import { chunkWhiteboardElements, pendingWhiteboardElements } from './whiteboard-sync';
import { useWhiteboardCursors } from './use-whiteboard-cursors';
import { useWhiteboardRemoteChanges } from './use-whiteboard-remote-changes';
import { useWhiteboardThumbnail } from './use-whiteboard-thumbnail';

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
  handleRef?: Ref<WhiteboardCanvasHandle>;
};

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
  handleRef,
}: WhiteboardCanvasProps) {
  const { toast } = useToast();
  const saveElements = useMutation(api.clubs.whiteboards.saveElements);
  const [excalidrawAPI, setExcalidrawAPI] = useState<ExcalidrawImperativeAPI | null>(null);

  // Latest version of every element this client has sent or received, so
  // local edits are distinguishable from remote changes applied to the scene.
  const syncedVersions = useRef(new Map<string, number>());
  const lastAppState = useRef<AppState | null>(null);
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushing = useRef(false);
  const warnedUnsupported = useRef(false);
  const syncStateRef = useRef(onSyncStateChange);
  useEffect(() => {
    syncStateRef.current = onSyncStateChange;
  }, [onSyncStateChange]);

  const scheduleThumbnail = useWhiteboardThumbnail(boardId, excalidrawAPI);
  const handlePointerUpdate = useWhiteboardCursors(boardId, excalidrawAPI);

  useImperativeHandle(
    handleRef,
    () => ({
      getElementsJson: () =>
        (excalidrawAPI?.getSceneElements() ?? []).map((element) => JSON.stringify(element)),
      refreshThumbnail: scheduleThumbnail,
    }),
    [excalidrawAPI, scheduleThumbnail],
  );

  const applyRemote = useCallback(
    (changes: Array<{ data: string }>) => {
      if (!excalidrawAPI) return;
      const remote = restoreElements(
        changes.map((change) => JSON.parse(change.data) as ExcalidrawElement),
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
    },
    [excalidrawAPI],
  );
  const loaded = useWhiteboardRemoteChanges(boardId, !!excalidrawAPI, applyRemote);

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
      // Chunks are independent element writes; the server orders them.
      const chunks = chunkWhiteboardElements(pending.map((element) => JSON.stringify(element)));
      await Promise.all(chunks.map((chunk) => saveElements({ boardId, elements: chunk })));
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
