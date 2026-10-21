'use client';

import { useSyncExternalStore } from 'react';

const key = 'ia_gif_autoplay';
const listeners = new Set<() => void>();
let value = true;
let initialized = false;
function readStored() {
  try { value = localStorage.getItem(key) !== 'false'; } catch { /* Keep this tab's choice when storage is blocked. */ }
  initialized = true;
}
function read() {
  if (!initialized) readStored();
  return value;
}
function onStorage(event: StorageEvent) {
  if (event.key !== key && event.key !== null) return;
  readStored();
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    readStored();
    window.addEventListener('storage', onStorage);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}
const serverSnapshot = () => false;
function setAutoplay(next: boolean) {
  value = next;
  initialized = true;
  try { localStorage.setItem(key, String(next)); } catch { /* Still update this tab. */ }
  listeners.forEach((listener) => listener());
}
export function useGifAutoplay() {
  const autoplay = useSyncExternalStore(subscribe, read, serverSnapshot);
  return { autoplay, setAutoplay };
}
