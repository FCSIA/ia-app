import { describe, expect, test, vi } from "vitest";
import {
  MAX_SCHEDULE_CLASS_NAME_CHARACTERS,
  normalizeScheduleClassName,
  normalizeScheduleEntries,
  serializeScheduleForUser,
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

  test("hydrates a repeated course only once", async () => {
    const courseId = "course-1";
    const schedule = {
      _id: "schedule-1",
      isPublic: true,
      lunchPeriod: "PERIOD_5",
    };
    const entries = ["MONDAY", "TUESDAY", "WEDNESDAY"].map(
      (weekday, index) => ({
        _id: `entry-${index}`,
        weekday,
        periodNumber: 1,
        className: "Robotics",
        courseId,
      }),
    );
    const get = vi.fn(async () => ({
      _id: courseId,
      slug: "robotics",
      title: "Robotics",
      courseNumbers: ["ROB-101"],
      department: "Engineering",
      catalogSource: "COURSE_CATALOG",
      searchText: "robotics",
      createdAt: 1,
      updatedAt: 1,
    }));
    const query = vi.fn((table: string) => ({
      withIndex: vi.fn(() => ({
        unique: vi.fn(async () =>
          table === "studentSchedules" ? schedule : null,
        ),
        take: vi.fn(async () =>
          table === "studentScheduleEntries" ? entries : [],
        ),
      })),
    }));

    const result = await serializeScheduleForUser(
      { db: { query, get } } as never,
      "user-1" as never,
    );

    expect(get).toHaveBeenCalledTimes(1);
    expect(result?.entries).toHaveLength(3);
    expect(result?.entries.every((entry) => entry.course?.slug === "robotics"))
      .toBe(true);
  });
});
