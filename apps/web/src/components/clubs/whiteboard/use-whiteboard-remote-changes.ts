'use client';

import { useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import type { ConvexReactClient } from 'convex/react';
import { useConvex } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';

/** Advance the change subscription window after this many applied rows. */
const REBASE_AFTER_ROWS = 64;

type RemoteChange = { seq: number; data: string };

/**
 * Follows a board's element changes through an ordered "after seq" window.
 * The window base advances as rows are applied, so each re-run reads only the
 * recent tail of the board rather than the whole board. Exposed as an external
 * store so React reads the "initial load finished" flag without effect state.
 */
function createRemoteChangeStore(
  convex: ConvexReactClient,
  boardId: Id<'clubWhiteboards'>,
  apply: (changes: RemoteChange[]) => void,
) {
  const listeners = new Set<() => void>();
  let loaded = false;
  let appliedSeq = 0;
  let appliedSinceRebase = 0;
  let stop: (() => void) | null = null;

  const watchFrom = (afterSeq: number) => {
    stop?.();
    const watch = convex.watchQuery(api.clubs.whiteboards.listChanges, { boardId, afterSeq });
    const onUpdate = () => {
      const result = watch.localQueryResult();
      if (!result) return;
      const fresh = result.changes.filter((change) => change.seq > appliedSeq);
      if (fresh.length > 0) {
        apply(fresh);
        appliedSeq = fresh[fresh.length - 1]!.seq;
        appliedSinceRebase += fresh.length;
      }
      if (!result.hasMore && !loaded) {
        loaded = true;
        for (const listener of listeners) listener();
      }
      if (result.hasMore || appliedSinceRebase >= REBASE_AFTER_ROWS) {
        appliedSinceRebase = 0;
        watchFrom(appliedSeq);
      }
    };
    stop = watch.onUpdate(onUpdate);
    onUpdate();
  };

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1) watchFrom(appliedSeq);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          stop?.();
          stop = null;
        }
      };
    },
    getSnapshot: () => loaded,
  };
}

/**
 * Applies remote element changes to the open canvas as they arrive and
 * reports whether the board's initial contents have finished loading.
 */
export function useWhiteboardRemoteChanges(
  boardId: Id<'clubWhiteboards'>,
  enabled: boolean,
  apply: (changes: RemoteChange[]) => void,
) {
  const convex = useConvex();
  const applyRef = useRef(apply);
  // Declared before the store subscription so it always runs first.
  useEffect(() => {
    applyRef.current = apply;
  }, [apply]);
  const store = useMemo(
    () =>
      enabled
        ? createRemoteChangeStore(convex, boardId, (changes) => applyRef.current(changes))
        : null,
    [boardId, convex, enabled],
  );
  return useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store?.getSnapshot ?? notLoaded,
    notLoaded,
  );
}

const noopSubscribe = () => () => {};
const notLoaded = () => false;
