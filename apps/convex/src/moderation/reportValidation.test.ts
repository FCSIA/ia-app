import { describe, expect, test } from "vitest";
import {
  MAX_MODERATION_REPORT_REASON_CHARACTERS,
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
});
