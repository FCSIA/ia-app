'use client';

/**
 * Drop-in replacement for `convex/react` that keeps query subscriptions alive
 * across unmounts.
 *
 * Convex drops a query's cached value the moment its last subscriber goes away,
 * so a plain `useQuery` re-fetches from scratch every time a route mounts —
 * which is why every tab used to open on a spinner even though the data had not
 * changed since the last visit. This module holds each query's subscription for
 * a short while after the component that used it unmounts. Returning to a tab
 * then finds the value already in the client store and renders it on the first
 * frame, while the socket keeps the value fresh in the background.
 *
 * Import `useQuery` from here rather than from `convex/react`. Paginated queries
 * additionally support opt-in previous results while filters refresh; other
 * exports are unchanged. The provider that owns the subscription cache lives
 * in `@/components/layout/convex-query-cache-provider`.
 */

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  useQuery as useConvexQuery,
  usePaginatedQuery as useConvexPaginatedQuery,
  type PaginatedQueryReference,
  type PaginatedQueryArgs,
  type UsePaginatedQueryReturnType,
  type ConvexReactClient,
  type OptionalRestArgsOrSkip,
} from 'convex/react';
import { getFunctionName, type FunctionReference } from 'convex/server';
import { convexToJson, type Value } from 'convex/values';

export * from 'convex/react';

/** How long an unused subscription is held before it is dropped. */
export const DEFAULT_IDLE_MS = 5 * 60 * 1000;
/** Upper bound on idle subscriptions, so long sessions cannot grow unbounded. */
export const DEFAULT_MAX_IDLE = 40;

type AnyQuery = FunctionReference<'query'>;
type QueryArgs = Record<string, Value>;

export type KeepAliveEntry = {
  query: AnyQuery;
  args?: QueryArgs;
};

type CacheEntry = {
  key: string;
  unsubscribe: () => void;
  refs: number;
  /** Set while the entry is idle; ordering key for eviction. */
  idleSince: number;
  timer: ReturnType<typeof setTimeout> | null;
};

export function keepAliveKey(query: AnyQuery, args: QueryArgs = {}): string {
  return `${getFunctionName(query)}|${JSON.stringify(convexToJson(args))}`;
}

class KeepAliveCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(
    private readonly client: ConvexReactClient,
    private readonly idleMs: number,
    private readonly maxIdle: number,
  ) {}

  retain(key: string, query: AnyQuery, args: QueryArgs): () => void {
    let entry = this.entries.get(key);
    if (!entry) {
      // `onUpdate` is what holds the subscription open; the value itself is
      // read back through Convex's own `useQuery` in the component.
      const watch = this.client.watchQuery(query, args);
      entry = {
        key,
        unsubscribe: watch.onUpdate(() => {}),
        refs: 0,
        idleSince: 0,
        timer: null,
      };
      this.entries.set(key, entry);
    }
    if (entry.timer) {
      clearTimeout(entry.timer);
      entry.timer = null;
    }
    entry.refs += 1;

    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.release(key);
    };
  }

  /**
   * Start a query now and let it go idle immediately, so it lives for one idle
   * window and then unsubscribes itself.
   *
   * This is the bounded form used for navigation intent: pointing at a tab pays
   * for that tab's data for a few minutes, rather than every session holding
   * every tab's subscription open for as long as it is signed in.
   */
  prewarm(entries: readonly KeepAliveEntry[]) {
    for (const entry of entries) {
      const release = this.retain(
        keepAliveKey(entry.query, entry.args),
        entry.query,
        entry.args ?? {},
      );
      release();
    }
  }

  private release(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return;
    entry.refs -= 1;
    if (entry.refs > 0) return;

    entry.idleSince = Date.now();
    entry.timer = setTimeout(() => this.evict(key), this.idleMs);
    this.trimIdle();
  }

  /** Drop the least recently released entries once too many are idle. */
  private trimIdle() {
    const idle = [...this.entries.values()].filter((entry) => entry.refs === 0);
    if (idle.length <= this.maxIdle) return;
    idle
      .sort((a, b) => a.idleSince - b.idleSince)
      .slice(0, idle.length - this.maxIdle)
      .forEach((entry) => this.evict(entry.key));
  }

  private evict(key: string) {
    const entry = this.entries.get(key);
    if (!entry || entry.refs > 0) return;
    if (entry.timer) clearTimeout(entry.timer);
    this.entries.delete(key);
    entry.unsubscribe();
  }

  /**
   * Drop every subscription, held ones included.
   *
   * Called when the cache is torn down and when authentication ends: nothing
   * cached under one identity may outlive it, and the protected tree that held
   * those queries has unmounted by then anyway.
   */
  clear() {
    for (const entry of this.entries.values()) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.unsubscribe();
    }
    this.entries.clear();
  }
}

