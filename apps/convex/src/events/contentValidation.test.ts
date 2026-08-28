import { describe, expect, test } from "vitest";
import {
  MAX_EVENT_DESCRIPTION_CHARACTERS,
  MAX_EVENT_TITLE_CHARACTERS,
  normalizeEventTitle,
  normalizeOptionalEventDescription,
} from "./contentValidation";

describe("event content validation", () => {
  test("trims bounded titles and descriptions", () => {
    expect(normalizeEventTitle("  Robotics showcase  ")).toBe("Robotics showcase");
    expect(normalizeOptionalEventDescription("  Bring your project.  ")).toBe("Bring your project.");
    expect(normalizeOptionalEventDescription("  ")).toBeUndefined();
  });

  test("rejects blank or oversized event content", () => {
    expect(() => normalizeEventTitle("   ")).toThrow("Event title is required");
    expect(() => normalizeEventTitle("x".repeat(MAX_EVENT_TITLE_CHARACTERS + 1))).toThrow(
      `Event title cannot exceed ${MAX_EVENT_TITLE_CHARACTERS} characters`,
    );
    expect(() => normalizeOptionalEventDescription("x".repeat(MAX_EVENT_DESCRIPTION_CHARACTERS + 1))).toThrow(
      `Event description cannot exceed ${MAX_EVENT_DESCRIPTION_CHARACTERS} characters`,
    );
  });
});
