---
tags: [feature, announcements, comments]
---

# Announcements

← [[index|Home]]

---

## Overview

Announcements are messages broadcast to specific audiences. They support comments, expiry, archiving, sponsor approval for club proposals, user bookmarks, pinned announcements, and content moderation.

**Files:**
- Backend (Convex): `apps/convex/src/announcements/` — `feed`, `engagement`, `comments`
- Legacy REST: `apps/api/src/announcements/` (retained during port)
- Web: `apps/web/src/app/announcements/` (Convex hooks)
- Database: [[schema#Announcement]], [[schema#Comment]]

---

## Target Types

Every announcement targets a specific audience:

| Target | Description |
|--------|-------------|
| `SCHOOL_WIDE` | Every user |
| `GRADE` | Students in one or more `targetGrades` (9, 10, 11, or 12); legacy `targetGrade` remains readable |
| `PATHWAY` | Students in one or more major/minor pathway targets; legacy `targetPathway` remains readable |
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

Announcements can be born `ACTIVE` or `PENDING_APPROVAL`. Club student leader proposals require sponsor/admin approval; approval immediately publishes and sends notifications. They can transition to `REJECTED`, `EXPIRED` automatically based on `expiresAt`, or be manually `ARCHIVED` by an author or admin.

## Saved and Pinned

Users can bookmark announcements locally. Admin-promoted announcements are surfaced as **Pinned** and automatically stop being pinned after one month.

---

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| GET | `/announcements` | List matching the user's grade/pathway/clubs |
| GET | `/announcements/:id` | Get detail + comments |
| POST | `/announcements/:id/read` | Mark as read |
| POST | `/announcements/:id/bookmark` | Save/bookmark an announcement |
| POST | `/announcements` | Create (scanning for keywords) |
| POST | `/announcements/:id/approve` | Sponsor/admin publishes a pending proposal |
| POST | `/announcements/:id/reject` | Sponsor/admin returns a proposal |
| POST | `/announcements/:id/comments` | Add comment |

---

## Related

- [[clubs]] — Club-targeted announcements
- [[moderation]] — Keyword filter + reports
- [[notifications]] — Notifications triggered by new announcements
