import { describe, expect, it } from "vitest";
import { announcementAudience, filterAnnouncements } from "./model";

const announcements = [
  {
    title: "Robotics kickoff",
    body: "Meet in the fabrication lab after school.",
    targetType: "CLUB",
    club: { name: "Robotics Club" },
    author: { firstName: "María", lastName: "López" },
    isRead: false,
    isBookmarked: true,
  },
  {
    title: "Picture day",
    body: "Sophomores report to the auditorium.",
    targetType: "GRADE",
    targetGrade: 10,
    targetGrades: [10],
    author: { firstName: "Jordan", lastName: "Lee" },
    isRead: true,
    isBookmarked: false,
  },
];

describe("filterAnnouncements", () => {
  it("finds an author by their regular or preferred name", () => {
    const rows = [{ ...announcements[0], author: { ...announcements[0].author, preferredName: "Mari" } }];
    expect(filterAnnouncements(rows, "all", "mari")).toEqual(rows);
    expect(filterAnnouncements(rows, "all", "maria lopez")).toEqual(rows);
  });
  it("combines All, Unread, and Saved state with text search", () => {
    expect(filterAnnouncements(announcements, "all", "picture")).toEqual([
      announcements[1],
    ]);
    expect(filterAnnouncements(announcements, "unread", "robotics")).toEqual([
      announcements[0],
    ]);
    expect(filterAnnouncements(announcements, "unread", "picture")).toEqual([]);
    expect(filterAnnouncements(announcements, "saved", "fabrication")).toEqual([
      announcements[0],
    ]);
  });

  it("searches author and audience text without case or accent sensitivity", () => {
    expect(filterAnnouncements(announcements, "all", "maria lopez")).toEqual([
      announcements[0],
    ]);
    expect(filterAnnouncements(announcements, "all", "grade 10")).toEqual([
      announcements[1],
    ]);
    expect(filterAnnouncements(announcements, "all", "robotics club")).toEqual([
      announcements[0],
    ]);
  });

  it("requires every query term while preserving feed order", () => {
    expect(filterAnnouncements(announcements, "all", "robotics after")).toEqual([
      announcements[0],
    ]);
    expect(filterAnnouncements(announcements, "all", "robotics auditorium")).toEqual([]);
    expect(filterAnnouncements(announcements, "all", "  ")).toEqual(announcements);
  });
});

describe("announcementAudience", () => {
  it("formats single and multi-grade audiences", () => {
    expect(announcementAudience({ targetType: "GRADE", targetGrade: 10 })).toBe(
      "Grade 10",
    );
    expect(
      announcementAudience({
        targetType: "GRADE",
        targetGrade: 10,
        targetGrades: [9, 10],
      }),
    ).toBe("Grades 10, 9");
  });
});
