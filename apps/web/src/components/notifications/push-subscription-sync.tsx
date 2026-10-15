'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useConvexAuth, useMutation, useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import { devicePlatform, isStandaloneDisplay } from '@/lib/pwa';
import {
  browserSupportsPush,
  getPushDeviceId,
  isPushOptedOut,
  permissionState,
  readPushSubscriptionState,
  subscribeBrowserToPush,
  subscriptionToPayload,
} from '@/lib/push-notifications';
import { setPushReenablePrompt } from './enable-push';

/**
 * Keeps this device's push subscription in sync with the server, and tells the
 * server what the device can actually receive.
 *
 * A device that once enabled push can quietly stop receiving it: push services
 * rotate endpoints, the server row can be lost or disabled after transient
 * failures, and rotating the VAPID key invalidates every existing
 * subscription. None of that surfaces to the user — notifications just stop.
 *
 * When permission is still granted this repairs it silently, re-subscribing if
 * the browser lost its subscription, unless the user turned push off here with
 * Disable push. It never prompts.
 *
 * iOS can also reset a Home Screen app's permission to "ask" and drop its
 * subscription, while Apple keeps accepting sends to the dead endpoint for over
 * a week. Only the device knows, so every launch reports its permission and
 * the endpoint it holds. The server disables endpoints the device no longer
 * holds and answers whether to offer a one-tap re-enable on the dashboard.
 *
 * Android rotates subscriptions on its own after a WebAPK update or an FCM
 * registration refresh, so the service worker also re-subscribes and posts
 * `PUSH_SUBSCRIPTION_CHANGED`; that message is handled here so the new
 * endpoint reaches the server without waiting for the next cold start.
 */
export function PushSubscriptionSync() {
  const { isAuthenticated } = useConvexAuth();
  const publicKey = useQuery(api.notifications.push.getPublicKey, isAuthenticated ? {} : 'skip');
  const upsertSubscription = useMutation(api.notifications.push.upsertSubscription);
  const reportDeviceState = useMutation(api.notifications.pushDevices.reportState);
  const attempted = useRef(false);
  const configuredKey = publicKey ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null;

  const sync = useCallback(
    async (key: string) => {
      const deviceId = getPushDeviceId();
      const permission = permissionState();
      const optedOut = isPushOptedOut();
      // Undefined when the browser's subscription could not be read.
      let endpoint: string | null | undefined;

      if (browserSupportsPush()) {
        const state = await readPushSubscriptionState();
        endpoint = state?.endpoint;

        if (permission === 'granted' && state && (state.endpoint !== null || !optedOut)) {
          try {
            // Re-runs the key check, replacing the subscription if missing or if
            // the VAPID key has rotated. Permission is granted, so this is silent.
            const current = await subscribeBrowserToPush(key.trim(), 'granted');
            endpoint = current.endpoint;
            await upsertSubscription({
              subscription: subscriptionToPayload(current),
              userAgent: navigator.userAgent,
              ...(deviceId ? { deviceId } : {}),
            });
          } catch {
            // Best effort — the settings panel remains the explicit path.
          }
        }
      }

      if (!deviceId) return;
      try {
        const result = await reportDeviceState({
          deviceId,
          platform: devicePlatform(),
          standalone: isStandaloneDisplay(),
          permission,
          endpoint,
          ...(optedOut ? { optedOut } : {}),
          userAgent: navigator.userAgent,
        });
        setPushReenablePrompt(result.promptReenable);
      } catch {
        // Reporting is diagnostic; push itself does not depend on it.
      }
    },
    [reportDeviceState, upsertSubscription],
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
