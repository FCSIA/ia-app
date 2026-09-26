import { useEffect, useState } from "react";

export function useAnnouncementFeedClock() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 86_400_000) * 86_400_000);
  useEffect(() => {
    const timer = setTimeout(
      () => setNow(Math.floor(Date.now() / 86_400_000) * 86_400_000),
      Math.max(1, now + 86_400_000 - Date.now() + 100),
    );
    return () => clearTimeout(timer);
  }, [now]);
  return now;
}
