---
tags: [feature, moderation, safety]
---

# Moderation

← [[index|Home]]

---

## Overview

The moderation system has two parts: automated keyword filtering that scans content as it's created, and a user report system for flagging problematic content for admin review.

**Files:**
- Backend (Convex): `apps/convex/src/moderation/` — `keywords`, `reports`
- Legacy REST: `apps/api/src/moderation/` (retained during port)
- Web: `apps/web/src/app/admin/` (Moderation tab)
- Database: [[schema#KeywordRule]], [[schema#Report]]

---

## Profanity Filter and Admin Rules

IA uses the external `glin-profanity` package as the primary profanity detector. The Admin Panel section currently labeled **Keyword Filter Rules** is not the main profanity dictionary; it is a local school override list for words or phrases that IA wants to track in addition to the library.

That means the UI exists for operational exceptions, not because admins are expected to maintain the whole profanity list. Examples of appropriate local rules are campus-specific slurs, targeted harassment phrases, event-specific threats, or terms that should be escalated because of school policy.

### How It Works

1. The backend calls `ModerationService.maskProfanity()` before saving user-created text.
2. Local `KeywordRule` entries and configured test words are masked first with exact word-boundary matching.
3. The already-masked text is then checked by `glin-profanity`.
4. If `glin-profanity` detects built-in profanity, the detected words are masked.
5. Rich-text channel messages are traversed recursively so text leaves are filtered too.
6. Announcements and Events also create `KeywordMatch` records for local keyword matches.
7. If content was filtered, the backend creates an automated moderation report and notifies the author.
8. Admins and support staff see automated reports in the Admin Panel moderation queue.

Currently filtered surfaces include announcements, announcement comments, events, club names/descriptions/overviews, club channel names/descriptions, club channel messages, Flex Friday notes/sessions/workshops/locations, and school day block labels.

### What the Library Tracks

`glin-profanity` provides a profanity dictionary and detection utilities. Per the installed package documentation, it supports:

- profanity/swear words across 23 languages: Arabic, Chinese, Czech, Danish, Dutch, English, Esperanto, Finnish, French, German, Hindi, Hungarian, Italian, Japanese, Korean, Norwegian, Persian, Polish, Portuguese, Russian, Spanish, Swedish, Thai, and Turkish.
- leetspeak and obfuscation patterns such as number/symbol substitutions, repeated characters, and spaced-out characters.
- Unicode normalization for evasion attempts such as Cyrillic/Greek lookalikes, full-width characters, accents/diacritics, and zero-width characters.
- optional ML/toxicity features in the package.

Current IA code uses the `Filter` class and `checkProfanity()` result. It does not currently pass explicit options for `allLanguages`, `detectLeetspeak`, or ML toxicity, so the exact active language/options are the package defaults plus our local `KeywordRule` list. If the product expectation is “all 23 languages plus leetspeak detection,” update `ModerationService.applyGlinFilter()` to instantiate `Filter` with explicit options.

Seeded local rules are `violence`, `weapon`, and `drugs`. Those are policy/safety tracking terms, not a replacement for the external profanity library.

### Notifications and Admin Visibility

When a student or staff member submits text that gets filtered:

- The saved content is masked before storage.
- The author receives a `CONTENT_MODERATED` notification such as “Post filtered for language,” “Message filtered for language,” or the feature-specific equivalent.
- `ModerationService.createAutomatedReport()` creates a `Report` with reason `Automated: Profanity Filtered`, including matched local keywords when available.
- The report appears in the Admin Panel → Moderation queue. Admins, super admins, and support staff can list reports; admins and super admins can manage keyword rules.
- The action is written to the audit log as `AUTO_MODERATION_FLAGGED`.

Important current limitation: only the author is directly notified through `NotificationDelivery`. Admin notification is queue-based through the report list/admin dashboard, not a push notification to every admin. If real-time admin notifications are desired, add a delivery step in `createAutomatedReport()` for admin/support recipients.

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
