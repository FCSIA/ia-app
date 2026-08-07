---
tags: [feature, calendar]
---

# Calendar

[Home](../index.md)

The calendar shows school, club, Flex Friday, district, and personal entries on
a monthly grid.

Date-specific bell schedules are managed separately in the Schedule workspace's
Day Plans tab. See [Schedule](schedule.md) for reusable templates, date
overrides, and canonical-period resolution.

## What It Does

- Lists entries within the visible month range.
- Filters by source.
- Searches title, description, and location on the client for the current range.
- Lets users create and delete their own personal entries.
- Shows published events and Flex Friday rows through linked calendar entries.

## Source Files

- Backend: `apps/convex/src/events/calendar.ts`
- Web page: `apps/web/src/app/calendar/page.tsx`
- Create dialog: `apps/web/src/components/calendar/AddCalendarEntryDialog.tsx`

## Convex Surface

- `api.events.calendar.list`
- `api.events.calendar.create`
- `api.events.calendar.remove`

## Data Model

`calendarEntries` stores:

- optional `eventId`
- optional `flexFridayId`
- title, description, location
- `startAt`, `endAt`
- `source`: `SCHOOL`, `CLUB`, `FLEX_FRIDAY`, `PERSONAL`, or `DISTRICT`
- optional `createdById`
- tags

Personal entries are only returned to the user who created them.

## Permissions

Authenticated users can read allowed calendar entries and manage their own
personal entries. Deleting non-personal entries is rejected by the mutation.

## Side Effects

Events and Flex Friday creation can create linked calendar entries. Event
cancellation deletes linked event calendar rows.

## Related

- [Events](events.md)
- [Flex Friday](flex-friday.md)
- [Schedule](schedule.md)
