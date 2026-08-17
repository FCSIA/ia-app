// Basic service worker for PWA install support
const CACHE_NAME = 'ia-school-v3';
const STATIC_ASSETS = ['/manifest.json', '/icons/ia-orbit-default-192.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
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

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || 'IA notification';
  const options = {
    body: payload.body || '',
    icon: '/icons/ia-orbit-default-192.png',
    badge: '/icons/ia-orbit-default-192.png',
    data: {
      url: payload.url || '/notifications',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
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
            client.navigate(targetUrl);
            return client.focus();
          }
        } catch { /* skip unparseable client URLs */ }
      }
      return self.clients.openWindow(targetUrl);
    })
  );
});
