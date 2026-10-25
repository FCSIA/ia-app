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

## Related

- [Calendar](calendar.md)
- [Schedule](schedule.md)
- [Wrapped](wrapped.md)
