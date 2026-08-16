/**
 * Platform/display-mode detection used to decide how push can be offered.
 *
 * The important case is iOS: WebKit only exposes the Push API to web apps
 * launched from the Home Screen. In a plain Safari tab `window.Notification`
 * is undefined, so a naive capability check reports "unsupported" for a device
 * that supports push perfectly well once installed.
 */

/** True when the page is running as an installed web app rather than a tab. */
export function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;

  const standaloneMedia =
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    window.matchMedia?.('(display-mode: fullscreen)').matches === true ||
    window.matchMedia?.('(display-mode: minimal-ui)').matches === true;

  // iOS Safari predates display-mode and exposes its own flag.
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  return standaloneMedia || iosStandalone;
}

/** True for iPhone/iPad, including iPadOS which reports a desktop user agent. */
export function isIosDevice() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ masquerades as Macintosh; touch points disambiguate it.
  return /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
}
