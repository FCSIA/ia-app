---
tags: [feature, announcements, comments]
---

# Announcements

← [[index|Home]]

---

## Overview

Announcements are messages broadcast to specific audiences. They support comments, expiry, archiving, and content moderation.

**Files:**
- Backend: `apps/api/src/announcements/`
- Web: `apps/web/src/app/announcements/`
- Database: [[schema#Announcement]], [[schema#Comment]]

---

## Target Types

Every announcement targets a specific audience:

| Target | Description |
|--------|-------------|
| `SCHOOL_WIDE` | Every user |
| `GRADE` | Students in a specific `targetGrade` (9, 10, 11, or 12) |
| `PATHWAY` | Students in a specific `targetPathway` |
| `CLUB` | Members of the specified `clubId` |

### Flexible Targeting
The `targetValue` field allows for future-proof targeting (e.g. specific advisor groups or GT blocks) without modifying the enum schema.

---

## Read Tracking

The system tracks which users have viewed which announcements using the `AnnouncementRead` model.
- **Unread indicators** appear in the student dashboard.
- **Analytics** (future) can show sponsors what percentage of their club has read a message.

---

## Lifecycle

Announcements are born `ACTIVE`. They can transition to `EXPIRED` automatically based on `expiresAt`, or be manually `ARCHIVED` by an author or admin.

---

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| GET | `/announcements` | List matching the user's grade/pathway/clubs |
| GET | `/announcements/:id` | Get detail + comments |
| POST | `/announcements/:id/read` | Mark as read |
| POST | `/announcements` | Create (scanning for keywords) |
| POST | `/announcements/:id/comments` | Add comment |

---

## Related

- [[clubs]] — Club-targeted announcements
- [[moderation]] — Keyword filter + reports
- [[notifications]] — Notifications triggered by new announcements

