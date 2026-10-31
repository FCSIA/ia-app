"use node";

import ICAL from "ical.js";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { validateIcsFeedUrl } from "./externalCalendars";

const MAX_FEED_BYTES = 2 * 1024 * 1024;
const MAX_EVENTS_PER_FEED = 300;

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

function occurrenceTimestamp(time: ICAL.Time): number {
  return time.isDate
    ? Date.UTC(time.year, time.month - 1, time.day)
    : time.toJSDate().getTime();
}

export function parseIcs(text: string) {
  const component = new ICAL.Component(ICAL.parse(text));
  const lowerBound = new Date();
  lowerBound.setDate(lowerBound.getDate() - 31);
  const upperBound = new Date();
  upperBound.setFullYear(upperBound.getFullYear() + 1);
  const events: Array<{ externalId: string; title: string; description?: string; location?: string; startAt: number; endAt?: number; allDay?: boolean }> = [];
  for (const vevent of component.getAllSubcomponents("vevent")) {
    const event = new ICAL.Event(vevent);
    const occurrences = event.isRecurring() ? event.iterator() : null;
    let occurrence: ICAL.Time | null = occurrences ? occurrences.next() : event.startDate;
    while (occurrence && events.length < MAX_EVENTS_PER_FEED) {
      const details = event.getOccurrenceDetails(occurrence);
      const startAt = occurrenceTimestamp(details.startDate);
      if (startAt > upperBound.getTime()) break;
      if (startAt >= lowerBound.getTime()) {
        const endAt = details.endDate ? occurrenceTimestamp(details.endDate) : undefined;
        events.push({
          externalId: `${event.uid}:${occurrence.toString()}`,
          title: (details.item.summary || "Untitled event").slice(0, 160),
          description: details.item.description?.slice(0, 2_000),
          location: details.item.location?.slice(0, 300),
          startAt,
          ...(details.startDate.isDate ? { allDay: true } : {}),
          ...(endAt ? { endAt } : {}),
        });
      }
      occurrence = occurrences ? occurrences.next() : null;
    }
  }
  return events;
}

export const refresh = internalAction({
  args: { subscriptionId: v.id("externalCalendarSubscriptions") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const subscription = await ctx.runQuery(internal.events.externalCalendars.getSubscription, args);
    if (!subscription) return null;
    try {
      const events = parseIcs(await fetchIcs(subscription.feedUrl));
      await ctx.runMutation(internal.events.externalCalendars.applySync, { subscriptionId: args.subscriptionId, events });
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
