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

| Category | Triggered by |
|----------|-------------|
| `SCHOOL_ANNOUNCEMENT` | New school-wide or grade/pathway announcement |
| `CLUB_ANNOUNCEMENT` | New club announcement (sent to club members) |
| `CLUB_CHANNEL_MENTION` | Channel messages that mention a user, tag, or audience like `@leaders` |
| `EVENT` | Event published |
| `FLEX_FRIDAY` | New Flex Friday created |

---

## Notification Preferences

Users can disable any category in `/profile`. Preferences are stored in `NotificationPreference`:

```
userId + category + clubId → enabled (boolean)
```

`clubId: null` = global preference for that category.

When creating notifications, the service checks preferences:
```typescript
const pref = await prisma.notificationPreference.findFirst({
  where: { userId, category, clubId: null },
});
if (pref && !pref.enabled) return; // skip this user
```

**Exception**: `isAdminGeneral` announcements always notify, regardless of preferences.

---

## The Badge Polling

The notification bell badge in the sidebar updates every 30 seconds:

```typescript
// AppShell.tsx
const { data: unreadCount = 0 } = useQuery({
  queryKey: ['unread-count'],
  queryFn: () => notificationsApi.getUnreadCount().then(r => r.data.count),
  refetchInterval: 30_000,
});
```

`NotificationDelivery` rows with `isRead: false` are counted. The badge shows the count and pulses when > 0.

---

## Marking as Read

Clicking an unread notification marks it read:

```typescript
onClick={() => !n.isRead && markReadMutation.mutate(n.id)}
```

The "Mark all read" button calls `/notifications/mark-all-read`.

For `CLUB_CHANNEL_MENTION`, notification rows also store `clubId`, `channelId`, and `messageId`. The web notifications page uses those IDs to open the corresponding channel thread directly.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/notifications` | All notifications for current user |
| GET | `/notifications/unread-count` | Count of unread |
| POST | `/notifications/mark-read` | Mark specific IDs as read |
| POST | `/notifications/mark-all-read` | Mark all as read |
| GET | `/notifications/preferences` | Get preferences |
| PUT | `/notifications/preferences` | Update a preference |

---

## Related

- [[announcements]] — Trigger `SCHOOL_ANNOUNCEMENT` / `CLUB_ANNOUNCEMENT`
- [[events]] — Trigger `EVENT` on publish
- [[flex-friday]] — Trigger `FLEX_FRIDAY` on creation
- [[components]] — The badge in AppShell
