'use client';

import { useEffect, useState } from 'react';

/** Coarse client clock for query boundaries that change with time. */
export function useAnnouncementFeedClock(resolutionMs = 86_400_000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / resolutionMs) * resolutionMs);
  useEffect(() => {
    const timer = window.setTimeout(
      () => setNow(Math.floor(Date.now() / resolutionMs) * resolutionMs),
      Math.max(1, now + resolutionMs - Date.now() + 100),
    );
    return () => window.clearTimeout(timer);
  }, [now, resolutionMs]);
  return now;
}
