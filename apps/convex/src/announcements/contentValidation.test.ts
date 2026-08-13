import { describe, expect, test } from "vitest";
import {
  MAX_ANNOUNCEMENT_COMMENT_CHARACTERS,
  normalizeBoundedText,
  normalizeOptionalBoundedText,
} from "./contentValidation";

describe("announcement content validation", () => {
  test("trims bounded text and rejects blank or oversized content", () => {
    expect(normalizeBoundedText("  Follow-up  ", "Comment", 20)).toBe("Follow-up");
    expect(() => normalizeBoundedText("   ", "Comment", 20)).toThrow("Comment cannot be empty");
    expect(() => normalizeBoundedText("x".repeat(MAX_ANNOUNCEMENT_COMMENT_CHARACTERS + 1), "Comment", MAX_ANNOUNCEMENT_COMMENT_CHARACTERS)).toThrow("Comment is too long");
  });

  test("keeps omitted optional text omitted", () => {
    expect(normalizeOptionalBoundedText(undefined, "Rejection note", 20)).toBeUndefined();
  });
});
