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

## Keyword and Profanity Filter

### How It Works

1. Admin adds keywords to `KeywordRule` via the Admin Panel.
2. When user-created content is saved, the backend masks configured keywords and built-in profanity.
3. Rich-text channel messages are traversed recursively so text leaves are filtered too.
4. Announcements and Events also create `KeywordMatch` records for admin review.
5. If content was filtered, the backend can create an automated report and notify the author.
6. Admins can view a history of keyword matches and reports in the moderation dashboard.

Currently filtered surfaces include announcements, announcement comments, events, club names/descriptions/overviews, club channel names/descriptions, club channel messages, Flex Friday notes/sessions/workshops/locations, and school day block labels.

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
| PATCH | `/moderation/keywords/:id/remove` | Soft-remove a keyword rule |
| GET | `/moderation/keyword-matches` | Recent keyword match history |
| GET | `/moderation/reports` | List reports for admin review |
| POST | `/moderation/reports` | Submit a new report |
| PATCH | `/moderation/reports/:id` | Resolve/Dismiss a report |

---

## Related

- [[announcements]] — Content that gets scanned and can be reported
- [[audit-log]] — Moderation actions (adding keywords, reviewing reports) are logged
- [[roles-and-permissions]] — Admins and Support Staff permissions
