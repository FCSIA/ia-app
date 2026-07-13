---
tags: [feature, notifications]
---

# Notifications

[Home](../index.md)

Notifications provide an in-app inbox, unread count, user preferences, browser
push delivery, and Expo native push delivery for subscribed devices.

## What It Does

- Lists recent notification deliveries.
- Supports cursor pagination for the inbox.
- Tracks unread count.
- Marks one or many notifications as read.
- Stores per-category and scoped preferences.
- Stores per-user browser push subscriptions.
- Stores per-user Expo native push tokens.
- Sends Web Push for categories configured at `PUSH` or `TIME_SENSITIVE`.
- Sends Expo native push for the same category and scope preferences.
- Activates supported alert categories when a user explicitly enables a push
  device, while preserving explicit opt-outs.

## Source Files

- Backend: `apps/convex/src/notifications/`
- Inbox page: `apps/web/src/app/notifications/page.tsx`
- Preference controls: `apps/web/src/components/notifications/`
- Service worker: `apps/web/public/sw.js`
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
- `api.notifications.pushExpo.listMine`
- `api.notifications.pushExpo.registerToken`
- `api.notifications.pushExpo.unregisterToken`
- `api.notifications.pushExpo.sendTestToMe`

## Data Model

- `notificationDeliveries`
- `notificationPreferences`
- `notificationPushSubscriptions`
- `notificationNativePushTokens`

Preference levels are `OFF`, `IN_APP`, `PUSH`, and `TIME_SENSITIVE`. The schema
also supports category and scope keys such as global, club, and channel scopes.

## Categories

The validator includes school announcements, club announcements, club join
requests, club channel messages, mentions, thread replies, events, Flex Friday,
content moderation, and friend requests.

## Browser Push

Closed-tab delivery uses the browser Push API and the app service worker.
Environment variables must include `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and
`VAPID_SUBJECT` for Convex delivery, plus `NEXT_PUBLIC_VAPID_PUBLIC_KEY` for the
web client. Generate keys with:

```bash
pnpm --filter cvx exec web-push generate-vapid-keys
pnpm --filter cvx exec convex env set VAPID_PUBLIC_KEY "<public-key>"
pnpm --filter cvx exec convex env set VAPID_PRIVATE_KEY "<private-key>"
pnpm --filter cvx exec convex env set VAPID_SUBJECT "mailto:admin@example.com"
```

The same public key must also be present in `apps/web/.env.local` as
`NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

Push is a best-effort delivery channel. Expired browser subscriptions are
disabled when push services return a permanent failure.

## Native Push

The Expo mobile app registers a physical iOS or Android device from Notification
Settings. Expo Go cannot receive native push on current Expo SDKs; use a
development or release build with a configured EAS project. Notification taps
route through Expo Router, including when the notification opens a terminated
app. The test action reports Expo ticket acceptance, not final device delivery.

Enabling either browser or native push registers that device and upgrades active
supported preferences to `PUSH`. A global `OFF` preference stays off, and
all-message channel alerts remain separately opt-in.

## Current Delivery

The inbox, preference system, and browser/native push subscription flows are
active. Announcements, events, Flex Friday entries, club activity, channel
messages and mentions, friend requests, and moderation reports create delivery
rows. Eligible rows fan out to every active subscribed device.

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
