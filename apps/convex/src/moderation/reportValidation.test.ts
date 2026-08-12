import { describe, expect, test } from "vitest";
import {
  MAX_FEEDBACK_RESPONSE_CHARACTERS,
  MAX_MODERATION_REPORT_REASON_CHARACTERS,
  normalizeFeedbackResponse,
  normalizeModerationReportReason,
} from "./reportValidation";

describe("moderation report validation", () => {
  test("normalizes a report reason", () => {
    expect(normalizeModerationReportReason("  Please review this.  ")).toBe(
      "Please review this.",
    );
  });

  test("requires a bounded reason", () => {
    expect(() => normalizeModerationReportReason("   ")).toThrow("Reason required");
    expect(() =>
      normalizeModerationReportReason(
        "x".repeat(MAX_MODERATION_REPORT_REASON_CHARACTERS + 1),
      ),
    ).toThrow("Report reason is too long");
  });

  test("requires a bounded staff response", () => {
    expect(normalizeFeedbackResponse("  Thank you for the detail.  ")).toBe(
      "Thank you for the detail.",
    );
    expect(() => normalizeFeedbackResponse("   ")).toThrow("Response required");
    expect(() =>
      normalizeFeedbackResponse("x".repeat(MAX_FEEDBACK_RESPONSE_CHARACTERS + 1)),
    ).toThrow("Response is too long");
  });
});
