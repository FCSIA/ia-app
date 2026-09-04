'use client';

import { useEffect, useState, type ReactNode } from 'react';
import {
  DEFAULT_IDLE_MS,
  DEFAULT_MAX_IDLE,
  QueryKeepAliveContext,
  createQueryKeepAlive,
  useConvex,
  useConvexAuth,
} from '@/lib/convex-react';

/**
 * Owns the keep-alive cache described in `@/lib/convex-react`.
 *
 * It sits above the authenticated boundary so the cache survives route changes,
 * and clears itself the moment authentication ends — the queries it holds were
 * all read as somebody, and none of them may outlive that identity or be
 * re-evaluated across the transition.
 */
export function ConvexQueryCacheProvider({
  children,
  idleMs = DEFAULT_IDLE_MS,
  maxIdleQueries = DEFAULT_MAX_IDLE,
}: {
  children: ReactNode;
  idleMs?: number;
  maxIdleQueries?: number;
}) {
  const client = useConvex();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const [cache] = useState(() => createQueryKeepAlive(client, idleMs, maxIdleQueries));

  useEffect(() => () => cache.clear(), [cache]);

  useEffect(() => {
    // `isLoading` covers the first moments of a session, when there is nothing
    // cached to drop and authentication has not resolved either way yet.
    if (isLoading || isAuthenticated) return;
    cache.clear();
  }, [cache, isAuthenticated, isLoading]);

  return (
    <QueryKeepAliveContext.Provider value={cache}>{children}</QueryKeepAliveContext.Provider>
  );
}