/** The cache instance type; construct one with `createQueryKeepAlive`. */
export type QueryKeepAlive = KeepAliveCache;

export function createQueryKeepAlive(
  client: ConvexReactClient,
  idleMs = DEFAULT_IDLE_MS,
  maxIdle = DEFAULT_MAX_IDLE,
): QueryKeepAlive {
  return new KeepAliveCache(client, idleMs, maxIdle);
}

export const QueryKeepAliveContext = createContext<QueryKeepAlive | null>(null);

const NO_ENTRIES: readonly KeepAliveEntry[] = [];

/** The session's keep-alive cache, or null outside the provider. */
export function useQueryKeepAlive() {
  return useContext(QueryKeepAliveContext);
}

/**
 * Hold subscriptions for a set of queries for as long as the caller is mounted.
 *
 * The set may change between renders — only the difference is subscribed or
 * released, so a role-dependent list does not churn the socket.
 */
export function useKeepAliveQueries(entries: readonly KeepAliveEntry[]) {
  const cache = useQueryKeepAlive();

  const signature = entries
    .map((entry) => keepAliveKey(entry.query, entry.args))
    .join('\n');

  // Entries that serialize to the same signature are interchangeable, so the
  // effect can hold one array for as long as the signature holds. Memoizing is
  // what lets the effect read a committed value instead of a ref written during
  // render, which concurrent React may discard.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stable = useMemo(() => entries, [signature]);

  useEffect(() => {
    if (!cache) return;
    const releases = stable.map((entry) =>
      cache.retain(keepAliveKey(entry.query, entry.args), entry.query, entry.args ?? {}),
    );
    return () => releases.forEach((release) => release());
  }, [cache, stable]);
}

/**
 * `convex/react`'s `useQuery`, plus a short-lived subscription that outlives the
 * component so returning to a route renders from cache instead of a spinner.
 */
export function useQuery<Query extends FunctionReference<'query'>>(
  query: Query,
  ...args: OptionalRestArgsOrSkip<Query>
): Query['_returnType'] | undefined {
  const queryArgs = args[0] === 'skip' ? null : ((args[0] ?? {}) as QueryArgs);
  useKeepAliveQueries(queryArgs ? [{ query, args: queryArgs }] : NO_ENTRIES);
  return useConvexQuery(query, ...args);
}

/** Preserve a settled list during a filter refresh, explicitly opted in by
 * the feature. A changed query/scope or skip never exposes another list. */
export function usePaginatedQuery<Query extends PaginatedQueryReference>(
  query: Query,
  args: PaginatedQueryArgs<Query> | 'skip',
  options: { initialNumItems: number; keepPreviousResults?: boolean; scopeKey?: string },
): UsePaginatedQueryReturnType<Query> & { isStale: boolean } {
  const current = useConvexPaginatedQuery(query, args, options);
  const scope = `${getFunctionName(query)}|${options.scopeKey ?? ''}`;
  const [settled, setSettled] = useState<{ scope: string; results: typeof current.results } | null>(null);
  const skipped = args === 'skip';
  const retainPrevious = !!options.keepPreviousResults;
  useEffect(() => {
    if (skipped || !retainPrevious) setSettled(null);
    else if (current.status !== 'LoadingFirstPage') setSettled({ scope, results: current.results });
  }, [skipped, retainPrevious, current.results, current.status, scope]);
  const isStale = !!options.keepPreviousResults && args !== 'skip' && current.status === 'LoadingFirstPage' && settled?.scope === scope;
  return { ...current, results: isStale ? settled.results : current.results, isStale };
}
