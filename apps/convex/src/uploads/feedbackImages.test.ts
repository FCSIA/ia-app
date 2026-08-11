import { describe, expect, test } from "vitest";
import {
  MAX_FEEDBACK_IMAGE_BYTES,
  validateFeedbackImageMetadata,
} from "./feedbackImages";

describe("feedback image validation", () => {
  test("accepts a supported image within the size limit", () => {
    expect(
      validateFeedbackImageMetadata({ contentType: "image/png", size: 1024 }),
    ).toEqual({ mimeType: "image/png", size: 1024 });
  });

  test("rejects unsupported and oversized images", () => {
    expect(() =>
      validateFeedbackImageMetadata({ contentType: "image/svg+xml", size: 10 }),
    ).toThrow("Only PNG, JPEG, GIF, and WebP images are allowed");
    expect(() =>
      validateFeedbackImageMetadata({
        contentType: "image/jpeg",
        size: MAX_FEEDBACK_IMAGE_BYTES + 1,
      }),
    ).toThrow("Each image must be 5 MB or smaller");
  });
});
