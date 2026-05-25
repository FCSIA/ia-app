---
tags: [feature, notifications]
---

# Notifications

← [[index|Home]]

---

## Overview

Notifications alert users to relevant activity. In the Convex port, the
frontend subscribes to Convex queries instead of polling REST endpoints.

**Files:**
- Convex: `apps/convex/src/notifications/`
- Web: `apps/web/src/app/notifications/`
- Database: [[schema#NotificationDelivery]], [[schema#NotificationPreference]]

---

## How Notifications Are Created

When a ported domain creates a notification, it writes `notificationDeliveries`
rows for affected users after checking `notificationPreferences`.

```ts
await ctx.db.insert('notificationDeliveries', {
  userId,
  category: 'SCHOOL_ANNOUNCEMENT',
  title,
  body,
  isRead: false,
  announcementId,
  createdAt: Date.now(),
});
```

---

## Notification Categories

| Category | Triggered by | Deep-links to |
|----------|-------------|---------------|
| `SCHOOL_ANNOUNCEMENT` | New school/grade/pathway announcement | `/announcements/:id` |
| `CLUB_ANNOUNCEMENT` | New club announcement | `/clubs/:id` |
| `CLUB_JOIN_REQUEST` | Student requests to join a club | `/clubs/:id?tab=management` |
| `CLUB_CHANNEL_MESSAGE` | User opted into all messages for a channel | `/clubs/:id/channels/:channelId` |
| `CLUB_CHANNEL_MENTION` | Direct user mention in chat | `/clubs/:id/channels/:channelId` |
| `CLUB_CHANNEL_TAG_MENTION` | Built-in or custom tag mention in chat | `/clubs/:id/channels/:channelId` |
| `CLUB_CHANNEL_THREAD` | Reply to a user's thread | `/clubs/:id/channels/:channelId` |
| `EVENT` | Event published | `/events/:id` |
| `FLEX_FRIDAY` | New Friday or Assignment | `/flex-friday` |
| `FRIEND_REQUEST` | Coworker wants to share schedules | `/schedule` (friends tab) |

---

## Data Model and Deep-Linking

The `notificationDeliveries` table stores nullable string references to provide a high-performance deep-link experience while the referenced domains are being ported:
- `announcementId`, `eventId`, `clubId`, `channelId`, `messageId`

The frontend uses these fields to construct the correct URL and application state upon clicking a notification.

---

## Notification Preferences

Users can disable any category and tune more specific entities where the product exposes them. For club work, preferences can be stored per club and per channel. Forced admin **push notifications to everyone** remain locked on.

```
userId + category + scopeKey → enabled + level
```

- `scopeKey: "global"`: Global preference for that category.
- `scopeKey: "club:<id>"`: Override for a specific club.
- `scopeKey: "channel:<id>"`: Override for a specific club channel.
- Entity ids are also stored when available to support contextual controls.
- `level: OFF | IN_APP | PUSH | TIME_SENSITIVE`: stores current delivery intent. Push escalation is modeled now even though delivery remains in-app polling.

Channel all-message alerts are opt-in: if no `CLUB_CHANNEL_MESSAGE` preference exists for a channel, messages do not create all-message deliveries. Mentions and thread replies remain on by default unless a user disables that scoped category.

Closed-tab/browser delivery should use standard Web Push through a service
worker, persisted push subscriptions, and the same Convex notification
preference checks. Do not treat background polling from an open tab as the
production answer for `PUSH` or `TIME_SENSITIVE` levels.

---

## Convex Surface

- `api.notifications.inbox.list` (bounded preview reads)
- `api.notifications.inbox.listPage` (cursor-paginated inbox)
- `api.notifications.inbox.unreadCount`
- `api.notifications.inbox.markRead`
- `api.notifications.inbox.markAllRead`
- `api.notifications.preferences.preferences`
- `api.notifications.preferences.upsertPreference`

Unread counts currently read a bounded recent set, which is fine for alpha and
seeded data. Before production scale, replace exact large unread counts with an
Aggregate/Sharded Counter-backed counter updated by delivery/read mutations.

---

## Related

- [[announcements]] — Trigger school/club announcements
- [[clubs]] — Trigger mentions and join requests
- [[schedule]] — Trigger friend requests
- [[flex-friday]] — Trigger registration/assignment alerts
