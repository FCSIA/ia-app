# Teacher Friday prototype review — October 21, 2026

This is the owner's requested prototype in the real web app, replacing the
standalone design study as the review surface. Material visual changes await
the design owner's review. Browser diagnostics establish behavior and expose
layout defects; they do not establish design approval.

## Run and review

Managed worktree: `teacher-flex-prototype/ia-app`, branch
`codex/teacher-flex-prototype`.

When the prototype web server is running at `http://localhost:3000`, review these routes:

- `/flex-friday?view=teacher`: teaching day, rosters, attendance, time-away request.
- `/flex-friday?view=student`: bookings, available tutoring/workshops, Friday pass.
- `/flex-friday?view=admin`: schedule, teacher coverage, bulk tutoring, requests.
- `/clubs`: Community with Clubs and Friends siblings.
- `/schedule?prototypeFriend=Amelia%20Williams`: comparison remains in Schedule.

Use the Prototype role Select to switch Friday roles without losing the day's
local state. It previews a persona; it does not change the signed-in user's
actual permissions. Reloading, leaving Friday, or choosing another date resets
the Friday fixtures. Community fixtures reset when leaving Community.

The app shell authenticates against this worktree's freshly seeded anonymous
local Convex backend on 3210/3211. No backend source, existing shared deployment,
or production data was changed. Local demo sign-in follows
`docs/backend/seed-and-reset.md`.

To restart from this worktree, in separate terminals:

```bash
direnv exec . bun run --cwd apps/convex convex dev --typecheck disable
NEXT_PUBLIC_FRIDAY_PROTOTYPE=true direnv exec . bun run --filter web dev
```

The prototype is guarded by both development mode and the public opt-in flag.
Production builds retain the existing pages and Clubs navigation label. The prototype does not implement production functionality.

## Composition

The prototype retains AppShell, navigation structure, Work Sans, surface/shape
contexts, semantic colors, and local Fluid adapters. It adds no global CSS or
shared primitive API. Copy identifies actions, records, and consequential states;
there are no promotional subtitles or dashboard metric cards.

| Need | Composition and reason |
| --- | --- |
| Switch role-specific views | Fluid Tabs; switches panels rather than persisting form data. Three-tab lists use text labels to fit small screens without shrinking controls. |
| Friday, subject, block, attendance | Fluid Select; each chooses one known value. A calendar grid adds no value for the three fixed Friday dates. |
| Sessions, rosters, coverage, comparison | Fluid Table; columns compare records, with stable numeric body-row indices. Narrow screens fold secondary columns into the record cell. |
| Club and friend destinations | Fluid CardGroup with direct Card children; flexible navigation follows the existing club/channel pattern. |
| Pass and time-away form | Existing Radix Dialog adapter with supported parts; focus/dismissal remain primitive-owned. |
| Full, booked, paused, conflict, request state | Non-interactive semantic Badge; unavailable actions are readable states rather than faint disabled buttons. |
| Community navigation | Existing UsersRound rail icon and route, with Clubs/Shapes and Friends/UserRound tabs. Comparison still lives under Schedule. |

The review inspected each relevant Fluid live rendered example, Code example,
API, exact registry source, and local adapter:

