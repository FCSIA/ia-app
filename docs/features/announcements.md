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

| Target | Who sees it |
|--------|-------------|
| `SCHOOL_WIDE` | Every user |
| `GRADE` | Users whose `gradeLevel` matches `targetGrade` |
| `PATHWAY` | Users whose `pathway` matches `targetPathway` |
| `CLUB` | Members of the specified club |

The backend filters by the logged-in user's grade/pathway when returning announcements.

---

## Admin General

`isAdminGeneral: true` marks an announcement as a pinned admin message. These:
- Always appear at the top of the list
- Always trigger notifications regardless of user preferences

---

## Lifecycle

```
Created (ACTIVE)
    ↓
Optional: expiresAt passes → EXPIRED (auto)
    ↓
Or: Admin manually archives → ARCHIVED
```

---

## Comments

If `allowComments: true`, users can post comments on an announcement.

- Comments are always visible to anyone who can see the announcement
- The announcement author, admins, and super admins can delete any comment
- Authors can delete their own comments
- Comments trigger moderation keyword checks

---

## Moderation

When an announcement is created, the backend scans the `body` against all active `KeywordRule` records. If a match is found, a `KeywordMatch` is recorded and the content may be flagged for review. See [[moderation]].

Users can also manually report an announcement using the flag button on the detail page.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/announcements` | List (filtered by user's grade/pathway) |
| GET | `/announcements/:id` | Get one with comments |
| POST | `/announcements` | Create |
| PATCH | `/announcements/:id/archive` | Archive |
| POST | `/announcements/:id/comments` | Add comment |
| DELETE | `/announcements/comments/:id` | Delete comment |

---

## Permissions

| Action | Who can |
|--------|---------|
| View school-wide | All authenticated |
| View club announcements | Club members |
| Create | TEACHER, SPONSOR, ADMIN, SUPER_ADMIN |
| Create admin-general | ADMIN, SUPER_ADMIN |
| Archive | Author, ADMIN, SUPER_ADMIN |
| Delete comments | Comment author, ADMIN, SUPER_ADMIN |

---

## Web Pages

- `/announcements` — list, sorted by newest, filterable by admin-only
- `/announcements/:id` — full announcement with comment thread

---

## Related

- [[clubs]] — Club-targeted announcements
- [[moderation]] — Keyword filter + reports
- [[notifications]] — Notifications triggered by new announcements
