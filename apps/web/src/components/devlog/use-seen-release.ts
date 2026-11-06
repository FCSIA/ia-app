'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { APP_VERSION, compareVersions, releasesSince } from '@ia/devlog';
import { readStorage, writeStorage } from '@/lib/browser-storage';

const STORAGE_KEY = 'ia.devlog.seen-version';
const STORAGE_CHANGE_EVENT = 'ia.devlog.seen-version.changed';

function subscribeToSeenVersion(onStoreChange: () => void) {
  function onStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY && event.storageArea === window.localStorage) {
      onStoreChange();
    }
  }

  window.addEventListener('storage', onStorage);
  window.addEventListener(STORAGE_CHANGE_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(STORAGE_CHANGE_EVENT, onStoreChange);
  };
}

function getServerSeenVersion() {
  return APP_VERSION;
}

function readSeenVersion(): string | null {
  return readStorage(STORAGE_KEY);
}

function writeSeenVersion(version: string) {
  if (writeStorage(STORAGE_KEY, version)) window.dispatchEvent(new Event(STORAGE_CHANGE_EVENT));
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
 * The server snapshot is the current version so hydration is stable; the
 * browser snapshot then reads local storage as an external store.
 */
export function useSeenRelease(): SeenRelease {
  const seenVersion = useSyncExternalStore(
    subscribeToSeenVersion,
    readSeenVersion,
    getServerSeenVersion,
  );

  const markSeen = useCallback(() => {
    const current = readSeenVersion();
    if (!current || compareVersions(current, APP_VERSION) < 0) {
      writeSeenVersion(APP_VERSION);
    }
  }, []);

  return { unseenCount: releasesSince(seenVersion).length, markSeen };
}
