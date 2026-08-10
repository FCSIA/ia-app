import { describe, expect, test } from "vitest";
import type { ScheduleWeekday } from "../validators";
import {
  assertNoLunchCourseConflict,
  academicDateDisposition,
  inferLegacyLunchPeriod,
  normalizeDateKey,
  normalizeDayBlocks,
  resolveSchoolDay,
} from "./dayResolver";
import {
  assertDateOverrideIsUnique,
  canManageDayPlans,
} from "./dayPlans";

type Entry = {
  weekday: ScheduleWeekday;
  periodNumber: number;
  className: string;
};

const regularBlocks = Array.from({ length: 8 }, (_, index) => ({
  label: `Period ${index + 1}`,
  periodNumber: index + 1,
  startTime: `${String(8 + index).padStart(2, "0")}:00`,
  endTime: `${String(8 + index).padStart(2, "0")}:45`,
}));

function entry(
  weekday: ScheduleWeekday,
  periodNumber: number,
  className = `Class ${periodNumber}`,
): Entry {
  return { weekday, periodNumber, className };
}

describe("schedule lunch invariants", () => {
  test("infers only an unambiguous legacy lunch gap", () => {
    expect(inferLegacyLunchPeriod([entry("MONDAY", 5)])).toBe("PERIOD_4");
    expect(inferLegacyLunchPeriod([entry("MONDAY", 4)])).toBe("PERIOD_5");
    expect(
      inferLegacyLunchPeriod([entry("MONDAY", 4), entry("MONDAY", 5)]),
    ).toBeNull();
  });

  test("rejects a course in the selected lunch period without deleting it", () => {
    expect(() =>
      assertNoLunchCourseConflict(
        [entry("TUESDAY", 4), entry("TUESDAY", 5)],
        "PERIOD_4",
      ),
    ).toThrow(/still has a class/i);
  });

  test("keeps a conflicting legacy schedule visibly unresolved", () => {
    const result = resolveSchoolDay({
      dateKey: "2026-11-02",
      entries: [entry("MONDAY", 4), entry("MONDAY", 5)],
      regularBlocks,
    });
    expect(result.lunchPeriod).toBeNull();
    expect(result.lunchNeedsResolution).toBe(true);
    expect(result.blocks.filter((block) => block.kind === "LUNCH")).toHaveLength(0);
  });
});

describe("day plan validation", () => {
  test("inherits Monday through Thursday while leaving Fridays unassigned", () => {
    expect(
      academicDateDisposition("2026-08-10", "2026-08-03", "2027-05-28"),
    ).toBe("DEFAULT_TEMPLATE");
    expect(
      academicDateDisposition("2026-08-14", "2026-08-03", "2027-05-28"),
    ).toBe("UNASSIGNED_FRIDAY");
    expect(
      academicDateDisposition("2026-08-15", "2026-08-03", "2027-05-28"),
    ).toBe("WEEKEND");
    expect(
      academicDateDisposition("2027-06-01", "2026-08-03", "2027-05-28"),
    ).toBe("OUTSIDE_YEAR");
  });

  test("rejects duplicate canonical periods and overlapping times", () => {
    expect(() =>
      normalizeDayBlocks([
        regularBlocks[0],
        { ...regularBlocks[0], startTime: "09:00", endTime: "09:45" },
      ]),
    ).toThrow(/only once/i);

    expect(() =>
      normalizeDayBlocks([
        regularBlocks[0],
        { ...regularBlocks[1], startTime: "08:30", endTime: "09:15" },
      ]),
    ).toThrow(/ordered and cannot overlap/i);
  });

  test("rejects invalid dates and duplicate date assignments", () => {
    expect(() => normalizeDateKey("2026-02-30")).toThrow(/not valid/i);
    expect(() => assertDateOverrideIsUnique("override-a", undefined)).toThrow(
      /already has an override/i,
    );
    expect(() =>
      assertDateOverrideIsUnique("override-a", "override-a"),
    ).not.toThrow();
  });

  test("keeps plan management admin-only", () => {
    expect(canManageDayPlans(["ADMIN"])).toBe(true);
    expect(canManageDayPlans(["SUPER_ADMIN"])).toBe(true);
    expect(canManageDayPlans(["STUDENT_ADMIN"])).toBe(false);
    expect(canManageDayPlans(["TEACHER"])).toBe(false);
  });
});

describe("special-day resolution", () => {
  const mondayEntries = [1, 2, 3, 4, 6, 7, 8].map((period) =>
    entry("MONDAY", period),
  );

  test("maps split-day periods to the existing weekday course choices", () => {
    const firstHalf = resolveSchoolDay({
      dateKey: "2026-11-02",
      lunchPeriod: "PERIOD_5",
      entries: mondayEntries,
      regularBlocks,
      override: {
        name: "Split day A",
        blocks: [
          { ...regularBlocks[0], startTime: "08:00", endTime: "08:40" },
          { ...regularBlocks[2], startTime: "08:45", endTime: "09:25" },
          { ...regularBlocks[3], startTime: "09:30", endTime: "10:10" },
        ],
      },
    });
    expect(firstHalf.blocks.map((block) => block.entry?.className)).toEqual([
      "Class 1",
      "Class 3",
      "Class 4",
    ]);
    expect(firstHalf.omittedPeriods).toEqual([2, 5, 6, 7, 8]);
  });

  test("supports arbitrary canonical reordering without moving course data", () => {
    const reordered = resolveSchoolDay({
      dateKey: "2026-11-02",
      lunchPeriod: "PERIOD_5",
      entries: mondayEntries,
      regularBlocks,
      override: {
        name: "Even periods first",
        blocks: [2, 4, 6, 8].map((period, index) => ({
          label: `Period ${period}`,
          periodNumber: period,
          startTime: `${String(8 + index).padStart(2, "0")}:00`,
          endTime: `${String(8 + index).padStart(2, "0")}:45`,
        })),
      },
    });
    expect(reordered.blocks.map((block) => block.periodNumber)).toEqual([2, 4, 6, 8]);
    expect(reordered.blocks.map((block) => block.entry?.className)).toEqual([
      "Class 2",
      "Class 4",
      "Class 6",
      "Class 8",
    ]);
  });

  test("falls back to the regular plan when a date has no override", () => {
    const result = resolveSchoolDay({
      dateKey: "2026-11-02",
      lunchPeriod: "PERIOD_5",
      entries: mondayEntries,
      regularBlocks,
    });
    expect(result.isSpecial).toBe(false);
    expect(result.blocks).toHaveLength(8);
    expect(result.blocks[4].kind).toBe("LUNCH");
    expect(result.blocks[4].entry).toBeNull();
  });

  test("allows a no-school plan to resolve with zero blocks", () => {
    const result = resolveSchoolDay({
      dateKey: "2026-11-02",
      lunchPeriod: "PERIOD_5",
      entries: mondayEntries,
      regularBlocks: [],
      override: { name: "IA PD Day", blocks: [] },
    });
    expect(result.isSpecial).toBe(true);
    expect(result.name).toBe("IA PD Day");
    expect(result.blocks).toEqual([]);
  });

  test("allows an unassigned Friday to resolve with zero blocks", () => {
    const result = resolveSchoolDay({
      dateKey: "2026-08-14",
      lunchPeriod: "PERIOD_5",
      entries: [],
      regularBlocks: [],
    });

    expect(result.weekday).toBe("FRIDAY");
    expect(result.isSpecial).toBe(false);
    expect(result.blocks).toEqual([]);
  });
});
