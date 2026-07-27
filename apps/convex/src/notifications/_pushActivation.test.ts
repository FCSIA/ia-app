import { describe, expect, test } from "vitest";
import type { Doc } from "../_generated/dataModel";
import { preferenceNeedsPushUpgrade } from "./_pushActivation";

function preference(
  enabled: boolean,
  level: Doc<"notificationPreferences">["level"],
) {
  return { enabled, level };
}

describe("push preference activation", () => {
  test("upgrades only enabled preferences that are not already push-capable", () => {
    expect(preferenceNeedsPushUpgrade(preference(true, "IN_APP"))).toBe(true);
    expect(preferenceNeedsPushUpgrade(preference(true, "PUSH"))).toBe(false);
    expect(preferenceNeedsPushUpgrade(preference(true, "TIME_SENSITIVE"))).toBe(false);
    expect(preferenceNeedsPushUpgrade(preference(false, "IN_APP"))).toBe(false);
    expect(preferenceNeedsPushUpgrade(preference(false, "OFF"))).toBe(false);
  });
});
