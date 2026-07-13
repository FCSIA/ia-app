import { describe, expect, test } from "vitest";
import {
  DEFAULT_DASHBOARD_WIDGETS,
  moveDashboardWidget,
  normalizeDashboardLayout,
  resolveDashboardLayout,
} from "./dashboard-layout";

describe("dashboard layout", () => {
  test("migrates legacy ids and removes unsupported duplicates", () => {
    expect(
      normalizeDashboardLayout(["events", "calendar", "unknown", "clubs"]),
    ).toEqual(["calendar", "clubs"]);
  });

  test("moves a widget without mutating the saved layout", () => {
    const layout = ["schedule", "calendar", "clubs"] as const;
    expect(moveDashboardWidget(layout, 2, 1)).toEqual([
      "schedule",
      "clubs",
      "calendar",
    ]);
    expect(layout).toEqual(["schedule", "calendar", "clubs"]);
  });

  test("restores the default layout when no supported widgets remain", () => {
    expect(resolveDashboardLayout()).toEqual(DEFAULT_DASHBOARD_WIDGETS);
    expect(resolveDashboardLayout(["unknown", "constructor"])).toEqual(
      DEFAULT_DASHBOARD_WIDGETS,
    );
  });
});
