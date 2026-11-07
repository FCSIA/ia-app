import { describe, expect, test } from "vitest";
import {
  DEFAULT_HOME_WIDGETS,
  moveHomeWidget,
  normalizeHomeLayout,
  resolveHomeLayout,
} from "./home-layout";

describe("dashboard layout", () => {
  test("migrates legacy ids and removes unsupported duplicates", () => {
    expect(
      normalizeHomeLayout(["events", "calendar", "unknown", "clubs"]),
    ).toEqual(["calendar", "clubs"]);
  });

  test("moves a widget without mutating the saved layout", () => {
    const layout = ["schedule", "calendar", "clubs"] as const;
    expect(moveHomeWidget(layout, 2, 1)).toEqual([
      "schedule",
      "clubs",
      "calendar",
    ]);
    expect(layout).toEqual(["schedule", "calendar", "clubs"]);
  });

  test("restores the default layout when no supported widgets remain", () => {
    expect(resolveHomeLayout()).toEqual(DEFAULT_HOME_WIDGETS);
    expect(resolveHomeLayout(["unknown", "constructor"])).toEqual(
      DEFAULT_HOME_WIDGETS,
    );
  });
});