- [Table](https://www.fluidfunctionalism.com/docs/table) · [registry](https://www.fluidfunctionalism.com/r/table.json)
- [Tabs](https://www.fluidfunctionalism.com/docs/tabs) · [registry](https://www.fluidfunctionalism.com/r/tabs.json)
- [Select](https://www.fluidfunctionalism.com/docs/select) · [registry](https://www.fluidfunctionalism.com/r/select.json)
- [Button](https://www.fluidfunctionalism.com/docs/button) · [registry](https://www.fluidfunctionalism.com/r/button.json)
- [Badge](https://www.fluidfunctionalism.com/docs/badge) · [registry](https://www.fluidfunctionalism.com/r/badge.json)
- [Dialog](https://www.fluidfunctionalism.com/docs/dialog) · [registry](https://www.fluidfunctionalism.com/r/dialog.json)
- [Card](https://www.fluidfunctionalism.com/docs/card) · [registry](https://www.fluidfunctionalism.com/r/card.json)
- [Radix Textarea](https://ui.shadcn.com/docs/components/radix/textarea)

`shadcn info --json` reports Radix, New York, Lucide, Next 16.3.8, and Tailwind 4.
No installed primitive was replaced. Local adaptations, including Dialog's
`asChild` contract and the Select minimum width, are preserved.

## Diagnostics and repairs

- Removed a redundant desktop toolbar row; date and contextual action sit beside
  the view tabs and wrap at narrow widths.
- Moved the prototype role selector below the narrow header so the page title
  remains visible. The shared Select's 160px minimum remains intact.
- Fixed the mobile filters' actual cause: two controls and a count competed for
  one row. Filters now get the row's width, stack below 360px, and report the
  result count to assistive technology without another visible label.
- Booking immediately adds a pass and consumes one place; cancellation restores
  it. Existing bookings, capacity, overlaps, and approved absences govern actions.
- A teacher's request explicitly affects Blocks 1–2, so the booking count excludes
  their Block 3 workshop. Approval pauses new bookings and preserves existing
  bookings for coverage. Pending requests and approved absences have distinct
  coverage labels.
- Bulk creation previews three eligible teachers, excludes existing sessions and
  unavailable teachers, and becomes unavailable after creation. Displayed sessions
  remain ordered by start time.
- Student membership is reflected in the teacher roster; the sample student is
  not listed in an unbooked session. Attendance survives roster navigation and
  role changes. Roster and club detail navigation move focus to the detail heading
  and restore it to the opener on return.
- Notices remain scoped to the role that performed the action.

## Verification

- `direnv exec . bun run --filter web typecheck`: passed.
- `direnv exec . bun run --filter web lint`: passed; 21 pre-existing warnings,
  no errors or new prototype warnings.
- `direnv exec . bun run --filter web build`: passed with Turbopack.
- `git diff --check`: passed.
- Authenticated browser checks: book/cancel, place counts, pass dialog, contextual
  block filter, full/conflicting sessions, roster attendance/focus, required
  request reason, scoped request counts, approval/booking pause, bulk creation,
  club details, friend accept/decline, comparison destination and return.
- Responsive inspection: 320px and 390px phone layouts, 768px tablet, 1440px and
  default desktop. Inspected table containers fit without horizontal scrolling;
  the document has no horizontal overflow.
- Teacher screen inspected in Light, Dark, Contrast, Bubblegum, Bubblegum Dark,
  and the seeded Custom theme. Original Custom preference restored.
- Keyboard arrow selection works under emulated reduced motion; override reset.
- Export calendar downloaded three events with the expected date, local times,
  and rooms. Calendar application import and ongoing calendar synchronization
  were not tested or implemented.
- Final live prototype console: no errors.

Screenshots are local review artifacts under `/tmp/ia-teacher-prototype-review/`:
six teacher themes, tablet teacher, phone student/admin, desktop student, and
Community Clubs/Friends. Final captures use the normal browser viewport.

## Limits requiring follow-up

This is a development-only UI prototype. Bookings, attendance, availability,
bulk creation, clubs, friendship actions, and comparisons use fictional local
state. The real auth shell is not evidence of backend authorization for these
future features. Production work still needs transactional capacity/overlap
enforcement, teacher/admin authorization, persistence, real rosters and calendars,
coverage assignment, and the existing friendship privacy model. The fixtures use
12-hour times. Native touch hardware, screen-reader operation, large real datasets,
loading/retry states, and calendar-client compatibility remain unverified.

Review the placement, density, status colors, hover/focus/open states, and the
Community information architecture with the design owner before promoting any
of this UI into production.
