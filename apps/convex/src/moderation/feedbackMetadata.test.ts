import { describe, expect, it } from "vitest";
import { validateFeedbackMetadata } from "./feedbackMetadata";

const metadata = {
  userAgent: "Synthetic Browser", platform: "Synthetic OS", language: "en-US",
  timezone: "America/New_York", viewportWidth: 390, viewportHeight: 844,
  screenWidth: 390, screenHeight: 844, pixelRatio: 3, touchPoints: 5,
  displayMode: "browser" as const,
};

describe("feedback diagnostics", () => {
  it("retains the bounded diagnostic fields", () => {
    expect(validateFeedbackMetadata(metadata)).toEqual(metadata);
  });
  it("rejects malformed and oversized client data", () => {
    for (const patch of [{ userAgent: "x".repeat(513) }, { timezone: "a\nb" }, { viewportWidth: -1 }, { screenHeight: Infinity }, { pixelRatio: NaN }]) {
      expect(() => validateFeedbackMetadata({ ...metadata, ...patch })).toThrow("Invalid feedback diagnostics");
    }
  });
});
