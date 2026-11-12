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

Admin/support event managers can create general school events and view broader
event data. Club sponsors and club leaders can create club events; non-sponsor
club events go through sponsor approval. Event creators and admins can cancel
events.

Approval asks each of the club's sponsors with an active account, and a club
with none cannot create an event that needs approval. The event publishes once
every request from a sponsor who can still act is approved. When a sponsor is
deactivated or deleted, their open requests are dropped. Events that others
already approved then publish. Events nobody approved go to the club's other
active sponsors, or are cancelled (audited as `NO_ACTIVE_SPONSOR`) if there are
none. The author receives an event notification when a sponsor rejects the
event or when it is cancelled because no active sponsor remains, subject to
the author’s notification preferences.

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
