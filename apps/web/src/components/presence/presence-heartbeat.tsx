'use client';

import { useEffect, useRef } from 'react';
import { useConvexAuth, useMutation } from '@/lib/convex-react';
import { convex } from '@/lib/convex';
import { devicePlatform } from '@/lib/pwa';
import { randomId } from '@/lib/random-id';
import { api } from '~/apps/convex/src/_generated/api';

// Matches the server's presence interval; a missed beat goes offline after a few.
const heartbeatMs = 30_000;
const sessionKey = 'ia.presence-session.v1';

/** One id per tab, so two tabs are two sessions of the same person. */
function tabSessionId() {
  try {
    const existing = sessionStorage.getItem(sessionKey);
    if (existing) return existing;
    const created = randomId();
    sessionStorage.setItem(sessionKey, created);
    return created;
  } catch {
    return randomId();
  }
}

/**
 * Keeps the signed-in person shown as online while a tab is visible.
 *
 * Heartbeats run only while the page is visible: a backgrounded tab stops
 * and is disconnected, so "online" means someone is actually looking at the
 * app. A closing tab disconnects through `sendBeacon`, which still delivers
 * while the page unloads.
 */
export function PresenceHeartbeat() {
  const { isAuthenticated } = useConvexAuth();
  const heartbeat = useMutation(api.presence.status.heartbeat);
  const sessionToken = useRef<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    const sessionId = tabSessionId();
    const platform = devicePlatform();
    let timer: ReturnType<typeof setInterval> | undefined;

    const beat = () => {
      heartbeat({ sessionId, platform })
        .then((result) => {
          sessionToken.current = result.sessionToken;
        })
        .catch(() => {
          // Presence is best effort; the next beat retries.
        });
    };
    const disconnect = () => {
      if (!sessionToken.current) return;
      const body = JSON.stringify({
        path: 'presence/status:disconnect',
        args: { sessionToken: sessionToken.current },
      });
      navigator.sendBeacon?.(`${convex.url}/api/mutation`, new Blob([body], { type: 'application/json' }));
      sessionToken.current = null;
    };
    const start = () => {
      if (timer) return;
      beat();
      timer = setInterval(beat, heartbeatMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
      disconnect();
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', stop);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', stop);
      stop();
    };
  }, [heartbeat, isAuthenticated]);

  return null;
}
