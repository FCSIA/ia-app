import { describe, expect, it } from "vitest";
import {
  normalizeDashboardColumns,
  normalizeDashboardLayout,
} from "./dashboardLayout";

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
    ).toEqual(["fun-fact", "calendar", "day-progress", "announcements"]);
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
