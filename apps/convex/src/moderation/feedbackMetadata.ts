import { ConvexError, v } from "convex/values";
import { FEEDBACK_DISPLAY_MODES, type FeedbackMetadata } from "../../../shared/feedback-metadata";

export const feedbackMetadataValidator = v.object({
  userAgent: v.string(),
  platform: v.string(),
  language: v.string(),
  timezone: v.string(),
  viewportWidth: v.number(),
  viewportHeight: v.number(),
  screenWidth: v.number(),
  screenHeight: v.number(),
  pixelRatio: v.number(),
  touchPoints: v.number(),
  displayMode: v.union(...FEEDBACK_DISPLAY_MODES.map((mode) => v.literal(mode))),
});


export function validateFeedbackMetadata(metadata: FeedbackMetadata) {
  for (const value of [metadata.userAgent, metadata.platform, metadata.language, metadata.timezone]) {
    if (value.length > 512 || /[\r\n\x00-\x1f]/.test(value)) {
      throw new ConvexError("Invalid feedback diagnostics");
    }
  }
  for (const value of [metadata.viewportWidth, metadata.viewportHeight, metadata.screenWidth,
    metadata.screenHeight, metadata.touchPoints]) {
    if (!Number.isInteger(value) || value < 0 || value > 100_000) {
      throw new ConvexError("Invalid feedback diagnostics");
    }
  }
  if (!Number.isFinite(metadata.pixelRatio) || metadata.pixelRatio <= 0 || metadata.pixelRatio > 100) {
    throw new ConvexError("Invalid feedback diagnostics");
  }
  return metadata;
}
