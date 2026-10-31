import { afterEach, describe, expect, it, vi } from "vitest";
import { parseIcs } from "./externalCalendarSync";

const feed = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:day
DTSTART;VALUE=DATE:20270313
DTEND;VALUE=DATE:20270315
RRULE:FREQ=DAILY;COUNT=3
SUMMARY:Break
END:VEVENT
BEGIN:VEVENT
UID:single
DTSTART;VALUE=DATE:20270320
SUMMARY:One day
END:VEVENT
BEGIN:VEVENT
UID:timed
DTSTART:20270313T150000Z
DTEND:20270313T160000Z
SUMMARY:Meeting
END:VEVENT
END:VCALENDAR`;

afterEach(() => vi.useRealTimers());
describe("ICS date-only imports", () => {
  it("keeps exclusive date ends and each recurring occurrence across DST", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2027-03-01T12:00:00Z"));
    const events = parseIcs(feed);
    expect(events.map(({ startAt, endAt, allDay }) => ({ startAt, endAt, allDay }))).toEqual([
      { startAt: Date.UTC(2027, 2, 13), endAt: Date.UTC(2027, 2, 15), allDay: true },
      { startAt: Date.UTC(2027, 2, 14), endAt: Date.UTC(2027, 2, 16), allDay: true },
      { startAt: Date.UTC(2027, 2, 15), endAt: Date.UTC(2027, 2, 17), allDay: true },
      { startAt: Date.UTC(2027, 2, 20), endAt: Date.UTC(2027, 2, 21), allDay: true },
      { startAt: Date.UTC(2027, 2, 13, 15), endAt: Date.UTC(2027, 2, 13, 16), allDay: undefined },
    ]);
  });
});
