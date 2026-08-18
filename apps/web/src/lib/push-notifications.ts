import { isIosDevice, isStandaloneDisplay } from '@/lib/pwa';

type PushSubscriptionPayload = {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
};

export function browserSupportsPush() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Why push is or isn't available here.
 *
 * `needs-ios-install` is the case that matters most in practice: iOS only
 * exposes the Push API to Home Screen web apps, so a Safari tab is not a
 * permanent "unsupported" — it's a prompt to install.
 */
export type PushAvailability = 'supported' | 'needs-ios-install' | 'unsupported';

export function pushAvailability(): PushAvailability {
  if (browserSupportsPush()) return 'supported';
  if (isIosDevice() && !isStandaloneDisplay()) return 'needs-ios-install';
  return 'unsupported';
}

const serviceWorkerReadyTimeoutMs = 10_000;

/**
 * A registration that is guaranteed to have an *active* worker.
 *
 * `pushManager.subscribe()` throws `AbortError: no active Service Worker` when
 * the registration it is called on is still installing, which is exactly the
 * state a first-ever visit is in when the user taps Enable push. Registering
 * and then awaiting `navigator.serviceWorker.ready` closes that window.
 *
 * `ready` never rejects — it just hangs if installation failed — so it is
 * raced against a timeout rather than awaited indefinitely, turning a dead
 * worker into a visible error instead of a spinner that never stops.
 */
export async function getServiceWorkerRegistration() {
  if (!browserSupportsPush()) return null;

  const existing = await navigator.serviceWorker.getRegistration();
  if (existing?.active) return existing;

  if (!existing) {
    await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }

  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new Error('The app service worker did not start, so push cannot be enabled.')),
        serviceWorkerReadyTimeoutMs,
      ),
    ),
  ]);
}

export function permissionState() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

/**
 * Ask for notification permission.
 *
 * MUST be called synchronously from inside the click handler. WebKit requires
 * transient user activation for this call, and awaiting anything beforehand
 * (a service worker lookup, a Convex query) spends that activation and makes
 * the request fail on iOS. Callers therefore invoke this first and await the
 * returned promise afterwards.
 */
export function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return Promise.resolve('denied');
  }
  if (Notification.permission !== 'default') {
    return Promise.resolve(Notification.permission);
  }

  // Older WebKit only supports the callback form and returns undefined.
  const result = Notification.requestPermission();
  if (result && typeof result.then === 'function') return result;
  return new Promise((resolve) => {
    Notification.requestPermission(resolve);
  });
}

export function subscriptionToPayload(subscription: PushSubscription): PushSubscriptionPayload {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new Error('Browser returned an incomplete push subscription.');
  }

  return {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  };
}

export function urlBase64ToUint8Array(value: string) {
  const trimmed = value.trim();
  const padding = '='.repeat((4 - (trimmed.length % 4)) % 4);
  const base64 = (trimmed + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

/**
 * Whether an existing subscription was created with the VAPID key we now use.
 *
 * If the server key is rotated, the browser keeps handing back the old
 * subscription while the push service rejects every send against it, so the
 * device goes quiet with no visible error. Detecting the mismatch lets us
 * resubscribe instead.
 */
function subscriptionMatchesKey(subscription: PushSubscription, applicationServerKey: Uint8Array) {
  const current = subscription.options?.applicationServerKey;
  // Browser doesn't expose the key: assume it matches rather than churn subs.
  if (!current) return true;

  const currentBytes = new Uint8Array(current as ArrayBuffer);
  if (currentBytes.length !== applicationServerKey.length) return false;
  return currentBytes.every((byte, index) => byte === applicationServerKey[index]);
}

export async function subscribeBrowserToPush(
  publicKey: string,
  permission: NotificationPermission,
) {
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration) throw new Error('This browser does not support push notifications.');

  const applicationServerKey = urlBase64ToUint8Array(publicKey);
  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    if (subscriptionMatchesKey(existing, applicationServerKey)) return existing;
    await existing.unsubscribe();
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey,
  });
}

/**
 * The subscription this browser currently holds, or null.
 *
 * Deliberately swallows a worker that never starts: callers use this to render
 * current state, and "no worker" and "no subscription" mean the same thing to
 * them. Enabling push goes through `subscribeBrowserToPush`, which does
 * surface the failure.
 */
export async function getCurrentPushSubscription() {
  try {
    const registration = await getServiceWorkerRegistration();
    return (await registration?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}
