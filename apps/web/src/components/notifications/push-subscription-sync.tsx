'use client';

import { useEffect, useRef } from 'react';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import {
  browserSupportsPush,
  getCurrentPushSubscription,
  subscribeBrowserToPush,
  subscriptionToPayload,
} from '@/lib/push-notifications';

/**
 * Keeps an already-granted push subscription in sync with the server.
 *
 * A device that once enabled push can quietly stop receiving it: push services
 * rotate endpoints, the server row can be lost or disabled after transient
 * failures, and rotating the VAPID key invalidates every existing
 * subscription. None of that surfaces to the user — notifications just stop.
 *
 * This re-registers the current subscription on load when permission is
 * already granted. It never prompts: no local subscription means the user
 * hasn't opted in (or explicitly opted out), and we leave that alone.
 */
export function PushSubscriptionSync() {
  const { isAuthenticated } = useConvexAuth();
  const publicKey = useQuery(api.notifications.push.getPublicKey, isAuthenticated ? {} : 'skip');
  const upsertSubscription = useMutation(api.notifications.push.upsertSubscription);
  const attempted = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || !publicKey || attempted.current) return;
    if (!browserSupportsPush() || Notification.permission !== 'granted') return;

    attempted.current = true;
    let cancelled = false;

    void (async () => {
      try {
        const existing = await getCurrentPushSubscription();
        if (!existing || cancelled) return;

        // Re-runs the key check, replacing the subscription if the VAPID key
        // has rotated. Permission is already granted, so this is silent.
        const current = await subscribeBrowserToPush(publicKey, 'granted');
        if (cancelled) return;

        await upsertSubscription({
          subscription: subscriptionToPayload(current),
          userAgent: navigator.userAgent,
        });
      } catch {
        // Best effort — the settings panel remains the explicit path.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, publicKey, upsertSubscription]);

  return null;
}
