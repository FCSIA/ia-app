import { useEffect, useState } from "react";
import { DAY_MS, floorToResolution } from "@/lib/time-window";

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
