---
tags: [feature, notifications]
---

# Notifications

← [[index|Home]]

---

## Overview

Notifications alert users to relevant activity. The system uses **polling** (regular API checks) rather than WebSockets, making it simpler but slightly less real-time.

**Files:**
- Backend: `apps/api/src/notifications/`
- Web: `apps/web/src/app/notifications/`
- Database: [[schema#NotificationDelivery]], [[schema#NotificationPreference]]

---

## How Notifications Are Created

When something happens on the backend (new announcement, event published, etc.), the `NotificationsService` creates `NotificationDelivery` rows for each affected user:

```typescript
// When a school-wide announcement is published:
const users = await prisma.user.findMany({ where: { isActive: true } });
await prisma.notificationDelivery.createMany({
  data: users.map(user => ({
    userId: user.id,
    category: 'SCHOOL_ANNOUNCEMENT',
    title: announcement.title,
    body: announcement.body.substring(0, 100),
  })),
});
```

---

## Notification Categories

| Category | Triggered by | Deep-links to |
|----------|-------------|---------------|
| `SCHOOL_ANNOUNCEMENT` | New school/grade/pathway announcement | `/announcements/:id` |
| `CLUB_ANNOUNCEMENT` | New club announcement | `/clubs/:id` |
| `CLUB_JOIN_REQUEST` | Student requests to join a club | `/clubs/:id?tab=management` |
| `CLUB_CHANNEL_MENTION` | User/Tag mention in chat | `/clubs/:id/channels/:channelId` |
| `EVENT` | Event published | `/events/:id` |
| `FLEX_FRIDAY` | New Friday or Assignment | `/flex-friday` |
| `FRIEND_REQUEST` | Coworker wants to share schedules | `/schedule` (friends tab) |

---

## Data Model and Deep-Linking

The `NotificationDelivery` model stores nullable foreign keys to provide a high-performance deep-link experience:
- `announcementId`, `eventId`, `clubId`, `channelId`, `messageId`

The frontend uses these fields to construct the correct URL and application state upon clicking a notification.

---

## Notification Preferences

Users can disable any category and tune more specific entities where the product exposes them. For club work, preferences can be stored per club and per channel. Forced admin **push notifications to everyone** remain locked on.

```
userId + category + scopeKey → enabled (boolean)
```

- `scopeKey: "global"`: Global preference for that category.
- `scopeKey: "club:<id>"`: Override for a specific club.
- `scopeKey: "channel:<id>"`: Override for a specific club channel.
- Entity ids are also stored when available to support contextual controls.

---

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| GET | `/notifications` | All notifications for current user |
| GET | `/notifications/unread-count` | Polled every 30s by the sidebar |
| POST | `/notifications/mark-read` | Mark specific IDs as read |
| POST | `/notifications/mark-all-read` | Clear all badges |
| PUT | `/notifications/preferences` | Update a global or club-specific preference |

---

## Related

- [[announcements]] — Trigger school/club announcements
- [[clubs]] — Trigger mentions and join requests
- [[schedule]] — Trigger friend requests
- [[flex-friday]] — Trigger registration/assignment alerts
