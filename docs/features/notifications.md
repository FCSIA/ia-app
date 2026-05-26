---
tags: [feature, notifications]
---

# Notifications

[Home](../index.md)

Notifications provide an in-app inbox, unread count, and user preferences for
future delivery controls.

## What It Does

- Lists recent notification deliveries.
- Supports cursor pagination for the inbox.
- Tracks unread count.
- Marks one or many notifications as read.
- Stores per-category and scoped preferences.

## Source Files

- Backend: `apps/convex/src/notifications/`
- Inbox page: `apps/web/src/app/notifications/page.tsx`
- Preference controls: `apps/web/src/components/notifications/`
- Unread nav badge: `apps/web/src/components/layout/AppShell.tsx`

## Convex Surface

- `api.notifications.inbox.list`
- `api.notifications.inbox.listPage`
- `api.notifications.inbox.unreadCount`
- `api.notifications.inbox.markRead`
- `api.notifications.inbox.markAllRead`
- `api.notifications.preferences.list`
- `api.notifications.preferences.upsert`

## Data Model

- `notificationDeliveries`
- `notificationPreferences`

Preference levels are `OFF`, `IN_APP`, `PUSH`, and `TIME_SENSITIVE`. The schema
also supports category and scope keys such as global, club, and channel scopes.

## Categories

The validator includes school announcements, club announcements, club join
requests, club channel messages, mentions, thread replies, events, Flex Friday,
content moderation, and friend requests.

## Current Delivery

The inbox and preference system are active. Current Convex delivery rows are
created in the implemented friend-request flow. Other categories are modeled for
domain fanout and should be verified when each domain starts delivering rows.

## Known Limits

Unread count is currently a bounded read suitable for alpha/demo data. Use a
counter-backed design before production-scale exact counts.

Web Push is not the current closed-tab delivery implementation. `PUSH` and
`TIME_SENSITIVE` represent intended delivery levels, not a completed browser
push pipeline.

## Related

- [Schedule](schedule.md)
- [Clubs](clubs.md)
- [Indexes and search](../database/indexes-and-search.md)
