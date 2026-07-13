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
content moderation, and friend requests.

## Browser Push

Closed-tab delivery uses the browser Push API and the app service worker.
Environment variables must include `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, and
`VAPID_SUBJECT` for Convex delivery, plus `NEXT_PUBLIC_VAPID_PUBLIC_KEY` for the
web client. Generate keys with:

```bash
direnv exec . pnpm --filter cvx exec web-push generate-vapid-keys
```

Push is a best-effort delivery channel. Expired browser subscriptions are
disabled when push services return a permanent failure.

Enabling Browser push registers the current browser and upgrades the user's
active alert preferences to `PUSH`. A global `OFF` preference remains off, and
all-message channel alerts remain separately opt-in in channel settings.

## Current Delivery

The inbox, preference system, and Web Push subscription flow are active.
Announcements, events, Flex Friday entries, club activity, channel messages and
mentions, friend requests, and moderation reports create delivery rows. Eligible
rows fan out to browser push when the recipient has an active subscription.

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
