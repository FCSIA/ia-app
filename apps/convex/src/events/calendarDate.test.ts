import { describe, expect, it } from "vitest";
import { calendarDisplayDate, calendarEntryDays, calendarQueryRange, isUpcomingCalendarEntry } from "../../../shared/calendar-date";

describe("calendar date display", () => {
  it("includes ongoing all-day events in the upcoming window until their exclusive end", () => {
    const day = Date.UTC(2027, 2, 14);
    const range = { startDate: day, endDate: day + 30 * 86400000, startDay: day, endDay: day + 30 * 86400000 };
    const event = { source: "EXTERNAL", allDay: true, startAt: day - 86400000, endAt: day + 86400000 };
    expect(isUpcomingCalendarEntry(event, range, day + 3600000)).toBe(true);
    expect(isUpcomingCalendarEntry({ ...event, endAt: day }, range, day + 3600000)).toBe(false);
    expect(isUpcomingCalendarEntry({ source: "PERSONAL", startAt: day }, range, day + 3600000)).toBe(false);
  });
  it("retains date-only days and exclusive ends across daylight saving", () => {
    const start = Date.UTC(2027, 2, 13);
    const end = Date.UTC(2027, 2, 16);
    const display = calendarDisplayDate(start, true);
    expect([display.getFullYear(), display.getMonth(), display.getDate(), display.getHours()]).toEqual([2027, 2, 13, 0]);
    const days = calendarEntryDays(start, end, true, new Date(2027, 2, 14), new Date(2027, 2, 31, 23, 59));
    expect(days.map((day) => day.getDate())).toEqual([14, 15]);
    const range = calendarQueryRange(new Date(2027, 2, 14).getTime(), new Date(2027, 2, 15, 23, 59).getTime());
    expect([range.startDay, range.endDay]).toEqual([Date.UTC(2027, 2, 14), Date.UTC(2027, 2, 15)]);
  });
  it("walks the fall transition without duplicating or skipping dates", () => {
    const days = calendarEntryDays(Date.UTC(2027, 10, 6), Date.UTC(2027, 10, 9), true,
      new Date(2027, 10, 1), new Date(2027, 10, 30, 23, 59));
    expect(days.map((day) => [day.getMonth(), day.getDate(), day.getHours()])).toEqual([[10, 6, 0], [10, 7, 0], [10, 8, 0]]);
  });
  it("keeps timed events as instants", () => {
    const instant = Date.UTC(2027, 2, 14, 9);
    expect(calendarDisplayDate(instant).getTime()).toBe(instant);
  });
});
