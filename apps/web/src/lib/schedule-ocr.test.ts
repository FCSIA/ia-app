import { describe, expect, it } from "vitest";
import type { CourseSummary } from "@/components/courses/types";
import { parseInfiniteCampusSchedule } from "./schedule-ocr";
import campusScreenshot from "./__fixtures__/schedule-campus-ocr.json";

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
  it.each(["228PM-321PM", "2:28 PM - 3:21 PM", "1155AM–1245PM"])(
    "excludes the OCR clock range %s from course text",
    (time) => {
      expect(parseInfiniteCampusSchedule(`7 AP Cybersecurity\n${time}`, [])[0])
        .toMatchObject({ periodNumber: 7, className: "AP Cybersecurity" });
      expect(parseInfiniteCampusSchedule(`7 AP Cybersecurity ${time}`, [])[0])
        .toMatchObject({ periodNumber: 7, className: "AP Cybersecurity" });
    },
  );

  it("keeps every class in the supplied campus screenshot, with period 5 reserved for lunch", () => {
    const rows = parseInfiniteCampusSchedule(
      campusScreenshot.fullText,
      [],
      campusScreenshot.lines,
    );
    expect(rows.map((row) => [row.periodNumber, row.className])).toEqual([
      [1, "Gifted Internship I"],
      [2, "WBL-IT"],
      [3, "College Appl Cmbntrcs"],
      [4, "AP Physics C Mech"],
      [6, "AP Psychology"],
      [7, "AP Cybersecurity"],
      [8, "College Prin of Acct I"],
    ]);
  });

  it("prefers the specific AP mechanics course over the generic Physics title", () => {
    const physicsCourses = ["Physics", "AP Physics C Mechanics"].map(
      (title, index) => ({
        ...courses[0],
        id: `physics-${index}` as CourseSummary["id"],
        title,
      }),
    );
    expect(
      parseInfiniteCampusSchedule("4 AP Physics C Mech", physicsCourses)[0],
    ).toMatchObject({
      periodNumber: 4,
      matchedCourse: { title: "AP Physics C Mechanics" },
    });
  });

  it("preserves explicit periods when course text is below its number in the same column", () => {
    const text = "1\nChemistry\n2\nEconomics";
    const lines = text.split("\n").map((text, index) => ({
      text,
      left: 20,
      right: 180,
      top: index * 40,
      bottom: index * 40 + 20,
    }));
    expect(parseInfiniteCampusSchedule(text, courses, lines)).toMatchObject([
      { periodNumber: 1, className: "Chemistry" },
      { periodNumber: 2, className: "Economics" },
    ]);
  });

  it("keeps mixed numeric and named period labels", () => {
    const text = "1 Chemistry\n2 Economics\nPeriod 3 Biology";
    const lines = text.split("\n").map((text, index) => ({
      text,
      left: 20,
      right: 180,
      top: index * 80,
      bottom: index * 80 + 20,
    }));
    expect(
      parseInfiniteCampusSchedule(text, [], lines).map(
        (row) => row.periodNumber,
      ),
    ).toEqual([1, 2, 3]);
  });

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

  it("imports the class rows from a column-based campus screenshot, not lunch, SSS, or period 9", () => {
    const labels = ["1", "2", "3", "4", "SSS/Flex", "5", "6", "7", "8", "9"];
    const titles = [
      "AP Comp Sci Prin",
      "FVS Virtual Lab",
      "Lit/Comp II H",
      "Lunch - 1st Sem",
      "Flex/Student Success Skills",
      "Advanced Algebra: C&C",
      "AP World History",
      "Earth Systems",
      "Engineer Concepts",
      "IT Pathway",
    ];
    const ocrLines = labels.flatMap((label, index) => {
      const top = index * 110;
      return [
        { text: label, left: 25, right: 80, top: top + 24, bottom: top + 50 },
        { text: titles[index], left: 220, right: 540, top, bottom: top + 28 },
        {
          text: "Teacher: Example",
          left: 995,
          right: 1300,
          top,
          bottom: top + 28,
        },
      ];
    });
    const rows = parseInfiniteCampusSchedule(
      labels.map((label, index) => `${label}\n${titles[index]}`).join("\n"),
      courses,
      ocrLines,
    );

    expect(rows.map((row) => row.periodNumber)).toEqual([1, 2, 3, 5, 6, 7, 8]);
    expect(rows.map((row) => row.className)).toEqual([
      "AP Comp Sci Prin",
      "FVS Virtual Lab",
      "Lit/Comp II H",
      "Advanced Algebra: C&C",
      "AP World History",
      "Earth Systems",
      "Engineer Concepts",
    ]);
  });

  it("does not carry text from SSS or period 9 into a previous class in text-only OCR", () => {
    const rows = parseInfiniteCampusSchedule(
      "1\nChemistry\nSSS/Flex\nFlex/Student Success Skills\n2\nEconomics\n9\nIT Pathway",
      courses,
    );
    expect(rows.map((row) => row.periodNumber)).toEqual([1, 2]);
    expect(rows.map((row) => row.matchedCourse?.id)).toEqual([
      "chemistry",
      "economics",
    ]);
  });

  it("keeps the correct periods when OCR reads a title before its number", () => {
    const lines = [
      {
        text: "1 AP Comp Sci Prin Teacher: THURBER",
        left: 30,
        right: 1300,
        top: 20,
        bottom: 65,
      },
      {
        text: "4 Lunch - 1st Sem",
        left: 30,
        right: 480,
        top: 350,
        bottom: 395,
      },
      { text: "SSS/Flex", left: 30, right: 150, top: 460, bottom: 490 },
      {
        text: "5 Advanced Algebra: C&C Teacher: MCNELIS",
        left: 30,
        right: 1300,
        top: 570,
        bottom: 615,
      },
      {
        text: "AP World History Teacher: WILLIS",
        left: 220,
        right: 1300,
        top: 680,
        bottom: 710,
      },
      { text: "6", left: 30, right: 45, top: 705, bottom: 730 },
      {
        text: "Earth Systems Teacher: WEIGAND",
        left: 220,
        right: 1300,
        top: 790,
        bottom: 820,
      },
      { text: "7 Room: 342", left: 30, right: 1100, top: 815, bottom: 840 },
      {
        text: "8 Engineer Concepts Teacher: HUNTLEY",
        left: 30,
        right: 1300,
        top: 900,
        bottom: 945,
      },
      { text: "9 IT Pathway", left: 30, right: 450, top: 1010, bottom: 1055 },
    ];
    const rows = parseInfiniteCampusSchedule("", courses, lines);
    expect(rows.map((row) => [row.periodNumber, row.className])).toEqual([
      [1, "AP Comp Sci Prin"],
      [5, "Advanced Algebra: C&C"],
      [6, "AP World History"],
      [7, "Earth Systems"],
      [8, "Engineer Concepts"],
    ]);
  });
});
