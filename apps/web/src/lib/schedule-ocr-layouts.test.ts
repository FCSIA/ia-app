import { describe, expect, it } from "vitest";
import type { CourseSummary } from "@/components/courses/types";
import {
  parseInfiniteCampusSchedule,
  type ScheduleOcrLine,
} from "./schedule-ocr";

const titles = [
  "Digital Art",
  "Chemistry",
  "World History",
  "Algebra II",
  "Spanish II",
  "Engineering",
  "Literature",
  "Music Technology",
];
function columnSchedule(scale: number, lunch: number, offset = 0) {
  const lines: ScheduleOcrLine[] = [];
  for (let period = 1; period <= 8; period += 1) {
    const top = offset + (period - 1 + (period > 4 ? 1 : 0)) * 90 * scale;
    const line = (text: string, x: number, y: number, width = 250) => ({
      text,
      left: offset + x * scale,
      right: offset + (x + width) * scale,
      top: y,
      bottom: y + 18 * scale,
    });
    lines.push(line(String(period), 20, top + 15 * scale, 10));
    lines.push(
      line(period === lunch ? "Lunch - 1st Sem" : titles[period - 1], 80, top),
    );
    lines.push(line("Teacher: Example", 440, top));
    lines.push(line("Room: 201", 440, top + 22 * scale));
    lines.push(line("8:10 AM - 8:55 AM", 80, top + 25 * scale));
    if (period === 4) {
      lines.push(line("SSS/Flex", 20, top + 105 * scale, 65));
      lines.push(line("Flex/Student Success Skills", 80, top + 90 * scale));
    }
  }
  // Column-major extraction is common: fullText alone cannot supply row order.
  return {
    fullText:
      lines
        .filter((line) => line.left > offset + 40 * scale)
        .map((line) => line.text)
        .join("\n") + "\n1\n2\n3\n4\n5\n6\n7\n8",
    lines,
  };
}
function catalog(names: string[]): CourseSummary[] {
  return names.map((title, index) => ({
    id: `course-${index}` as CourseSummary["id"],
    slug: `course-${index}`,
    title,
    department: "Test",
    courseNumbers: [],
    pathway: null,
    catalogSource: "COURSE_CATALOG",
    term: "YEAR",
    gradeText: "9-12",
    minGrade: 9,
    maxGrade: 12,
  }));
}

