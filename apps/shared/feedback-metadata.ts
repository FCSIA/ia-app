export const FEEDBACK_DISPLAY_MODES = ["browser", "standalone"] as const;

/** Diagnostics only: no identity, IP, referrer, query string, or free-form URL. */
export type FeedbackMetadata = {
  userAgent: string;
  platform: string;
  language: string;
  timezone: string;
  viewportWidth: number;
  viewportHeight: number;
  screenWidth: number;
  screenHeight: number;
  pixelRatio: number;
  touchPoints: number;
  displayMode: (typeof FEEDBACK_DISPLAY_MODES)[number];
};
