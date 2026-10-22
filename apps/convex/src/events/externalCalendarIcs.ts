import ICAL from "ical.js";

const MAX_EVENTS_PER_FEED = 300;
const MAX_OCCURRENCES_PER_FEED = 20_000;
const SCHOOL_TIME_ZONE = "America/New_York";

export type ImportedCalendarEvent = {
  externalId: string;
  title: string;
  description?: string;
  location?: string;
  startAt: number;
  endAt?: number;
  allDay: boolean;
  url?: string;
};

// DATE and floating DATE-TIME values have no UTC offset. Resolve their wall
// clock in the school's zone, including the offset on each side of DST.
function schoolTimestamp(value: ICAL.Time) {
  const target = Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHOOL_TIME_ZONE,
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric", hourCycle: "h23",
  });
  let timestamp = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(timestamp).map(({ type, value: part }) => [type, part]));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    const next = timestamp + target - represented;
    if (next === timestamp) break;
    timestamp = next;
  }
  return timestamp;
}

function timestamp(value: ICAL.Time) {
  return value.isDate || value.zone.tzid === "floating"
    ? schoolTimestamp(value)
    : value.toJSDate().getTime();
}

function eventUrl(value: unknown) {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

export function parseIcs(text: string, now = Date.now()): ImportedCalendarEvent[] {
  const component = new ICAL.Component(ICAL.parse(text));
  const lowerBound = now - 31 * 24 * 60 * 60 * 1000;
  const upperBound = new Date(now);
  upperBound.setUTCFullYear(upperBound.getUTCFullYear() + 1);
  const events: ImportedCalendarEvent[] = [];
  let inspected = 0;
  for (const vevent of component.getAllSubcomponents("vevent")) {
    if (events.length >= MAX_EVENTS_PER_FEED) break;
    const event = new ICAL.Event(vevent);
    if (event.isRecurrenceException()) continue;
    const occurrences = event.isRecurring() ? event.iterator() : null;
    let occurrence: ICAL.Time | null = occurrences ? occurrences.next() : event.startDate;
    while (occurrence && events.length < MAX_EVENTS_PER_FEED) {
      inspected += 1;
      if (inspected > MAX_OCCURRENCES_PER_FEED) {
        throw new Error("Calendar feed has too many recurring occurrences.");
      }
      const details = event.getOccurrenceDetails(occurrence);
      const startAt = timestamp(details.startDate);
      const endAt = timestamp(details.endDate);
      if (startAt > upperBound.getTime()) break;
      if (endAt >= lowerBound) {
        events.push({
          externalId: `${event.uid}:${occurrence.toString()}`,
          title: (details.item.summary || "Untitled event").slice(0, 160),
          description: details.item.description?.slice(0, 2_000),
          location: details.item.location?.slice(0, 300),
          startAt,
          endAt,
          allDay: details.startDate.isDate,
          url: eventUrl(details.item.component.getFirstPropertyValue("url")),
        });
      }
      occurrence = occurrences ? occurrences.next() : null;
    }
  }
  return events;
}
