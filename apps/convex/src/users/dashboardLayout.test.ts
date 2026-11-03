import { describe, expect, it } from "vitest";
import {
  getDefaultDashboardColumns,
  getDefaultDashboardLayout,
  isDashboardReviewer,
  normalizeDashboardColumns,
  normalizeDashboardLayout,
} from "./dashboardLayout";

describe("authored dashboard defaults", () => {
  it("starts every role with the work queue, then unread news", () => {
    for (const role of [
      "STUDENT",
      "STUDENT_LEADER",
      "STUDENT_ADMIN",
      "TEACHER",
      "SPONSOR",
      "ADMIN",
      "SUPPORT_STAFF",
    ]) {
      expect(getDefaultDashboardLayout([role])).toEqual([
        "welcome",
        "pending-approvals",
        "announcements",
        "calendar",
        "my-clubs",
      ]);
    }
    expect(getDefaultDashboardLayout(["SUPER_ADMIN"])).not.toContain(
      "my-clubs",
    );
  });

  it("balances work and news against time and clubs", () => {
    expect(getDefaultDashboardColumns(["STUDENT"])).toEqual([
      ["pending-approvals", "announcements"],
      ["calendar", "my-clubs"],
    ]);
    expect(getDefaultDashboardColumns(["SUPER_ADMIN"])).toEqual([
      ["pending-approvals", "announcements"],
      ["calendar"],
    ]);
  });

  it("keeps an empty queue visible only for roles that approve work", () => {
    for (const role of [
      "TEACHER",
      "SPONSOR",
      "ADMIN",
      "SUPER_ADMIN",
      "SUPPORT_STAFF",
    ])
      expect(isDashboardReviewer([role])).toBe(true);
    for (const role of ["STUDENT", "STUDENT_LEADER", "STUDENT_ADMIN"])
      expect(isDashboardReviewer([role])).toBe(false);
  });
});

describe("normalizeDashboardLayout", () => {
  it("keeps the first valid occurrence of every widget in order", () => {
    expect(
      normalizeDashboardLayout([
        "fun-fact",
        "calendar",
        "day-progress",
        "announcements",
        "day-progress",
        "retired-widget",
        "calendar",
      ]),
    ).toEqual(["fun-fact", "calendar", "announcements"]);
  });
});

describe("normalizeDashboardColumns", () => {
  it("preserves the legacy alternating split without rebalancing", () => {
    expect(
      normalizeDashboardColumns(undefined, [
        "welcome",
        "calendar",
        "fun-fact",
        "announcements",
      ]),
    ).toEqual([["calendar", "announcements"], ["fun-fact"]]);
  });

  it("repairs duplicate, retired, removed and missing IDs while preserving manual columns", () => {
    expect(
      normalizeDashboardColumns(
        [
          ["welcome", "calendar", "calendar", "retired"],
          ["calendar", "fun-fact", "day-progress"],
        ],
        ["welcome", "calendar", "fun-fact", "announcements"],
      ),
    ).toEqual([["calendar", "announcements"], ["fun-fact"]]);
  });

  it("retains intentionally empty columns", () => {
    expect(
      normalizeDashboardColumns(
        [[], ["calendar", "fun-fact"]],
        ["calendar", "fun-fact"],
      ),
    ).toEqual([[], ["calendar", "fun-fact"]]);
  });
});
