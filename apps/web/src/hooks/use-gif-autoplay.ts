'use client';

import { useSyncExternalStore } from 'react';
import { readStorage, writeStorage } from '@/lib/browser-storage';

const key = 'ia_gif_autoplay';
const listeners = new Set<() => void>();
let value = true;
let initialized = false;
function readStored() {
  value = readStorage(key) !== 'false';
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
  writeStorage(key, String(next));
  listeners.forEach((listener) => listener());
}
export function useGifAutoplay() {
  const autoplay = useSyncExternalStore(subscribe, read, serverSnapshot);
  return { autoplay, setAutoplay };
}
