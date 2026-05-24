'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { pickNavigationLoadingMessage } from '@/lib/navigation-loading-messages';
import { NavigationLoadingOverlay } from '@/components/layout/navigation-loading-overlay';

/** Wait this long before showing overlay — fast navigations stay invisible. */
const SHOW_DELAY_MS = 400;
/** Minimum time overlay stays up once shown, so it does not flash away. */
const MIN_VISIBLE_MS = 250;
const MAX_VISIBLE_MS = 30_000;
const MESSAGE_ROTATE_MS = 3_200;

type NavigationLoadingContextValue = {
  startNavigation: (targetHref?: string) => void;
  isNavigating: boolean;
};

const NavigationLoadingContext = createContext<NavigationLoadingContextValue | null>(null);

function routeKey(pathname: string, search: string) {
  return search ? `${pathname}?${search}` : pathname;
}

function parseInternalHref(href: string): URL | null {
  if (
    !href ||
    href.startsWith('#') ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('javascript:')
  ) {
    return null;
  }
  try {
    return new URL(href, window.location.origin);
  } catch {
    return null;
  }
}

function shouldStartNavigation(
  url: URL,
  currentKey: string,
  modifiers: Pick<MouseEvent, 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>,
): boolean {
  if (url.origin !== window.location.origin) return false;
  if (modifiers.metaKey || modifiers.ctrlKey || modifiers.shiftKey || modifiers.altKey) {
    return false;
  }
  return routeKey(url.pathname, url.search.slice(1)) !== currentKey;
}

export function NavigationLoadingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? '/';
  const searchParams = useSearchParams();
  const search = searchParams?.toString() ?? '';
  const currentKey = routeKey(pathname, search);

  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState(pickNavigationLoadingMessage);

  const pendingRef = useRef(false);
  const visibleRef = useRef(false);
  const routeAtStartRef = useRef(currentKey);
  const shownAtRef = useRef(0);
  const showDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (showDelayTimerRef.current) clearTimeout(showDelayTimerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    showDelayTimerRef.current = null;
    hideTimerRef.current = null;
    maxTimerRef.current = null;
  }, []);

  const resetNavigation = useCallback(() => {
    pendingRef.current = false;
    visibleRef.current = false;
    setVisible(false);
  }, []);

  const finishNavigation = useCallback(() => {
    pendingRef.current = false;

    if (showDelayTimerRef.current) {
      clearTimeout(showDelayTimerRef.current);
      showDelayTimerRef.current = null;
    }

    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current);
      maxTimerRef.current = null;
    }

    if (!visibleRef.current) {
      return;
    }

    const elapsed = Date.now() - shownAtRef.current;
    const delay = Math.max(0, MIN_VISIBLE_MS - elapsed);
    hideTimerRef.current = setTimeout(() => {
      visibleRef.current = false;
      setVisible(false);
      hideTimerRef.current = null;
    }, delay);
  }, []);

  const beginNavigation = useCallback(() => {
    clearTimers();
    routeAtStartRef.current = currentKey;
    pendingRef.current = true;
    visibleRef.current = false;
    setVisible(false);
    setMessage(pickNavigationLoadingMessage());

    showDelayTimerRef.current = setTimeout(() => {
      showDelayTimerRef.current = null;
      if (!pendingRef.current) return;
      shownAtRef.current = Date.now();
      visibleRef.current = true;
      setVisible(true);
    }, SHOW_DELAY_MS);

    maxTimerRef.current = setTimeout(() => {
      resetNavigation();
      maxTimerRef.current = null;
    }, MAX_VISIBLE_MS);
  }, [clearTimers, currentKey, resetNavigation]);

  const startNavigation = useCallback(
    (targetHref?: string) => {
      if (targetHref) {
        const url = parseInternalHref(targetHref);
        if (
          url &&
          !shouldStartNavigation(url, currentKey, {
            metaKey: false,
            ctrlKey: false,
            shiftKey: false,
            altKey: false,
          })
        ) {
          return;
        }
      }
      beginNavigation();
    },
    [beginNavigation, currentKey],
  );

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      const anchor = (event.target as HTMLElement | null)?.closest('a');
      if (!anchor) return;
      if (anchor.hasAttribute('data-skip-nav-loading')) return;
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href');
      const url = href ? parseInternalHref(href) : null;
      if (!url) return;
      if (!shouldStartNavigation(url, currentKey, event)) return;

      beginNavigation();
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [beginNavigation, currentKey]);

  useEffect(() => {
    if (!pendingRef.current) return;
    if (currentKey === routeAtStartRef.current) return;
    finishNavigation();
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [currentKey, finishNavigation]);

  useEffect(() => {
    if (!visible) return;
    const id = setInterval(() => setMessage(pickNavigationLoadingMessage()), MESSAGE_ROTATE_MS);
    return () => clearInterval(id);
  }, [visible]);

  useEffect(() => clearTimers, [clearTimers]);

  return (
    <NavigationLoadingContext.Provider value={{ startNavigation, isNavigating: visible }}>
      {children}
      <NavigationLoadingOverlay visible={visible} message={message} />
    </NavigationLoadingContext.Provider>
  );
}

export function useNavigationLoading() {
  const ctx = useContext(NavigationLoadingContext);
  if (!ctx) {
    throw new Error('useNavigationLoading must be used within NavigationLoadingProvider');
  }
  return ctx;
}

/** Safe when provider is absent (e.g. tests). */
export function useNavigationLoadingOptional() {
  return useContext(NavigationLoadingContext);
}
