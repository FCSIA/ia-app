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
  displayMode: "browser" | "standalone";
};
