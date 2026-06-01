---
tags: [feature, events, approval-workflow]
---

# Events

[Home](../index.md)

Events are school or club activities that can appear in event lists and the
calendar.

## What It Does

- Lists published events for normal users and broader event sets for admins.
- Creates general or club-scoped events.
- Sends club events through sponsor approval when required.
- Publishes approved events to the calendar.
- Lets event authors or admins cancel events.

## Source Files

- Backend: `apps/convex/src/events/`
- Event list/detail routes: `apps/web/src/app/events/`
- Calendar page: `apps/web/src/app/calendar/page.tsx`

## Convex Surface

- `api.events.events.list`
- `api.events.events.get`
- `api.events.events.create`
- `api.events.events.cancel`
- `api.events.approvals.listPendingForSponsor`
- `api.events.approvals.approveEvent`
- `api.events.approvals.rejectEvent`
- `api.events.calendar.list`
- `api.events.calendar.create`
- `api.events.calendar.remove`

## Data Model

- `events`
- `eventApprovals`
- `eventCategories`
- `calendarEntries`

Event status is one of `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `PUBLISHED`, or
`CANCELLED`, though the current create/approval flow primarily uses
`PENDING_APPROVAL`, `PUBLISHED`, and `CANCELLED`.

## Permissions

Admins can create and view broader event data. Sponsors can create club events
and approve pending club events assigned to them. Event creators and admins can
cancel events.

## Side Effects

Publishing creates a linked `calendarEntries` row. Cancelling removes linked
event calendar entries. Creates, approvals, rejections, and cancellations write
audit events.

## Known Limits

Flyer upload fields exist on event documents, but current active upload
finalization is implemented for club images and channel attachments first.

## Related

- [Calendar](calendar.md)
- [Clubs](clubs.md)
- [Uploads](uploads.md)
