'use client';

import { useCallback, useEffect, useState } from 'react';
import { APP_VERSION, compareVersions, releasesSince } from '@ia/devlog';

const STORAGE_KEY = 'ia.devlog.seen-version';

function readSeenVersion(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private browsing and blocked storage both throw here. Treating that as
    // "never seen" is harmless: the reader sees the whole log.
    return null;
  }
}

function writeSeenVersion(version: string) {
  try {
    window.localStorage.setItem(STORAGE_KEY, version);
  } catch {
    // Nothing to do — the badge simply reappears next visit.
  }
}

type SeenRelease = {
  /** Releases published since this browser last opened the devlog. */
  unseenCount: number;
  /** Records the current version as read. Safe to call repeatedly. */
  markSeen: () => void;
};

/**
 * Tracks which release this browser has already read, so the devlog can
 * advertise itself once per release without a backend round trip.
 *
 * The value is per-browser on purpose: it is a reading marker, not user data.
 * It stays `0` until after mount so the server and client render the same
 * first paint.
 */
export function useSeenRelease(): SeenRelease {
  const [seenVersion, setSeenVersion] = useState<string | null>(APP_VERSION);

  useEffect(() => {
    setSeenVersion(readSeenVersion());
  }, []);

  const markSeen = useCallback(() => {
    setSeenVersion((current) => {
      if (current && compareVersions(current, APP_VERSION) >= 0) return current;
      writeSeenVersion(APP_VERSION);
      return APP_VERSION;
    });
  }, []);

  return { unseenCount: releasesSince(seenVersion).length, markSeen };
}
