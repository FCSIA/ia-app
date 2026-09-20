import { describe, expect, test } from "vitest";
import { summarizeProfileClasses } from "./friends";

describe("schedule profile context", () => {
  test("deduplicates weekday copies and keeps classes in period order", () => {
    expect(
      summarizeProfileClasses([
        { periodNumber: 3, className: "  Robotics   Lab " },
        { periodNumber: 1, className: "Geometry" },
        { periodNumber: 3, className: "robotics lab" },
        { periodNumber: 1, className: "Geometry" },
      ]),
    ).toEqual([
      { periodNumber: 1, className: "Geometry" },
      { periodNumber: 3, className: "Robotics Lab" },
    ]);
  });

  test("ignores empty class names and bounds the profile list", () => {
    const entries = [
      { periodNumber: 1, className: " " },
      ...Array.from({ length: 10 }, (_, index) => ({
        periodNumber: index + 1,
        className: `Class ${index + 1}`,
      })),
    ];

    expect(summarizeProfileClasses(entries)).toHaveLength(8);
    expect(summarizeProfileClasses(entries)[0]).toEqual({
      periodNumber: 1,
      className: "Class 1",
    });
  });
});
