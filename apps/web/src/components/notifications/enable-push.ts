'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useMutation } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import {
  getPushDeviceId,
  requestNotificationPermission,
  setPushOptedOut,
  subscribeBrowserToPush,
  subscriptionToPayload,
} from '@/lib/push-notifications';

/**
 * Whether this device should be offered a way to turn push back on.
 *
 * Set from the server's answer to the launch-time device report, which knows
 * whether this install used to receive push. Module state, because the report
 * runs in the app shell and the prompt renders on the dashboard.
 */
let promptReenable = false;
const listeners = new Set<() => void>();

export function setPushReenablePrompt(next: boolean) {
  if (next === promptReenable) return;
  promptReenable = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function usePushReenablePrompt() {
  return useSyncExternalStore(subscribe, () => promptReenable, () => false);
}

/**
 * Turn push on for this browser install.
 *
 * The returned function MUST be called synchronously from a tap handler. It
 * asks for notification permission before awaiting anything, because WebKit
 * rejects the request once the tap's user activation has been spent.
 */
export function useEnablePush() {
  const upsertSubscription = useMutation(api.notifications.push.upsertSubscription);
  const activatePush = useMutation(api.notifications.preferences.activatePush);

  return useCallback(
    (publicKey: string) => {
      const permissionRequest = requestNotificationPermission();

      return (async () => {
        const permission = await permissionRequest;
        if (permission !== 'granted') return { permission, endpoint: null };

        const subscription = await subscribeBrowserToPush(publicKey, permission);
        const deviceId = getPushDeviceId();
        await upsertSubscription({
          subscription: subscriptionToPayload(subscription),
          userAgent: navigator.userAgent,
          ...(deviceId ? { deviceId } : {}),
        });
        await activatePush({});
        setPushOptedOut(false);
        setPushReenablePrompt(false);
        return { permission, endpoint: subscription.endpoint };
      })();
    },
    [activatePush, upsertSubscription],
  );
}
