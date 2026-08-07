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

Channel-message fanout runs in a scheduled mutation after the sender's message
transaction commits. Preference resolution uses exact indexed scope and global
fallback lookups, so fanout does not scan a user's full category preference set.

## Current Delivery

The inbox, preference system, and Web Push subscription flow are active. Current
Convex delivery rows are created for friend requests and material updates to a
friend's public schedule. Schedule-change fanout is cursor-paginated after the
save transaction, rechecks that the source schedule is still public/current,
and contains no class details. Both categories can fan out to browser push when
the target user has an active subscription and a push-enabled preference. Other
categories are modeled for domain fanout and should be verified when each
domain starts delivering rows.

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
