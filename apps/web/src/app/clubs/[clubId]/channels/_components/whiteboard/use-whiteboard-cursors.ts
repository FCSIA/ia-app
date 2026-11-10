'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Collaborator,
  ExcalidrawImperativeAPI,
  SocketId,
} from '@excalidraw/excalidraw/types';
import { useConvex, useMutation } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { cursorActiveSince, cursorColor, stepCursor, type CursorPoint } from './whiteboard-sync';

/** Pointer positions are sent at most this often (about 6-7 per second). */
const CURSOR_SEND_INTERVAL_MS = 150;
/** Idle viewers re-announce themselves so others keep seeing them. */
const CURSOR_HEARTBEAT_MS = 10_000;

type RemoteCursor = {
  userId: string;
  name: string;
  /** Null until that person's pointer has entered the canvas. */
  target: CursorPoint | null;
  shown: CursorPoint | null;
  button: 'up' | 'down';
};

export type PointerUpdate = { pointer: { x: number; y: number }; button: 'up' | 'down' };

/**
 * Presence and cursors for one board: sends this viewer's throttled pointer
 * (doubling as a presence heartbeat) and animates everyone else's cursor
 * toward their latest reported position, so 6-7 updates a second still read
 * as continuous motion. Returns the canvas pointer handler.
 */
export function useWhiteboardCursors(
  boardId: Id<'clubWhiteboards'>,
  excalidrawAPI: ExcalidrawImperativeAPI | null,
) {
  const convex = useConvex();
  const updateCursor = useMutation(api.clubs.whiteboards.updateCursor);
  const leaveBoard = useMutation(api.clubs.whiteboards.leave);

  const pointer = useRef<{ x: number; y: number; button: 'up' | 'down' } | null>(null);
  const lastCursorSend = useRef(0);
  const cursorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Before the pointer has entered the canvas this announces the viewer
  // without a position.
  const sendCursor = useCallback(() => {
    cursorTimer.current = null;
    lastCursorSend.current = Date.now();
    void updateCursor({ boardId, ...(pointer.current ?? { button: 'up' as const }) }).catch(
      () => {},
    );
  }, [boardId, updateCursor]);

  const handlePointerUpdate = useCallback(
    (payload: PointerUpdate) => {
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

  return handlePointerUpdate;
}
