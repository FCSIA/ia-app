---
tags: [feature, moderation, safety]
---

# Moderation

← [[index|Home]]

---

## Overview

The moderation system has two parts: automated keyword filtering that scans content as it's created, and a user report system for flagging problematic content for admin review.

**Files:**
- Backend: `apps/api/src/moderation/`
- Web: `apps/web/src/app/admin/` (Moderation tab)
- Database: [[schema#KeywordRule]], [[schema#Report]]

---

## Keyword Filter

### How It Works

1. Admin adds keywords to `KeywordRule` via the Admin Panel.
2. When content (Announcement or Event) is created, the backend scans the text.
3. If a keyword is found, a `KeywordMatch` record is created, linking the keyword to the specific content ID.
4. Admins can view a history of all matches in the moderation dashboard.

---

## User Reports

Any user can report an announcement, comment, or event.

### Reporting Flow
- **Submitter**: Provides a reason and optionally identifies the `reportedUserId` if reporting a specific person's behavior (e.g. in a comment).
- **Status Transitions**: Reports start as `PENDING` and move to `RESOLVED` or `DISMISSED` after admin review.
- **Notes**: Admins provide a `reviewNote` explaining their decision.

---

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| GET | `/moderation/keywords` | List active rules |
| POST | `/moderation/keywords` | Add a case-insensitive keyword |
| GET | `/moderation/reports` | List reports for admin review |
| POST | `/moderation/reports` | Submit a new report |
| PATCH | `/moderation/reports/:id` | Resolve/Dismiss a report |
| GET | `/moderation/matches` | Recent keyword match history |

---

## Related

- [[announcements]] — Content that gets scanned and can be reported
- [[audit-log]] — Moderation actions (adding keywords, reviewing reports) are logged
- [[roles-and-permissions]] — Admins and Support Staff permissions

