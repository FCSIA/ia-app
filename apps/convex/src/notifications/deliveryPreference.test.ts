import { describe, expect, test } from "vitest";
import type { Doc } from "../_generated/dataModel";
import { preferenceAllowsPush } from "./deliveryPreference";
import { preferenceDeliveryDecision } from "./delivery";

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

  test("friend schedule changes honor explicit preferences and default to in-app", () => {
    expect(preferenceDeliveryDecision("FRIEND_SCHEDULE_CHANGE", null)).toEqual({
      create: true,
      push: false,
    });
    expect(
      preferenceDeliveryDecision("FRIEND_SCHEDULE_CHANGE", preference(false, "OFF")),
    ).toEqual({ create: false, push: false });
    expect(
      preferenceDeliveryDecision("FRIEND_SCHEDULE_CHANGE", preference(true, "PUSH")),
    ).toEqual({ create: true, push: true });
  });
});
