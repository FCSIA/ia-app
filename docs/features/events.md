---
tags: [feature, events, approval-workflow]
---

# Events

← [[index|Home]]

---

## Overview

Events go through a multi-step approval workflow before becoming publicly visible. They can be general school events or club-specific.

**Files:**
- Backend: `apps/api/src/events/`
- Web: `apps/web/src/app/events/`
- Database: [[schema#Event]], [[schema#EventApproval]]

---

## Approval Workflow

```
DRAFT
  ↓ (submit for review)
PENDING_APPROVAL
  ↓ (sponsor/admin approves)
APPROVED
  ↓ (admin publishes)
PUBLISHED ← visible on calendar and events list
  ↓ (optional)
CANCELLED
```

Or:
```
PENDING_APPROVAL
  ↓ (sponsor/admin rejects)
REJECTED → back to DRAFT for editing
```

---

## Event Types

| Type | Created by | Requires |
|------|-----------|---------|
| `GENERAL` | ADMIN, SUPER_ADMIN | No club |
| `CLUB` | Sponsor, Leader, ADMIN | Must have a `clubId` |

---

## Flyer Upload

Events can have an uploaded flyer image (`flyerUrl`). File uploads go through `/uploads` and return a URL stored on the event record.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/events` | All events (status filter optional) |
| GET | `/events/:id` | Single event with approvals |
| POST | `/events` | Create (starts as DRAFT) |
| POST | `/events/:id/submit` | Submit for approval |
| POST | `/events/:id/approve` | Approve |
| POST | `/events/:id/reject` | Reject with note |
| POST | `/events/:id/cancel` | Cancel |
| POST | `/events/:id/publish` | Publish (ADMIN only) |
| GET | `/events/pending-approvals` | Events awaiting sponsor approval |

---

## Permissions

| Action | Who can |
|--------|---------|
| View published events | All authenticated |
| Create | TEACHER, SPONSOR, LEADER, ADMIN, SUPER_ADMIN |
| Submit for approval | Event creator, ADMIN |
| Approve/Reject | Club Sponsor, ADMIN, SUPER_ADMIN |
| Publish | ADMIN, SUPER_ADMIN |
| Cancel | Event creator, ADMIN, SUPER_ADMIN |

---

## Calendar Integration

When an event is published, a `CalendarEntry` is automatically created (or updated) linked to the event. This is what appears on the calendar view. See [[calendar]].

---

## Related

- [[calendar]] — Where published events appear
- [[clubs]] — Club events require a clubId
- [[notifications]] — Notifications sent when events are published
