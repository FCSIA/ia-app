import { describe, expect, it } from "vitest";
import {
  normalizeMobileTabLayout,
  type MobileTabId,
} from "./mobile-tab-layout";

const available: MobileTabId[] = [
  "announcements",
  "clubs",
  "schedule",
  "calendar",
  "events",
  "flex-friday",
];

describe("mobile tab preferences", () => {
  it("preserves a valid four-destination choice without appending a fifth", () => {
    const saved = ["announcements", "clubs", "schedule", "flex-friday"];
    expect(normalizeMobileTabLayout(saved, available, true)).toEqual(saved);
  });

  it("repairs duplicate and unavailable choices only to the minimum", () => {
    expect(
      normalizeMobileTabLayout(["clubs", "clubs", "missing"], available, true),
    ).toEqual(["clubs", "announcements", "schedule", "events"]);
  });

  it("keeps the saved order of five destinations and uses the staff default", () => {
    const saved = [
      "calendar",
      "flex-friday",
      "clubs",
      "events",
      "announcements",
    ];
    expect(normalizeMobileTabLayout(saved, available, false)).toEqual(saved);
    expect(normalizeMobileTabLayout(undefined, available, false)).toEqual([
      "announcements",
      "clubs",
      "calendar",
      "events",
    ]);
  });
});
