import { describe, expect, test } from "vitest";
import {
  formatClockTime,
  inferLegacyLunchPeriod,
  schoolDateKey,
  schoolDayBounds,
  schoolDaySpan,
  schoolHour,
  schoolTimestamp,
  schoolYearLabel,
  weekdayForDateKey,
} from "./school-time";

const hour = 60 * 60 * 1000;

describe("school days", () => {
  test("start at New York midnight in daylight and standard time", () => {
    expect(new Date(schoolDayBounds("2026-10-02").start).toISOString()).toBe("2026-10-02T04:00:00.000Z");
    expect(new Date(schoolDayBounds("2026-12-01").start).toISOString()).toBe("2026-12-01T05:00:00.000Z");
  });

  test("are 23 and 25 hours long on the clock-change days", () => {
    const spring = schoolDayBounds("2026-03-08");
    const fall = schoolDayBounds("2026-11-01");

    expect((spring.end - spring.start) / hour).toBe(23);
    expect((fall.end - fall.start) / hour).toBe(25);
  });

  test("round-trip between instants and day keys", () => {
    const { start, end } = schoolDayBounds("2026-11-01");

    expect(schoolDateKey(start)).toBe("2026-11-01");
    expect(schoolDateKey(end - 1)).toBe("2026-11-01");
    expect(schoolDateKey(end)).toBe("2026-11-02");
    expect(schoolDaySpan(start + 13 * hour)).toEqual({ startAt: start, endAt: end });
  });

  test("hours follow the school's clock", () => {
    expect(schoolHour(schoolDayBounds("2026-11-01").start)).toBe(0);
    expect(schoolHour(schoolDayBounds("2026-11-01").end - 1)).toBe(23);
  });

  test("resolve wall-clock times on either side of a clock change", () => {
    expect(new Date(schoolTimestamp({ year: 2026, month: 3, day: 8, hour: 3 })).toISOString()).toBe("2026-03-08T07:00:00.000Z");
    expect(new Date(schoolTimestamp({ year: 2026, month: 11, day: 1, hour: 3 })).toISOString()).toBe("2026-11-01T08:00:00.000Z");
  });

  test("name school weekdays and leave weekends out", () => {
    expect(weekdayForDateKey("2026-11-02")).toBe("MONDAY");
    expect(weekdayForDateKey("2026-11-06")).toBe("FRIDAY");
    expect(weekdayForDateKey("2026-11-07")).toBeNull();
  });
});

describe("lunch", () => {
  test("infers only an unambiguous legacy lunch gap", () => {
    expect(inferLegacyLunchPeriod([{ periodNumber: 5 }])).toBe("PERIOD_4");
    expect(inferLegacyLunchPeriod([{ periodNumber: 4 }])).toBe("PERIOD_5");
    expect(inferLegacyLunchPeriod([{ periodNumber: 4 }, { periodNumber: 5 }])).toBeNull();
  });
});

describe("labels", () => {
  test("formats clock times with AM/PM unless 24-hour time is requested", () => {
    expect(formatClockTime("08:05")).toBe("8:05 AM");
    expect(formatClockTime("12:00")).toBe("12:00 PM");
    expect(formatClockTime("00:30")).toBe("12:30 AM");
    expect(formatClockTime("08:05", true)).toBe("08:05");
    expect(formatClockTime("13:45", true)).toBe("13:45");
  });

  test("names a school year by its two calendar years", () => {
    expect(schoolYearLabel(2025)).toBe("2025-26");
    expect(schoolYearLabel(2099)).toBe("2099-00");
  });
});
