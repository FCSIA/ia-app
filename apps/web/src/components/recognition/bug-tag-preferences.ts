'use client';

import { useMemo, useSyncExternalStore } from 'react';

export type BugTagPreferences = { colors: [string, string, string]; animation: 'drift' | 'shimmer' | 'breathe' | 'none' };
export const DEFAULT_BUG_TAG_PREFERENCES: BugTagPreferences = { colors: ['#78b8b0', '#b29acb', '#c5ae79'], animation: 'drift' };
const EMPTY = JSON.stringify(DEFAULT_BUG_TAG_PREFERENCES);
const EVENT = 'ia-local-bug-tag-preferences';
function localPreview() {
  return process.env.NODE_ENV === 'development' && typeof window !== 'undefined' && ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
}
function subscribe(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener(EVENT, listener);
  return () => { window.removeEventListener('storage', listener); window.removeEventListener(EVENT, listener); };
}
export function useBugTagPreferences(userId?: string) {
  const available = useSyncExternalStore(subscribe, localPreview, () => false);
  const key = `ia:local-bug-tag:${userId ?? ''}`;
  const raw = useSyncExternalStore(subscribe, () => {
    if (!userId || !localPreview()) return EMPTY;
    try { return localStorage.getItem(key) ?? EMPTY; } catch { return EMPTY; }
  }, () => EMPTY);
  const preferences = useMemo<BugTagPreferences>(() => {
    try {
      const value = JSON.parse(raw);
      if (!Array.isArray(value.colors) || value.colors.length !== 3 || !value.colors.every((color: unknown) => typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color)) || !['drift', 'shimmer', 'breathe', 'none'].includes(value.animation)) return DEFAULT_BUG_TAG_PREFERENCES;
      return value;
    } catch { return DEFAULT_BUG_TAG_PREFERENCES; }
  }, [raw]);
  function save(next: BugTagPreferences) {
    if (!userId || !localPreview()) return false;
    try { localStorage.setItem(key, JSON.stringify(next)); window.dispatchEvent(new Event(EVENT)); return true; } catch { return false; }
  }
  return { preferences, save, available };
}
