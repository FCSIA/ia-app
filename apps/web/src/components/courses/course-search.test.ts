import { describe, expect, it } from "vitest";
import { rankCourseSearch } from "./course-search";

describe("rankCourseSearch", () => {
  const biology = ["Biology", "Science", "BIO 101", "Grades 9-12"];

  it("keeps literal matches ahead of partial matches", () => {
    expect(rankCourseSearch("biology", biology)).toBe(0);
    expect(rankCourseSearch("bio", biology)).toBe(1);
  });

  it("matches common spelling mistakes in course words", () => {
    expect(rankCourseSearch("biolgy", biology)).toBe(2);
    expect(rankCourseSearch("scince", biology)).toBe(2);
  });

  it("does not match unrelated short queries fuzzily", () => {
    expect(rankCourseSearch("art", biology)).toBeNull();
  });
});
