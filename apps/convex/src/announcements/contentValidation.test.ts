import { describe, expect, test } from "vitest";
import {
  MAX_ANNOUNCEMENT_COMMENT_CHARACTERS,
  MAX_ANNOUNCEMENT_EMBEDS,
  normalizeBoundedText,
  normalizeAnnouncementEmbedUrls,
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

test("accepts unique HTTPS embed links and rejects unsafe or excessive links", () => {
  expect(normalizeAnnouncementEmbedUrls(["https://example.com/video"])).toEqual([
    "https://example.com/video",
  ]);
  expect(() => normalizeAnnouncementEmbedUrls(["http://example.com"])).toThrow("HTTPS");
  expect(() => normalizeAnnouncementEmbedUrls(Array.from({ length: MAX_ANNOUNCEMENT_EMBEDS + 1 }, (_, index) => `https://example.com/${index}`))).toThrow("up to");
});
