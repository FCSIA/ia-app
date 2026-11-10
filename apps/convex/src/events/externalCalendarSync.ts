"use node";

import { createHash } from "node:crypto";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { validateIcsFeedUrl } from "./externalCalendars";
import { parseIcs, type ImportedCalendarEvent } from "./externalCalendarIcs";

const MAX_FEED_BYTES = 2 * 1024 * 1024;

async function fetchIcs(url: string): Promise<string> {
  let current = validateIcsFeedUrl(url);
  for (let redirects = 0; redirects < 4; redirects += 1) {
    const response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Calendar feed redirected without a destination.");
      current = validateIcsFeedUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok || !response.body) throw new Error(`Calendar feed returned HTTP ${response.status}.`);
    const contentLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(contentLength) && contentLength > MAX_FEED_BYTES) throw new Error("Calendar feed is too large.");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      bytes += next.value.byteLength;
      if (bytes > MAX_FEED_BYTES) throw new Error("Calendar feed is too large.");
      chunks.push(next.value);
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
  }
  throw new Error("Calendar feed redirected too many times.");
}

/** Order-independent digest of the parsed events, compared between refreshes. */
export function importedEventsHash(events: ImportedCalendarEvent[]): string {
  const hash = createHash("sha256").update("v1");
  const sorted = [...events].sort((a, b) => (a.externalId < b.externalId ? -1 : a.externalId > b.externalId ? 1 : 0));
  for (const event of sorted) {
    hash.update(JSON.stringify([
      event.externalId,
      event.title,
      event.description ?? null,
      event.location ?? null,
      event.startAt,
      event.endAt ?? null,
      event.allDay,
      event.url ?? null,
    ]));
  }
  return hash.digest("base64url");
}

export const refresh = internalAction({
  args: { subscriptionId: v.id("externalCalendarSubscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const subscription = await ctx.runQuery(internal.events.externalCalendars.getSubscription, args);
    if (!subscription) return null;
    try {
      const events = parseIcs(await fetchIcs(subscription.feedUrl));
      await ctx.runMutation(internal.events.externalCalendars.applySync, {
        subscriptionId: args.subscriptionId,
        events,
        eventsHash: importedEventsHash(events),
      });
    } catch (error) {
      await ctx.runMutation(internal.events.externalCalendars.recordSyncError, {
        subscriptionId: args.subscriptionId,
        message: error instanceof Error ? error.message : "Calendar sync failed.",
      });
    }
    return null;
  },
});

export const refreshDue = internalAction({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const subscriptionIds = await ctx.runMutation(internal.events.externalCalendars.dueSubscriptions, {});
    for (const subscriptionId of subscriptionIds) await ctx.runAction(internal.events.externalCalendarSync.refresh, { subscriptionId });
    return null;
  },
});
