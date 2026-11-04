import type { FeedbackMetadata } from '~/apps/shared/feedback-metadata';

export function collectFeedbackMetadata(): FeedbackMetadata {
  return {
    userAgent: navigator.userAgent.slice(0, 512),
    platform: navigator.platform.slice(0, 512),
    language: navigator.language.slice(0, 512),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    screenWidth: screen.width,
    screenHeight: screen.height,
    pixelRatio: window.devicePixelRatio || 1,
    touchPoints: navigator.maxTouchPoints,
    displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
  };
}
