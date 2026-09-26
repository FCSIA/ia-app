import { useEffect, useState } from "react";

export function useAnnouncementFeedClock(resolutionMs = 86_400_000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / resolutionMs) * resolutionMs);
  useEffect(() => {
    const timer = setTimeout(
      () => setNow(Math.floor(Date.now() / resolutionMs) * resolutionMs),
      Math.max(1, now + resolutionMs - Date.now() + 100),
    );
    return () => clearTimeout(timer);
  }, [now, resolutionMs]);
  return now;
}
