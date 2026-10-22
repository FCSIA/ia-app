import { describe, expect, it } from "vitest";
import {
  getDefaultDashboardColumns,
  getDefaultDashboardLayout,
  normalizeDashboardColumns,
  normalizeDashboardLayout,
} from "./dashboardLayout";

describe("authored dashboard defaults", () => {
  it("puts unread news first for students, with the agenda in the right column", () => {
    expect(getDefaultDashboardLayout(["STUDENT"])).toEqual([
      "welcome", "announcements", "calendar", "my-clubs",
    ]);
    expect(getDefaultDashboardColumns(["STUDENT"])).toEqual([
      ["announcements", "my-clubs"], ["calendar"],
    ]);
  });

  it("prioritizes review work for staff without retired defaults", () => {
    for (const role of ["TEACHER", "SPONSOR", "ADMIN", "SUPPORT_STAFF", "STUDENT_ADMIN"]) {
      expect(getDefaultDashboardColumns([role])).toEqual([
        ["pending-approvals", "announcements", "my-clubs"], ["calendar"],
      ]);
    }
    expect(getDefaultDashboardLayout(["SUPER_ADMIN"])).not.toContain("my-clubs");
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
