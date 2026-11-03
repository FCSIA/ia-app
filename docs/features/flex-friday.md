---
tags: [feature, flex-friday, scheduling]
---

# Flex Friday

[Home](../index.md)

Flex Friday manages special Friday sessions, workshops, student registration,
attendance, and yearly credits.

## What It Does

- Admins create Flex Friday dates and optional initial sessions.
- Staff create sessions and workshops.
- Students register for student-choice workshops.
- Staff assign students to teacher-assigned workshops.
- Staff mark attendance.
- Students view registrations, assignments, credits, and pass state.

## Source Files

- Backend: `apps/convex/src/flexFriday/`
- Main page: `apps/web/src/app/flex-friday/page.tsx`
- Student pass: `apps/web/src/app/flex-friday/pass/page.tsx`

## Convex Surface

- `api.flexFriday.fridays.list`
- `api.flexFriday.fridays.create`
- `api.flexFriday.sessions.listByFriday`
- `api.flexFriday.sessions.create`
- `api.flexFriday.sessions.update`
- `api.flexFriday.sessions.remove`
- `api.flexFriday.workshops.listBySession`
- `api.flexFriday.workshops.detail`
- `api.flexFriday.workshops.upcomingPersonal`
- `api.flexFriday.workshops.create`
- `api.flexFriday.workshops.update`
- `api.flexFriday.workshops.remove`
- `api.flexFriday.registration.getMyRegistrations`
- `api.flexFriday.registration.getMyAssignments`
- `api.flexFriday.registration.register`
- `api.flexFriday.registration.unregister`
- `api.flexFriday.registration.assign`
- `api.flexFriday.attendance.getRoster`
- `api.flexFriday.attendance.markAttendance`
- `api.flexFriday.attendance.clearAttendance`
- `api.flexFriday.credits.getMyCredits`

## Data Model

- `flexFridays`
- `flexSessions`
- `flexWorkshops`
- `flexWorkshopSessions`
- `flexRegistrations`
- `flexAssignments`
- `flexAttendances`

## Permissions

Admins create Fridays. Staff manage sessions/workshops and attendance. Students
register or unregister themselves where capacity and session type allow.

The existing admin activity-query contract is restricted to Admin and Super
Admin roles. Those users see Schedule and Activity beneath Flex Friday in the
main sidebar and mobile More navigation, at `?view=schedule` and
`?view=activity`. Other roles remain on Schedule even when given an Activity
query URL. The older `?view=audit` spelling also selects Activity for authorized
users. Destination links retain Friday, session, and attendance selections;
same-page view navigation preserves local search and mounted form drafts.

## Side Effects

Creating a Friday adds a calendar entry and writes an audit event. Registration,
attendance, and workshop changes enforce capacity and relationship checks in
Convex.

## Personal Workshop Reads

The authenticated `workshops.detail` query resolves a Friday/workshop URL pair.
Malformed IDs, deleted records, or a workshop with no session linked to that
Friday return `null`. It returns all linked sessions for that Friday in time
order, the teacher's public name, and only the viewer's registration, assignment,
and teaching flags. It does not return another student's identity or booking.
The catalog remains available to authenticated users who have not booked it.

`workshops.upcomingPersonal({ now, limit })` finds the nearest Friday containing
a registered or assigned workshop for a student, or a staff member's own teaching
workshop. It skips nearer Fridays without a relevant commitment. `now` is a
client-refreshed timestamp; date boundaries and session timestamps use
`America/New_York`, including DST. A workshop remains upcoming until its final
linked session ends. Earlier completed segments remain in the returned workshop
so a multi-session booking is never presented as separate workshops.

The suggestion limit defaults to 3 and is clamped to 1–10. Reads inspect at most
16 upcoming Fridays, 32 sessions per Friday, and 512 candidate session/workshop
links across the search. `hasMore` reports an exhausted scan or additional items
on the selected Friday; an empty result with `hasMore: true` is inconclusive.
Each returned workshop resolves up to 128 session links; larger workshops raise
an explicit error instead of returning incomplete detail. All lookups use the
existing Friday, session, relationship, and viewer-membership indexes.

## Related

- [Calendar](calendar.md)
- [Schedule](schedule.md)
- [Wrapped](wrapped.md)
