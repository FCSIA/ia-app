---
tags: [proposal, flex-friday, navigation, tutoring]
---

# Teacher Flex Friday and Community proposal

Status: design proposal, October 21, 2026. Product implementation is pending.
The owner chose **immediate student booking**, superseding an earlier suggestion
of teacher approval. Scope begins with [issue #82](https://github.com/virajdas/ia-app/issues/82).

## Recommended direction

Give each role a task-oriented Flex Friday landing view. Teachers open their own
day and rosters, students open their confirmed sessions and available tutoring,
and super admins plan blocks and teacher coverage.

Rename the main Clubs destination **Community**, with **Clubs** and **Friends**
as sibling views. Move connection management there while retaining schedule
comparison in Schedule and linking to it from each eligible friend. Keep
Calendar, Events, and Flex Friday directly accessible initially.

This proposal does not introduce direct messages, a social feed, or broader
schedule visibility. Existing eligibility, friendship, and sharing checks remain
authoritative. Staff must not acquire the student friend feature merely because
the shared Community shell exists.

## Diagnosis from the current app

| Current structure | Consequence | Proposed change |
| --- | --- | --- |
| Flex Friday opens with session and workshop management panels for every role | Teachers must navigate the school-wide builder to find their next responsibility | Default teachers to My day; expose browsing and management according to permissions |
| `workshops.create` stores the creator as `teacherId` | An admin creating a teacher's workshop becomes its owner | Explicit teacher assignment, validated on the server |
| Registration conflicts compare session IDs | Different session records with overlapping times can slip through | Compare actual linked time intervals for registrations and assignments |
| Friday creation adds a general calendar entry | Teachers lack a timed view of their own workshops | Derive viewer-scoped timed entries from canonical workshops and session links |
| Friends lives inside the schedule workspace/provider | Relationship management is difficult to discover and coupled to unrelated class-editor state | Extract connection management from the schedule editor; preserve comparison tools |
| Most desktop destinations are icon-only | Several school concepts require interpretation before navigation | Evaluate visible labels alongside the existing icons |
| Web and native organize destinations differently | A terminology change can create competing mental models | Align destination concepts while preserving each platform's navigation conventions |

The live production admin Flex Friday empty state and Clubs workspace were
inspected read-only. Source inspection supplies the populated-state diagnosis;
the interaction study uses fictional people, rooms, and counts.

## Teacher view

Default to **My day**, with **All workshops** secondary. Select the next relevant
Friday, honor explicit date links, and allow older dates for attendance review.
The current hook does not consume the command palette's `?friday=` parameter.

Show chronological rows with time, workshop title, room, booked count/capacity,
and a clear attendance state. **Open roster** is the row's main action. Teachers
see and mark attendance for their assigned workshops; the browse view must not
grant edit access to another teacher's workshop.

Place **Request unavailability** in the context of that teacher's tutoring block.
Show pending, approved, declined, and withdrawn states. A pending request does
not erase confirmed bookings or remove sessions from calendars. Administrative
review must expose affected bookings and require their explicit resolution
before an absence can cancel a booked block. Restrict any private explanation to
the requesting teacher and authorized reviewers.

Whether a pending request pauses new bookings is still a school-policy decision.
The recommended bulk preview excludes pending teachers until a decision is made.
No cancellation deadline or attendance policy is invented here.

## Student view

Use **My Friday**, **Find tutoring**, and **Workshops**. The first view shows
confirmed sessions, rooms, teachers, and the existing pass. Tutoring discovery
shows teachers, subjects, times, and available places. Search/filter only when
the actual teacher list warrants it, using the existing shared primitives.

**Book tutoring** confirms immediately when a place remains available. On
success, update the pass, roster, capacity, and calendar reactively. Cancellation
releases a place and updates the same canonical records. Full or unavailable
blocks must have an explicit state instead of a request action or invented
waitlist.

The mutation must recheck the authenticated student's role and active status,
workshop availability, linked sessions, target eligibility, capacity, and real
time overlap in the same transaction. Include both registrations and staff
assignments in the conflict check. Adjacent intervals are allowed; overlapping
intervals are rejected even when their session IDs differ. Never silently replace
another booking or a mandatory/assigned commitment. A failed save leaves the
student's previous confirmed schedule intact.

## Super admin view

Use **Plan Friday**, **Teacher coverage**, and **Unavailability**. Planning shows
the day's blocks; coverage compares teacher, room, and status; review handles
availability exceptions. Do not put a school-wide builder on the teacher landing.

Bulk tutoring creation has two explicit steps:

1. Choose the Friday and tutoring block, configure capacity and teacher/location
   data, and preview the eligible roster plus exceptions.
2. Create one tutoring workshop per eligible teacher, reporting created, already
   present, skipped, and failed outcomes. Rerunning the operation must not create
   duplicates or overwrite manually configured workshops.

An eligible teacher is active, has the TEACHER role, has no conflicting teaching
commitment, and has no unresolved/approved unavailability under the chosen policy.
Missing rooms or capacities remain visible exceptions, not fabricated defaults.
Preview is advisory: the mutation must recheck authorization, current teacher
eligibility, timing, and existing records when applying each bounded batch.

Use a stable batch identity and traversal cutoff/cursor, record progress, and
recheck teachers who become inactive during processing. Avoid one unbounded
mutation over every teacher. Before approving an absence with booked students,
show who is affected and resolve cancellation/reassignment and notifications
explicitly. An approval for a block with no bookings can complete directly.

## Navigation, icons, and platform behavior

| Destination | Icon direction | Expected user task |
| --- | --- | --- |
| Home | House | See what matters today |
| Schedule | ClipboardList, existing | Read timetable and compare shared schedules |
| Community | UsersRound, existing Clubs icon | Open clubs and manage friend connections |
| Calendar | CalendarDays or the existing CalendarRange | See dated commitments across features |
| Events | Ticket, existing | Discover events and register |
| Flex Friday | Presentation, existing | Book or run Friday sessions |
| Announcements | Megaphone, existing | Read school and club updates |

Keep notifications and settings as utility destinations. A chat-bubble icon for
Friends would suggest direct messaging that the feature does not provide. Do not
add a second people icon at the main navigation tier for the same audience.

Visible labels are the preferred desktop direction. [Nielsen Norman Group's icon
guidance](https://www.nngroup.com/articles/icon-usability/) supports pairing icons
with visible text when their meaning is not universal. This is a recommendation,
not a completed usability finding for this school. Test first clicks for “find a
friend,” “compare lunch,” “book tutoring,” and “mark attendance” with students and
teachers, using the full surrounding navigation.

The alternative **Plan** destination groups Timetable, Calendar, Flex Friday, and
Events. It reduces the main menu but introduces another navigation level and a
less explicit label. Keep it as a comparison candidate rather than adopting it
solely to reduce icon count.

Preserve stable route IDs, club deep links, invitation links, command-palette
targets, stored mobile tab preferences, and browser history. Changing the Clubs
display label does not require renaming every `/clubs` route or the persisted
`clubs` preference ID. Existing `/schedule?tab=friends` links must retain a useful
destination when relationship management moves. Keep comparison date/selection
state shareable where current privacy rules permit.

Web mobile currently supports more primary slots plus More; native uses five
tabs. Apply the same Community concept without copying the desktop sidebar into
native or silently discarding user-pinned web destinations. The narrow mockup is
a structure study, not an approved production mobile navigation pattern.

## Backend implementation boundaries

Reuse `flexWorkshops`, `flexWorkshopSessions`, `flexRegistrations`,
`flexAssignments`, and `flexAttendances`. Add an optional explicit workshop kind
for tutoring, teacher/date indexes for scoped queries, and a scoped availability
request model with reviewer state and audit history. Legacy workshops remain
ordinary workshops when the new discriminator is absent.

Teacher assignment needs validation on create/update, and own-workshop actions
need consistent authorization. Reuse the attendance backend's existing owner or
global-manager checks rather than creating a parallel roster/attendance system.

Derive timed calendar projections from workshop/session relationships for the
current teacher or registered/assigned student. Use stable IDs, school-timezone
conversion, read-only source metadata, and workshop links. The existing calendar
query treats non-personal Flex Friday entries as shared; inserting private teacher
workshops there indiscriminately would expose them. Extend the explicit calendar
return validator and client event mapping deliberately. Edits, cancellations,
teacher reassignment, and registration changes should not leave copied events
behind.

External Google/Outlook sync is separate from showing commitments in the app's
calendar. As [the calendar feature document](../features/calendar.md) records,
OAuth credentials and school-tenant decisions are not configured.

Use additive schema changes with legacy defaults; backfill only where required
and narrow validators later. This proposal does not require a Convex upgrade or
production schema migration to begin. Extract Friends queries/actions into a
feature-level boundary, not an import of the entire ScheduleWorkspaceProvider.

## Primitive and implementation review

Compose approved Fluid Tabs for panel changes, Table for comparable session or
coverage records, CardGroup/Card for club navigation, Button for commands, and
Select for choosing an existing Friday. A calendar grid is unnecessary for a
short list of already configured Fridays. Use the shared date picker only if
the task actually involves selecting a date.

The interaction study illustrates structure; its local controls are not proposed
shared primitive implementations. Before production UI work, inspect the current
rendered example, Code, API, registry, and local adapter for each chosen primitive
as required by `agent-notes/WEB_UI_WORKFLOW.md`. A labeled sidebar may need an
approved shared navigation API. Agent visual review does not approve that API or
the material visual direction.

Implement in coherent slices: ownership/conflict correctness; role-specific
teacher and student views; availability and bulk coverage; viewer-scoped calendar
projection; then Community extraction and navigation separately.

## Verification required before shipping

- Backend: wrong-user and wrong-role refusals; owner/global-manager roster access;
  inactive teachers; eligibility; actual interval overlap; adjacent sessions;
  concurrent last-seat booking; cancellation; duplicate bulk retries; pending and
  approved absence handling; booked-student resolution; private calendar access;
  stable projection after edits/reassignment; timezone and DST boundaries.
- UI: loading, no Friday, no own workshops, empty/full tutoring, save failure,
  booking/cancellation, roster and attendance, preview/apply exceptions, pending
  requests, long teacher/room names, direct links, history, focus restoration,
  keyboard tabs, themes, reduced motion, and 320–1440px layouts.
- Navigation: existing club/invite links, friend comparison links and sharing
  restrictions, command palette, stored mobile preferences, and native device
  review. Validate labels/icons with real first-click tasks before consolidating.

No deployment was selected or changed for this proposal. Product code checks
are not a substitute for the required implementation and design-owner review.

## Interaction study checks completed

The conversation's clickable study was inspected at 320, 390, 768, and 1024px
viewports. Teacher roster, student tutoring, and admin coverage content fit
without horizontal overflow at those widths; Community and comparison also fit
at 320px. Fixed a stretched narrow navigation region and a full-state label
that fell into the time column.

Exercised simulated immediate booking, updated pass state, cancellation/seat
release, retained attendance, bulk preview/apply, unavailability review, friend
acceptance, schedule comparison, and both navigation variants. Keyboard view
switching and focus after booking/cancellation work. Light/dark changes preserve
the selected view after fixing a host-state reset. Teacher-only accounts do not
gain the student Friends view. The fragment's script passes a syntax check.

These are prototype diagnostics, not backend concurrency/authentication tests,
native-device testing, real-user first-click testing, six-theme product review,
or design-owner approval. No application source was edited, so web/backend
typecheck, lint, and production build were not run for this documentation slice.
