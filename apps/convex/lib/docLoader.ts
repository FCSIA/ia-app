import type { Doc, Id, TableNames } from "../src/_generated/dataModel";
import type { QueryCtx } from "../src/_generated/server";

export type DocLoader = {
  /** `ctx.db.get`, but each id is fetched at most once per query execution. */
  get<Table extends TableNames>(id: Id<Table>): Promise<Doc<Table> | null>;
};

/**
 * Memoizes `ctx.db.get` for the lifetime of one query.
 *
 * List queries serialize many rows that point at the same few documents — a
 * feed of fifty announcements written by three teachers used to read those three
 * user documents fifty times. A query runs against a single database snapshot,
 * so caching by id inside it cannot go stale.
 *
 * Query contexts only: a mutation can patch a document mid-transaction, and a
 * cached copy would then be wrong.
 */
export function createDocLoader(ctx: QueryCtx): DocLoader {
  const cache = new Map<string, Promise<Doc<TableNames> | null>>();

  return {
    get<Table extends TableNames>(id: Id<Table>) {
      let pending = cache.get(id);
      if (!pending) {
        // The promise, not its result, is cached, so concurrent lookups of the
        // same id share one read instead of racing.
        pending = ctx.db.get(id) as Promise<Doc<TableNames> | null>;
        cache.set(id, pending);
      }
      return pending as Promise<Doc<Table> | null>;
    },
  };
}