describe("Campus schedule layout variations", () => {
  it.each(["Time Management", "Room Design", "Teacher Education"])("keeps the course title %s rather than mistaking it for metadata", (title) => {
    expect(parseInfiniteCampusSchedule(`1 ${title}\n2 Chemistry`, [])[0].className).toBe(title);
  });
  it.each([0.2, 0.5, 1, 2, 4])(
    "keeps periods at coordinate scale %s with either lunch period",
    (scale) => {
      for (const lunch of [4, 5]) {
        const fixture = columnSchedule(scale, lunch, 120 * scale);
        const rows = parseInfiniteCampusSchedule(
          fixture.fullText,
          [],
          fixture.lines,
        );
        expect(rows.map((row) => [row.periodNumber, row.className])).toEqual(
          titles.flatMap((title, index) =>
            index + 1 === lunch ? [] : [[index + 1, title]],
          ),
        );
      }
    },
  );

  it.each(["Period 1", "Per. 1", "P1", "1.", "1:", "1 -", "1st Period"])(
    "recognizes the period label %s",
    (label) => {
      expect(
        parseInfiniteCampusSchedule(`${label} Chemistry\n2 Economics`, []).map(
          (row) => [row.periodNumber, row.className],
        ),
      ).toEqual([
        [1, "Chemistry"],
        [2, "Economics"],
      ]);
    },
  );

  it("recognizes one numbered row in a cropped picture without inventing other periods", () => {
    const lines = [
      { text: "6", left: 20, right: 30, top: 25, bottom: 40 },
      { text: "Engineering", left: 80, right: 240, top: 10, bottom: 25 },
    ];
    expect(
      parseInfiniteCampusSchedule("Engineering\n6", [], lines),
    ).toMatchObject([{ periodNumber: 6, className: "Engineering" }]);
  });

  it("joins wrapped custom course titles without including teacher or time text", () => {
    const lines = [
      { text: "1", left: 20, right: 30, top: 22, bottom: 38 },
      { text: "Advanced Digital", left: 80, right: 240, top: 5, bottom: 21 },
      { text: "Art and Animation", left: 80, right: 250, top: 24, bottom: 40 },
      { text: "8:10 AM - 8:55 AM", left: 80, right: 230, top: 44, bottom: 60 },
      { text: "Teacher: Example", left: 440, right: 600, top: 5, bottom: 21 },
      { text: "2", left: 20, right: 30, top: 112, bottom: 128 },
      { text: "Chemistry", left: 80, right: 220, top: 95, bottom: 111 },
    ];
    expect(
      parseInfiniteCampusSchedule("", [], lines).map((row) => row.className),
    ).toEqual(["Advanced Digital Art and Animation", "Chemistry"]);
  });

  it("retains classes after lunch and SSS when periods are unreadable", () => {
    expect(
      parseInfiniteCampusSchedule(
        "Chemistry\nLunch\nEconomics\nSSS/Flex\nBiology",
        [],
      ).map((row) => [row.periodNumber, row.className]),
    ).toEqual([
      [null, "Chemistry"],
      [null, "Economics"],
      [null, "Biology"],
    ]);
  });

  it("does not silently choose between different classes in the same period across two terms", () => {
    const rows = parseInfiniteCampusSchedule(
      "Semester 1\n1 Chemistry\n2 Art\nSemester 2\n1 Biology\n2 Music",
      [],
    );
    expect(rows.map((row) => [row.periodNumber, row.className])).toEqual([
      [1, "Chemistry"],
      [1, "Biology"],
      [2, "Art"],
      [2, "Music"],
    ]);
  });

  it("does not turn Biology II into Biology I or omit an honors distinction", () => {
    expect(
      parseInfiniteCampusSchedule(
        "1 Biology II\n2 Chemistry Honors",
        catalog(["Biology I", "Biology", "Chemistry", "Honors Chemistry"]),
      ).map((row) => [row.className, row.matchedCourse?.title ?? null]),
    ).toEqual([
      ["Biology II", null],
      ["Honors Chemistry", "Honors Chemistry"],
    ]);
  });

  it("leaves an ambiguous abbreviated AP Physics course unmatched", () => {
    expect(
      parseInfiniteCampusSchedule(
        "1 AP Physics C",
        catalog([
          "AP Physics C Electricity and Magnetism",
          "AP Physics C Mechanics",
        ]),
      )[0].matchedCourse,
    ).toBeNull();
  });

  it("keeps side-by-side terms separate instead of pairing across columns", () => {
    const term = (left: number, names: string[]) =>
      names.flatMap((text, index) => [
        {
          text: String(index + 1),
          left,
          right: left + 10,
          top: index * 90 + 20,
          bottom: index * 90 + 38,
        },
        {
          text,
          left: left + 60,
          right: left + 200,
          top: index * 90,
          bottom: index * 90 + 18,
        },
      ]);
    expect(
      parseInfiniteCampusSchedule(
        "",
        [],
        [...term(20, ["Chemistry", "Art"]), ...term(500, ["Biology", "Music"])],
      ).map((row) => [row.periodNumber, row.className]),
    ).toEqual([
      [1, "Chemistry"],
      [1, "Biology"],
      [2, "Art"],
      [2, "Music"],
    ]);
  });

  it("retains a course with an unreadable period without guessing its number", () => {
    const lines = [
      { text: "1", left: 20, right: 30, top: 20, bottom: 38 },
      { text: "Chemistry", left: 80, right: 220, top: 0, bottom: 18 },
      { text: "Biology", left: 80, right: 220, top: 90, bottom: 108 },
      { text: "3", left: 20, right: 30, top: 200, bottom: 218 },
      { text: "Art", left: 80, right: 220, top: 180, bottom: 198 },
      { text: "4", left: 20, right: 30, top: 290, bottom: 308 },
      { text: "Music", left: 80, right: 220, top: 270, bottom: 288 },
    ];
    const rows = parseInfiniteCampusSchedule("", [], lines);
    expect(rows.map((row) => [row.periodNumber, row.className])).toEqual([
      [1, "Chemistry"],
      [3, "Art"],
      [4, "Music"],
      [null, "Biology"],
    ]);
  });
});
