// Basic service worker for PWA install support
const CACHE_NAME = 'ia-school-v4';
const STATIC_ASSETS = ['/manifest.json', '/icons/ia-orbit-default-192.png'];

/**
 * Warm the cache without ever failing installation.
 *
 * `cache.addAll()` rejects as a unit, and a rejected `install` handler aborts
 * the whole registration: no active worker, no push, no install prompt, and no
 * error anywhere the user can see it. A single renamed icon used to be enough
 * to silently disable notifications on every device that had not already
 * activated an older worker. Caching is an optimisation, so each asset is
 * fetched independently and failures are swallowed.
 */
async function warmCache() {
  try {
    const cache = await caches.open(CACHE_NAME);
    await Promise.allSettled(STATIC_ASSETS.map((asset) => cache.add(asset)));
  } catch {
    // Storage unavailable (private mode, quota). Not fatal.
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(warmCache());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .catch(() => undefined)
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Network-first strategy; fall back to cache for navigation
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match('/').then((r) => r || fetch(event.request))
      )
    );
    return;
  }
  // API calls: always network
  if (event.request.url.includes('/api/')) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'CLEAR_AUTH_CACHES') {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))));
  }
});

/**
 * Notifications must never collapse silently.
 *
 * A `tag` replaces any showing notification carrying the same tag, and unless
 * `renotify` is set the replacement happens with no sound, no vibration and no
 * heads-up banner. Tagging every notification with its category therefore made
 * Android look broken: the first announcement arrived, and every one after it
 * swapped in behind the shade unannounced. Each notification now gets its own
 * tag unless the payload asks for grouping, and any tagged notification
 * re-alerts. `renotify` without a tag is a TypeError, so the two travel together.
 */
function notificationOptions(payload) {
  const tag = payload.tag || `ia-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return {
    body: payload.body || '',
    icon: payload.icon || '/icons/ia-orbit-default-192.png',
    badge: payload.badge || '/icons/ia-orbit-default-192.png',
    data: {
      url: payload.url || '/notifications',
      category: payload.category,
    },
    tag,
    renotify: true,
    timestamp: Date.now(),
    // `silent: true` alongside `vibrate` is a TypeError, so this pair has to
    // stay consistent.
    silent: false,
    vibrate: [100, 50, 100],
  };
}

self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { body: event.data.text() };
    }
  }

  const title = payload.title || 'IA notification';
  const options = notificationOptions(payload);

  // Android drops the app's push permission if a push event resolves without
  // showing anything, so the fallback still has to display a notification.
  event.waitUntil(
    self.registration.showNotification(title, options).catch((err) => {
      console.warn('[SW] showNotification with rich options failed, trying minimal:', err);
      return self.registration.showNotification(title, {
        body: options.body,
        data: options.data,
      });
    })
  );
});

/**
 * Re-subscribe when the browser invalidates a subscription.
 *
 * Chrome on Android rotates push subscriptions on its own — after a WebAPK
 * update, an FCM registration refresh, or storage pressure. Without this the
 * old endpoint keeps receiving sends that go nowhere and the device goes quiet
 * until someone happens to reopen the app. Re-subscribing here keeps the
 * browser side alive immediately; open clients are told to push the new
 * endpoint to the server, and `PushSubscriptionSync` covers the rest on the
 * next load.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const applicationServerKey =
        event.oldSubscription?.options?.applicationServerKey ??
        (await self.registration.pushManager.getSubscription())?.options?.applicationServerKey;

      if (!applicationServerKey) return;

      try {
        await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });
      } catch (err) {
        console.warn('[SW] Re-subscribe after pushsubscriptionchange failed:', err);
        return;
      }

      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const client of clients) {
        client.postMessage({ type: 'PUSH_SUBSCRIPTION_CHANGED' });
      }
    })()
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/notifications', self.location.origin).href;

  // Compare by origin + pathname to avoid mismatches from query params or
  // trailing slashes, which is common on Android Chrome PWA.
  const target = new URL(targetUrl);
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        try {
          const existing = new URL(client.url);
          if (
            existing.origin === target.origin &&
            existing.pathname.replace(/\/$/, '') === target.pathname.replace(/\/$/, '') &&
            'focus' in client
          ) {
            if ('navigate' in client && client.url !== targetUrl) {
              client.navigate(targetUrl);
            }
            return client.focus();
          }
        } catch { /* skip unparseable client URLs */ }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
