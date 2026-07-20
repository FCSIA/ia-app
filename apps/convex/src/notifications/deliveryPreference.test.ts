import { describe, expect, test } from "vitest";
import type { Doc } from "../_generated/dataModel";
import { preferenceAllowsPush } from "./deliveryPreference";

function preference(enabled: boolean, level: Doc<"notificationPreferences">["level"]) {
  return { enabled, level } as Doc<"notificationPreferences">;
}

describe("notification delivery preference", () => {
  test("only schedules push work for enabled push levels", () => {
    expect(preferenceAllowsPush(preference(true, "PUSH"))).toBe(true);
    expect(preferenceAllowsPush(preference(true, "TIME_SENSITIVE"))).toBe(true);
    expect(preferenceAllowsPush(preference(true, "IN_APP"))).toBe(false);
    expect(preferenceAllowsPush(preference(false, "PUSH"))).toBe(false);
    expect(preferenceAllowsPush(null)).toBe(false);
  });
});
