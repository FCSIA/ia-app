import { describe, expect, test } from "vitest";
import {
  MAX_SCHEDULE_CLASS_NAME_CHARACTERS,
  normalizeScheduleClassName,
  normalizeScheduleEntries,
} from "./_lib";

describe("schedule entry normalization", () => {
  test("bounds manual schedule class names", () => {
    expect(normalizeScheduleClassName("  Robotics  ")).toBe("Robotics");
    expect(() => normalizeScheduleClassName(" ")).toThrow("Class names cannot be empty");
    expect(() => normalizeScheduleClassName("x".repeat(MAX_SCHEDULE_CLASS_NAME_CHARACTERS + 1))).toThrow("Class names must be at most");
  });

  test("mirrors a canonical period choice across all school weekdays", () => {
    expect(
      normalizeScheduleEntries([
        {
          weekday: "MONDAY",
          periodNumber: 3,
          courseId: null,
          className: "Robotics",
        },
      ]),
    ).toEqual([
      { weekday: "MONDAY", periodNumber: 3, courseId: null, className: "Robotics" },
      { weekday: "TUESDAY", periodNumber: 3, courseId: null, className: "Robotics" },
      { weekday: "WEDNESDAY", periodNumber: 3, courseId: null, className: "Robotics" },
      { weekday: "THURSDAY", periodNumber: 3, courseId: null, className: "Robotics" },
      { weekday: "FRIDAY", periodNumber: 3, courseId: null, className: "Robotics" },
    ]);
  });
});
