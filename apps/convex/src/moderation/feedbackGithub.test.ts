import { describe, expect, it } from "vitest";
import { statusForGithubIssue } from "./feedbackGithub";

describe("GitHub feedback issue state mapping", () => {
  it("maps GitHub completion and not-planned closures to feedback states", () => {
    expect(statusForGithubIssue("closed", "completed")).toBe("RESOLVED");
    expect(statusForGithubIssue("closed", "not_planned")).toBe("DISMISSED");
  });

  it("returns feedback to pending when the issue reopens", () => {
    expect(statusForGithubIssue("reopened", null)).toBe("PENDING");
  });

  it("ignores non-state issue events and unknown closure reasons default to resolved", () => {
    expect(statusForGithubIssue("edited", null)).toBeNull();
    expect(statusForGithubIssue("closed", undefined)).toBe("RESOLVED");
  });
});
