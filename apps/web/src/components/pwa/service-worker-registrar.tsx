'use client';

import { useEffect } from 'react';

/**
 * Registers the app service worker on load.
 *
 * Previously the worker was only registered as a side effect of opening
 * notification settings, which left most sessions without one. That blocks
 * Android's install prompt (Chrome requires an active worker with a fetch
 * handler) and means an installed PWA can be running with no worker at all,
 * so push could never be delivered.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Registration is best effort; the app works without it.
      });
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }

    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}
