---
tags: [feature, notifications]
---

# Notifications

[Home](../index.md)

Notifications provide an in-app inbox, unread count, user preferences, and
browser push delivery for subscribed devices.

## What It Does

- Lists recent notification deliveries.
- Supports cursor pagination for the inbox.
- Tracks unread count.
- Marks one or many notifications as read.
- Stores per-category and scoped preferences.
- Stores per-user browser push subscriptions.
- Sends Web Push for categories configured at `PUSH` or `TIME_SENSITIVE`.
- Activates supported alert categories for push when a user explicitly enables
  browser push, while preserving explicit opt-outs.

## Source Files

- Backend: `apps/convex/src/notifications/`
- Inbox page: `apps/web/src/app/notifications/page.tsx`
- Preference controls: `apps/web/src/components/notifications/`
- Service worker: `apps/web/public/sw.js`
- Service worker registration: `apps/web/src/components/pwa/service-worker-registrar.tsx`
- Subscription drift repair: `apps/web/src/components/notifications/push-subscription-sync.tsx`
- Platform detection: `apps/web/src/lib/pwa.ts`
- Unread nav badge: `apps/web/src/components/layout/AppShell.tsx`

## Convex Surface

- `api.notifications.inbox.list`
- `api.notifications.inbox.listPage`
- `api.notifications.inbox.unreadCount`
- `api.notifications.inbox.markRead`
- `api.notifications.inbox.markAllRead`
- `api.notifications.preferences.list`
- `api.notifications.preferences.upsert`
- `api.notifications.preferences.activatePush`
- `api.notifications.push.getPublicKey`
- `api.notifications.push.listMine`
- `api.notifications.push.upsertSubscription`
- `api.notifications.push.removeSubscription`

## Data Model

- `notificationDeliveries`
- `notificationPreferences`
- `notificationPushSubscriptions`

Preference levels are `OFF`, `IN_APP`, `PUSH`, and `TIME_SENSITIVE`. The schema
also supports category and scope keys such as global, club, and channel scopes.

## Categories

The validator includes school announcements, club announcements, club join
requests, club channel messages, mentions, thread replies, events, Flex Friday,
content moderation, friend requests, and friend schedule changes.

## Browser Push

Closed-tab delivery uses the browser Push API and the app service worker.
Each Convex deployment needs its own `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
and `VAPID_SUBJECT`. Generate a keypair with:

```bash
pnpm --filter cvx exec web-push generate-vapid-keys
```

> **Always pass `--deployment` when setting these.** A bare `convex env set`
> targets whatever this machine is linked to, and `--prod` resolves to the
> default production deployment *of the linked project*, which is not
> necessarily real production. Production VAPID keys were previously written to
> the wrong deployment this way, leaving push silently dead in production.
> Confirm the target first with
> `pnpm --filter cvx exec convex env get SITE_URL --deployment <name>`.

```bash
pnpm --filter cvx exec convex env set VAPID_PUBLIC_KEY "<public-key>" --deployment <name>
pnpm --filter cvx exec convex env set VAPID_PRIVATE_KEY "<private-key>" --deployment <name>
pnpm --filter cvx exec convex env set VAPID_SUBJECT "mailto:admin@example.com" --deployment <name>
```

Use a **separate keypair per deployment**, so a dev backend never holds the
production signing key.

`NEXT_PUBLIC_VAPID_PUBLIC_KEY` in the web env is an optional fallback only. The
client prefers `api.notifications.push.getPublicKey`, which reads the key from
Convex, so setting the key on the deployment is sufficient and keeps the web
build and backend from drifting apart.

Verify a deployment is correctly configured with:

```bash
pnpm --filter cvx exec convex run notifications/push:getPublicKey --deployment <name>
```

A `null` result means `configureWebPush()` will bail and every send will be
dropped without an error.

Push is a best-effort delivery channel. Expired browser subscriptions are
disabled when push services return a permanent failure (`404`/`410`). Auth
failures (`401`/`403`) are deliberately not treated as permanent, because they
indicate a bad VAPID configuration rather than a dead endpoint.

### Platform requirements

| Platform | Works in a browser tab | Notes |
| --- | --- | --- |
| Android Chrome / Edge / Firefox | Yes | Also works installed. |
| Desktop Chrome / Edge / Firefox | Yes | |
| Desktop Safari (macOS 13+) | Yes | |
| **iOS / iPadOS Safari** | **No** | Push requires the app to be added to the Home Screen. |

iOS only exposes the Push API to Home Screen web apps. In a plain Safari tab
`window.Notification` is undefined, so the settings panel detects iOS and shows
Add to Home Screen instructions instead of reporting an unsupported browser.

Two iOS constraints shape the client code:

- `Notification.requestPermission()` must be called synchronously inside the
  tap handler. Awaiting anything first (a service worker lookup, a Convex
  query) spends the user activation and the prompt fails. See
  `requestNotificationPermission` in `apps/web/src/lib/push-notifications.ts`.
- The manifest must use `display: standalone` or `fullscreen`.

### Subscription drift

Push subscriptions can go stale without any user-visible error: push services
rotate endpoints, the stored row can be disabled after failures, and rotating
the VAPID key invalidates every existing subscription. `PushSubscriptionSync`
re-registers an already-granted subscription on load, and
`subscribeBrowserToPush` replaces a subscription whose `applicationServerKey`
no longer matches the configured VAPID key. Neither path prompts the user.

The service worker is registered at app startup by `ServiceWorkerRegistrar`.
This is also what makes the app installable on Android, since Chrome requires
an active worker with a fetch handler before offering the install prompt.

Enabling Browser push registers the current browser and upgrades the user's
active alert preferences to `PUSH`. A global `OFF` preference remains off, and
all-message channel alerts remain separately opt-in in channel settings.

Channel-message fanout runs in a scheduled mutation after the sender's message
transaction commits. Preference resolution uses exact indexed scope and global
fallback lookups, so fanout does not scan a user's full category preference set.

## Current Delivery

The inbox, preference system, and Web Push subscription flow are active.
Announcements, events, Flex Friday entries, club activity, channel messages and
mentions, friend requests, material public-schedule changes, and moderation
reports create delivery rows. Schedule-change fanout is cursor-paginated after
the save transaction, rechecks that the source schedule is still public and
current, and contains no class details. Eligible rows fan out to browser push
when the recipient has an active subscription and a push-enabled preference.

## Known Limits

Unread count is currently a bounded read suitable for alpha/demo data. Use a
counter-backed design before production-scale exact counts.

Browsers may throttle or drop push events, and users can revoke notification
permission outside the app. Keep in-app deliveries as the durable source of
truth.

## Related

- [Schedule](schedule.md)
- [Clubs](clubs.md)
- [Indexes and search](../database/indexes-and-search.md)
