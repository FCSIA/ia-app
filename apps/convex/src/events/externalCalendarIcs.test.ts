import { describe, expect, it } from "vitest";
import { parseIcs } from "./externalCalendarIcs";
import { importedEventsHash } from "./externalCalendarSync";

const feed = (event: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:assignment\r\nSUMMARY:Assignment\r\n${event}\r\nEND:VEVENT\r\nEND:VCALENDAR`;
const now = Date.parse("2026-10-21T12:00:00Z");

describe("ICS normalization", () => {
  it.each([
    ["20261022", "20261023", "2026-10-22T04:00:00Z", "2026-10-23T04:00:00Z"],
    ["20261104", "20261105", "2026-11-04T05:00:00Z", "2026-11-05T05:00:00Z"],
    ["20261101", "20261102", "2026-11-01T04:00:00Z", "2026-11-02T05:00:00Z"],
  ])("keeps DATE %s on its school day across DST", (start, end, utcStart, utcEnd) => {
    expect(parseIcs(feed(`DTSTART;VALUE=DATE:${start}\r\nDTEND;VALUE=DATE:${end}\r\nURL:https://school.instructure.com/courses/1/assignments/2`), now)).toMatchObject([
      { startAt: Date.parse(utcStart), endAt: Date.parse(utcEnd), allDay: true, url: "https://school.instructure.com/courses/1/assignments/2" },
    ]);
  });

  it("uses each recurring occurrence's dates rather than repeating DTSTART", () => {
    const events = parseIcs(feed("DTSTART:20261022T130000Z\r\nDTEND:20261022T140000Z\r\nRRULE:FREQ=DAILY;COUNT=3"), now);
    expect(events.map((event) => new Date(event.startAt).toISOString())).toEqual([
      "2026-10-22T13:00:00.000Z", "2026-10-23T13:00:00.000Z", "2026-10-24T13:00:00.000Z",
    ]);
    expect(events.every((event) => !event.allDay && event.endAt === event.startAt + 3_600_000)).toBe(true);
  });

  it("resolves floating times in school time and excludes unsafe links", () => {
    expect(parseIcs(feed("DTSTART:20261022T090000\r\nDTEND:20261022T100000\r\nURL:javascript:alert(1)"), now)).toMatchObject([
      { startAt: Date.parse("2026-10-22T13:00:00Z"), allDay: false, url: undefined },
    ]);
  });

  it("rejects an oversized import instead of silently dropping later dates", () => {
    expect(() => parseIcs(feed("DTSTART:20261022T130000Z\r\nDTEND:20261022T140000Z\r\nRRULE:FREQ=HOURLY;COUNT=501"), now)).toThrow("more than 500");
  });

  it("imports a long daily series without starving other events", () => {
    const start = Date.parse("2027-03-01T12:00:00Z");
    const daily = "BEGIN:VEVENT\r\nUID:daily\r\nDTSTART;VALUE=DATE:20270301\r\nRRULE:FREQ=DAILY;COUNT=365\r\nSUMMARY:Daily\r\nEND:VEVENT";
    const single = "BEGIN:VEVENT\r\nUID:other\r\nDTSTART;VALUE=DATE:20270320\r\nSUMMARY:Other\r\nEND:VEVENT";
    const ics = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${daily}\r\n${single}\r\nEND:VCALENDAR`;
    expect(parseIcs(ics, start).some((event) => event.title === "Other")).toBe(true);
  });
});

describe("imported event digest", () => {
  const quiz = { externalId: "quiz", title: "Quiz", startAt: 1_000, endAt: 2_000, allDay: false };
  const lab = { externalId: "lab", title: "Lab", startAt: 3_000, endAt: 4_000, allDay: false };

  it("ignores feed order but tracks every stored field", () => {
    expect(importedEventsHash([quiz, lab])).toBe(importedEventsHash([lab, quiz]));
    expect(importedEventsHash([quiz, lab])).not.toBe(importedEventsHash([{ ...quiz, description: "Chapter 4" }, lab]));
    expect(importedEventsHash([quiz, lab])).not.toBe(importedEventsHash([{ ...quiz, allDay: true }, lab]));
    expect(importedEventsHash([quiz, lab])).not.toBe(importedEventsHash([quiz]));
  });
});
