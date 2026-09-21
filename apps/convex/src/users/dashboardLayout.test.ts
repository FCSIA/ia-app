import { describe, expect, it } from "vitest";
import { normalizeDashboardLayout } from "./dashboardLayout";

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
