'use client';

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from 'react';

export const MediaPlaybackContext = createContext(true);

type Visibility = { visible: boolean; nearby: boolean };
type Watcher = (visible: boolean) => void;
const watchers = [new Map<Element, Watcher>(), new Map<Element, Watcher>()];
const observers: Array<IntersectionObserver | undefined> = [];

/** Shared observers respect viewport and scroll-container clipping without scroll handlers. */
export function observeMedia(element: Element, listener: (value: Visibility) => void) {
  const state = { visible: false, nearby: false };
  if (typeof IntersectionObserver === 'undefined') {
    listener({ visible: true, nearby: true });
    return () => {};
  }
  for (const index of [0, 1]) {
    observers[index] ??= new IntersectionObserver((entries) => {
      for (const entry of entries) {
        watchers[index].get(entry.target)?.(entry.isIntersecting && entry.intersectionRatio > 0);
      }
    }, { rootMargin: index === 0 ? '0px' : '240px' });
    watchers[index].set(element, (value) => {
      const key = index === 0 ? 'visible' : 'nearby';
      if (state[key] === value) return;
      state[key] = value;
      listener({ ...state });
    });
    observers[index]!.observe(element);
  }
  return () => {
    for (const index of [0, 1]) {
      watchers[index].delete(element);
      observers[index]?.unobserve(element);
      if (watchers[index].size === 0) {
        observers[index]?.disconnect();
        observers[index] = undefined;
      }
    }
  };
}

const pageListeners = new Set<() => void>();
const notifyPageVisibility = () => pageListeners.forEach((listener) => listener());
export function subscribePageVisibility(listener: () => void) {
  if (pageListeners.size === 0) document.addEventListener('visibilitychange', notifyPageVisibility);
  pageListeners.add(listener);
  return () => {
    pageListeners.delete(listener);
    if (pageListeners.size === 0) document.removeEventListener('visibilitychange', notifyPageVisibility);
  };
}
const pageVisible = () => document.visibilityState === 'visible';
const serverVisible = () => false;

export function useMediaVisibility() {
  const active = useContext(MediaPlaybackContext);
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [visibility, setVisibility] = useState<Visibility>({ visible: false, nearby: false });
  const ref = useCallback((node: HTMLDivElement | null) => setElement(node), []);
  const pageActive = useSyncExternalStore(subscribePageVisibility, pageVisible, serverVisible);
  useEffect(() => {
    setVisibility({ visible: false, nearby: false });
    if (element) return observeMedia(element, setVisibility);
  }, [element]);
  return { ref, ...visibility, pageActive: pageActive && active };
}
