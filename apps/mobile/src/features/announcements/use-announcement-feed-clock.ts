import { useEffect, useState } from "react";

export const DAY_MS = 86_400_000;

/**
 * The feed's `now` argument is floored so the query arguments hold for a whole
 * window; a ticking `Date.now()` would be a new subscription on every render.
 */
export function floorToResolution(resolutionMs: number, at = Date.now()) {
  return Math.floor(at / resolutionMs) * resolutionMs;
}

export function useAnnouncementFeedClock(resolutionMs = DAY_MS) {
  const [now, setNow] = useState(() => floorToResolution(resolutionMs));
  useEffect(() => {
    const timer = setTimeout(
      () => setNow(floorToResolution(resolutionMs)),
      Math.max(1, now + resolutionMs - Date.now() + 100),
    );
    return () => clearTimeout(timer);
  }, [now, resolutionMs]);
  return now;
}
