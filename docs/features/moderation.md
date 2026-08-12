---
tags: [feature, moderation, safety]
---

# Moderation

[Home](../index.md)

Moderation currently covers admin-managed keyword rules and user-submitted
reports.

## What It Does

- Lets admins manage local keyword rules.
- Lets users report content such as announcements, comments, events, or club
  messages.
- Lets admins, support staff, and teachers review reports.
- Tracks review status and notes. Dismissed general feedback is retained in the
  super-admin feedback archive rather than appearing in the active queue.

## Source Files

- Backend: `apps/convex/src/moderation/`
- General report page: `apps/web/src/app/report/page.tsx`
- Admin UI: `apps/web/src/app/admin/_components/moderation-tab.tsx`
- Admin hook: `apps/web/src/app/admin/_hooks/use-admin-moderation.ts`
- Feedback UI: `apps/web/src/app/admin/_components/feedback-tab.tsx`
- Feedback hook: `apps/web/src/app/admin/_hooks/use-admin-feedback.ts`

## Convex Surface

- `api.moderation.keywords.list`
- `api.moderation.keywords.add`
- `api.moderation.keywords.remove`
- `api.moderation.reports.list`
- `api.moderation.reports.submit`
- `api.moderation.reports.update`

## Data Model

- `moderationKeywordRules`
- `moderationReports`

Reports store submitter, content type/id, optional club, optional reported user,
reason, status, escalation flag, review note, and timestamps. General feedback
can include up to three validated PNG, JPEG, GIF, or WebP image attachments;
only super admins can retrieve their previews.

## Permissions

Authenticated users can submit reports. Teachers and elevated roles can list
reports. Admin, super admin, and support staff roles can update report review
state. Keyword management is admin-only.

## Side Effects

Keyword and report changes write audit events. A resolved general-feedback item
notifies its submitter; dismissed feedback remains available only in the
super-admin archive.

## Known Limits

Some admin UI copy mentions automatic profanity monitoring. The current Convex
backend surface documents keyword rules and reports; verify or implement
automatic filtering before promising full automated moderation behavior.

## Related

- [Audit log](audit-log.md)
- [Announcements](announcements.md)
- [Clubs](clubs.md)
