'use client';

import { useSyncExternalStore } from 'react';

const key = 'ia_gif_autoplay';
const eventName = 'ia-gif-playback-change';
function read() {
  try { return localStorage.getItem(key) !== 'false'; } catch { return true; }
}
function subscribe(listener: () => void) {
  window.addEventListener('storage', listener);
  window.addEventListener(eventName, listener);
  return () => {
    window.removeEventListener('storage', listener);
    window.removeEventListener(eventName, listener);
  };
}
const serverSnapshot = () => false;
function setAutoplay(value: boolean) {
  localStorage.setItem(key, String(value));
  window.dispatchEvent(new Event(eventName));
}
export function useGifAutoplay() {
  const autoplay = useSyncExternalStore(subscribe, read, serverSnapshot);
  return { autoplay, setAutoplay };
}
