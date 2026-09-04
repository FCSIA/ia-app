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
 * Import `useQuery` from here rather than from `convex/react`; everything else
 * `convex/react` exports is re-exported unchanged.
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  useConvex,
  useQuery as useConvexQuery,
  type ConvexReactClient,
  type OptionalRestArgsOrSkip,
} from 'convex/react';
import { getFunctionName, type FunctionReference } from 'convex/server';
import { convexToJson, type Value } from 'convex/values';

export * from 'convex/react';

/** How long an unused subscription is held before it is dropped. */
const DEFAULT_IDLE_MS = 5 * 60 * 1000;
/** Upper bound on idle subscriptions, so long sessions cannot grow unbounded. */
const DEFAULT_MAX_IDLE = 40;

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

class QueryKeepAlive {
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

  dispose() {
    for (const entry of this.entries.values()) {
      if (entry.timer) clearTimeout(entry.timer);
      entry.unsubscribe();
    }
    this.entries.clear();
  }
}

const KeepAliveContext = createContext<QueryKeepAlive | null>(null);

const NO_ENTRIES: readonly KeepAliveEntry[] = [];

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
  const [cache] = useState(() => new QueryKeepAlive(client, idleMs, maxIdleQueries));
  useEffect(() => () => cache.dispose(), [cache]);
  return <KeepAliveContext.Provider value={cache}>{children}</KeepAliveContext.Provider>;
}

/**
 * Hold subscriptions for a set of queries for as long as the caller is mounted.
 *
 * The set may change between renders — only the difference is subscribed or
 * released, so a role-dependent list does not churn the socket.
 */
export function useKeepAliveQueries(entries: readonly KeepAliveEntry[]) {
  const cache = useContext(KeepAliveContext);
  const latest = useRef(entries);
  latest.current = entries;

  const signature = entries
    .map((entry) => keepAliveKey(entry.query, entry.args))
    .join('\n');

  useEffect(() => {
    if (!cache) return;
    const releases = latest.current.map((entry) =>
      cache.retain(keepAliveKey(entry.query, entry.args), entry.query, entry.args ?? {}),
    );
    return () => releases.forEach((release) => release());
    // `signature` stands in for the entry list: equal keys mean equal subscriptions.
  }, [cache, signature]);
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
