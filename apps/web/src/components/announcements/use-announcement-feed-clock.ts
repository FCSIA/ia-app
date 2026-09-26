'use client';

import { useEffect, useState } from 'react';

/** Coarse client clock for query boundaries that change with time. */
export function useAnnouncementFeedClock() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 86_400_000) * 86_400_000);
  useEffect(() => {
    const timer = window.setTimeout(
      () => setNow(Math.floor(Date.now() / 86_400_000) * 86_400_000),
      Math.max(1, now + 86_400_000 - Date.now() + 100),
    );
    return () => window.clearTimeout(timer);
  }, [now]);
  return now;
}
