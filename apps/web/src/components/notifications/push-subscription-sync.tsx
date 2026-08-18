'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import {
  browserSupportsPush,
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
 *
 * Android is the platform that needs this most. Chrome rotates subscriptions
 * on its own after a WebAPK update or an FCM registration refresh, so the
 * service worker also re-subscribes and posts `PUSH_SUBSCRIPTION_CHANGED`;
 * that message is handled here so the new endpoint reaches the server without
 * waiting for the next cold start.
 */
export function PushSubscriptionSync() {
  const { isAuthenticated } = useConvexAuth();
  const publicKey = useQuery(api.notifications.push.getPublicKey, isAuthenticated ? {} : 'skip');
  const upsertSubscription = useMutation(api.notifications.push.upsertSubscription);
  const attempted = useRef(false);
  const configuredKey = publicKey ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;

  const sync = useCallback(
    async (key: string) => {
      if (!browserSupportsPush() || Notification.permission !== 'granted') return;
      try {
        // Re-runs the key check, replacing the subscription if missing or if the
        // VAPID key has rotated. Permission is already granted, so this is silent.
        const current = await subscribeBrowserToPush(key.trim(), 'granted');
        if (!current) return;

        await upsertSubscription({
          subscription: subscriptionToPayload(current),
          userAgent: navigator.userAgent,
        });
      } catch {
        // Best effort — the settings panel remains the explicit path.
      }
    },
    [upsertSubscription],
  );

  useEffect(() => {
    if (!isAuthenticated || !configuredKey || attempted.current) return;
    attempted.current = true;
    void sync(configuredKey);
  }, [isAuthenticated, configuredKey, sync]);

  useEffect(() => {
    if (!isAuthenticated || !configuredKey) return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    function onMessage(event: MessageEvent) {
      if (event.data?.type !== 'PUSH_SUBSCRIPTION_CHANGED') return;
      void sync(configuredKey as string);
    }

    navigator.serviceWorker.addEventListener('message', onMessage);
    return () => navigator.serviceWorker.removeEventListener('message', onMessage);
  }, [isAuthenticated, configuredKey, sync]);

  return null;
}
