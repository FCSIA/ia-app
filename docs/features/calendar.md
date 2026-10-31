---
tags: [feature, calendar]
---

# Calendar

[Home](../index.md)

The calendar shows school, club, Flex Friday, district, external, and personal
entries in an adaptive event calendar.

Date-specific bell schedules are managed separately in the Schedule workspace's
Day Plans tab. See [Schedule](schedule.md) for reusable templates, date
overrides, and canonical-period resolution.

## What It Does

- Lists entries within the active view's visible range.
- Filters by source.
- Lets users create, edit and delete their own personal reminders, including
  explicit end times and all-day date ranges.
- Lets owners move reminders in calendar grids; touch users drag the handle,
  while the reminder body remains available for scrolling and details. The
  Edit action remains available for changing the date without dragging.
- Lets students invite accepted friends and manage received invitations.
- Lets users connect private HTTPS ICS feeds, including Canvas personal calendar
  feeds such as `fultonschools.instructure.com`.
- Shows published events and Flex Friday rows through linked calendar entries.
- Uses the ReUI event-calendar engine for month, week, day, and agenda views.
- Offers month, week, day, and agenda on larger screens; phones use agenda and
  day and three-day views so event content is never compressed into seven
  narrow columns.
- Persists the selected period/view in `?date=YYYY-MM-DD&view=…` and shares
  event-row anatomy and source colors with Dashboard's seven-day agenda.
- Opens read-only details with source links for published/imported entries;
  personal entries expose a separate Edit action.

## Source Files

- Backend: `apps/convex/src/events/calendar.ts`
- Web page: `apps/web/src/app/calendar/page.tsx`
- Event calendar: `apps/web/src/components/reui/event-calendar/`
- Dashboard agenda: `apps/web/src/components/dashboard/widgets/CalendarWidget.tsx`
- Create dialog: `apps/web/src/components/calendar/AddCalendarEntryDialog.tsx`
- Shared form and rows: `apps/web/src/components/calendar/`

## Convex Surface

- `api.events.calendar.list`
- `api.events.calendar.create`
- `api.events.calendar.update`
- `api.events.calendar.reschedule`
- `api.events.calendar.remove`
- `api.events.calendar.listPendingInvites`
- `api.events.calendar.listEligibleFriends`
- `api.events.calendar.inviteFriends`
- `api.events.calendar.respondToInvite`
- `api.events.calendar.removeSharedEntry`
- `api.events.externalCalendars.listMine`
- `api.events.externalCalendars.createIcs`
- `api.events.externalCalendars.refreshMine`
- `api.events.externalCalendars.remove`

## Data Model

`calendarEntries` stores:

- optional `eventId`
- optional `flexFridayId`
- title, description, location
- `startAt`, optional `endAt` and `allDay`; all-day ends are exclusive
- `source`: `SCHOOL`, `CLUB`, `FLEX_FRIDAY`, `PERSONAL`, or `DISTRICT`
- optional `createdById`
- tags

Personal entries are returned only to their owner and accepted invited friends
while the friendship remains accepted. Removing a shared reminder declines that
recipient's acceptance without deleting the owner's entry.

External subscriptions and normalized events are private to their owner. The
feed URL is not returned to clients after creation. A new connection starts its
first sync immediately; ICS feeds then refresh every six hours. Imports retain
events from the previous 31 days through the next year and mark failed
connections with an error state for retry. DATE-valued and floating ICS times
use the school timezone (`America/New_York`), and safe event URLs are retained.

Calendar reads use source/owner-scoped start and overlap indexes, a maximum
92-day range, and explicit failure beyond 1,000 rows per scan. End-index scans
can hit this limit on future volume even for a short visible range. Feed imports
fail explicitly beyond 300 in-window events or 20,000 inspected recurrence
occurrences; they preserve the prior successful import on failure. See the
[repair ledger](../reference/ui-audit-calendar-repairs-2026-10-22.md) for the
capacity tradeoff and validation limits.

## Permissions

Authenticated users can read allowed calendar entries and manage their own
personal entries. Deleting non-personal entries is rejected by the mutation.

## Side Effects

Events and Flex Friday creation can create linked calendar entries. Event
cancellation deletes linked event calendar rows.
External feed refresh runs in a server action and expands bounded recurring
events with `ical.js`. Imported events are read-only in the calendar.

Google Calendar and Outlook/Microsoft Graph OAuth connections are not enabled
yet. They require owner-created OAuth credentials, a stable public callback URL,
and a Microsoft school-tenant versus any-account decision before token storage
and incremental sync can be safely configured.

## Related

- [Events](events.md)
- [Flex Friday](flex-friday.md)
- [Schedule](schedule.md)
