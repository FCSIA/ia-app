import { describe, expect, it } from "vitest";
import type { CourseSummary } from "@/components/courses/types";
import { parseInfiniteCampusSchedule } from "./schedule-ocr";

const courses = [
  {
    id: "chemistry" as CourseSummary["id"],
    slug: "chemistry",
    title: "Chemistry",
    department: "Science",
    courseNumbers: ["CHM101"],
    pathway: null,
    catalogSource: "COURSE_CATALOG",
    term: "YEAR",
    gradeText: "10",
    minGrade: 10,
    maxGrade: 10,
  },
  {
    id: "economics" as CourseSummary["id"],
    slug: "economics",
    title: "Economics",
    department: "Social Studies",
    courseNumbers: ["ECO201"],
    pathway: null,
    catalogSource: "COURSE_CATALOG",
    term: "YEAR",
    gradeText: "11",
    minGrade: 11,
    maxGrade: 11,
  },
] satisfies CourseSummary[];

describe("parseInfiniteCampusSchedule", () => {
  it("pairs labeled periods with courses and ignores room details", () => {
    const rows = parseInfiniteCampusSchedule(
      "Period 1 Chemistry\nRoom 101\nPeriod 2 Economics",
      courses,
    );

    expect(rows).toMatchObject([
      { periodNumber: 1, matchedCourse: { id: "chemistry" } },
      { periodNumber: 2, matchedCourse: { id: "economics" } },
    ]);
  });

  it("leaves an unlabeled course list unassigned for explicit review", () => {
    const rows = parseInfiniteCampusSchedule("chem\necon", courses);

    expect(rows).toMatchObject([
      { periodNumber: null, matchedCourse: { id: "chemistry" } },
      { periodNumber: null, matchedCourse: { id: "economics" } },
    ]);
  });

  it("keeps unmatched labeled text for manual review", () => {
    const rows = parseInfiniteCampusSchedule(
      "1 - Teaching Assistant\n2 - Chemistry",
      courses,
    );

    expect(rows[0]).toMatchObject({
      periodNumber: 1,
      className: "Teaching Assistant",
      matchedCourse: null,
    });
  });
});
