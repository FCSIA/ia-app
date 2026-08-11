import { describe, expect, test } from "vitest";
import { normalizeScheduleEntries } from "./_lib";

describe("schedule entry normalization", () => {
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
