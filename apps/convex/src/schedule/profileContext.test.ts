import { describe, expect, test } from "vitest";
import { findMutualProfileClasses } from "./friends";

describe("schedule profile context", () => {
  test("returns only classes that both people take", () => {
    expect(
      findMutualProfileClasses(
        [
          { courseId: "course-physics", className: "AP Physics C" },
          { courseId: null, className: "  Robotics   Lab " },
          { courseId: "course-geometry", className: "Geometry" },
        ],
        [
          { courseId: "course-physics", className: "Physics C" },
          { courseId: null, className: "robotics lab" },
          { courseId: "course-other-geometry", className: "Geometry" },
          { courseId: "course-english", className: "IB English" },
        ],
      ),
    ).toEqual([
      { className: "Physics C" },
      { className: "robotics lab" },
    ]);
  });

  test("returns nothing when there are no classes in common", () => {
    expect(
      findMutualProfileClasses(
        [{ courseId: "course-physics", className: "AP Physics C" }],
        [{ courseId: "course-english", className: "IB English" }],
      ),
    ).toEqual([]);
  });

  test("deduplicates weekday copies and bounds the mutual class list", () => {
    const viewerEntries = Array.from({ length: 10 }, (_, index) => ({
      courseId: `course-${index + 1}`,
      className: `Class ${index + 1}`,
    }));
    const personEntries = [
      { courseId: "course-1", className: "Class 1" },
      { courseId: "course-1", className: "Class 1" },
      ...viewerEntries.slice(1),
    ];

    expect(findMutualProfileClasses(viewerEntries, personEntries)).toHaveLength(8);
  });
});
