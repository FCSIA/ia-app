# Special-day schedules implementation plan

## Scope and invariants

- A student's lunch assignment is one discriminator, `PERIOD_4` or `PERIOD_5`.
  New writes never represent both or neither. The chosen lunch period cannot also
  contain a course entry for any weekday.
- Existing `studentSchedules` rows remain deployable while the field is widened
  as optional. Reads resolve missing values to `PERIOD_5`; a bounded migration
  backfills rows that already have an unambiguous Period 4/5 gap and reports
  legacy conflicts instead of deleting course data.
- Student course choices remain canonical by `(weekday, periodNumber)`. A dated
  schedule only references canonical Period 1…8 identities; it never copies or
  rewrites a student's course selection when blocks move.
- Every day template owns an ordered, bounded list of blocks. Each block is
  either a canonical period reference or a custom block. Canonical periods may
  occur at most once per template/day, block times are valid and non-overlapping,
  and order is explicit rather than inferred from document creation time.
- A date has at most one override, keyed by a normalized school-local
  `YYYY-MM-DD` value. An override is a snapshot cloned from a named template, so
  later template edits cannot unexpectedly rewrite a published date.
- Dates without an override resolve through the active regular template. The
  resolver uses the calendar date's weekday to map canonical periods back to the
  student's existing weekly entries.

## Schema and migration

- Add optional `lunchPeriod` to `studentSchedules` using a literal-union
  validator.
- Add `schoolDayTemplates` and child `schoolDayTemplateBlocks`, indexed for the
  active regular template, name, and ordered template blocks.
- Add `schoolDayDateOverrides` and child `schoolDayDateBlocks`, with a unique
  date-key index and ordered child index. Store source template metadata for
  traceability, not live coupling.
- Preserve `schoolDayBlocks` as a legacy compatibility source during rollout;
  seed the new regular template from the existing base fixture and prefer the
  new resolver when it exists.
- Add a bounded internal migration that backfills lunch where safe and can seed
  the regular template without requiring a breaking schema push.

## Convex API

- Extend `schedule.dashboard.get` with an optional date key and a
  `resolvedDay` payload while retaining the existing `blocks` payload for old
  mobile clients.
- Extend `schedule.dashboard.save` with required lunch assignment for new
  clients, validate course/lunch conflicts transactionally, and preserve the
  existing `serializeScheduleForUser` seam for authorized friend/group views.
- Add a focused lunch mutation only if the UI needs independent saves; it must
  reject a target period containing courses rather than clearing them.
- Add admin-only template/date functions to list the calendar workspace, create
  or update templates atomically from ordered block arrays, set the regular
  template, clone/apply a template to a date, edit an override atomically, and
  reset a date override.
- Centralize normalization and resolution helpers so admin preview, student
  dashboard, and tests use the same validation and canonical mapping.
- Audit every mutation; only `ADMIN`/`SUPER_ADMIN` may manage templates or date
  overrides. Student schedule mutations continue to derive the current user.

## Web UI

- Keep weekly course editing as the primary student model, add a compact date
  navigator and resolved-day sequence that clearly labels special schedules,
  lunch, custom blocks, and omitted canonical periods.
- Add an admin "Day plans" workspace with a date rail, template selector,
  apply/clone/reset actions, and one flat ordered block editor. Reordering,
  labels, times, adding/removing blocks, and preview stay in one progressive
  surface rather than nested cards.
- Make the row course-picker chevron and `Other` action visible only on
  `group-hover`/`group-focus-within` for pointer/keyboard users, while retaining
  always-available controls on coarse/touch pointers.
- Use existing Fluid/shadcn primitives and semantic states; do not introduce a
  new primitive family.

## Mobile compatibility

- Preserve existing dashboard fields and mutation compatibility where possible.
- Adapt My Week/Home to consume `resolvedDay` for the current date and display
  special-day ordering without changing mobile weekly course editing.
- Keep the existing mobile admin block screen functional against legacy APIs;
  the capable template/calendar editor is web-first in this slice.

## Tests and verification

- Convex tests: lunch discriminator/conflict behavior, legacy fallback,
  template validation, authorization, one override per date, arbitrary reorder,
  split-day mapping to canonical weekly courses, omitted periods, and regular
  default fallback.
- Focused frontend tests for resolver/view-model utilities and hover/focus/touch
  action visibility where practical.
- Run Convex codegen, Convex typecheck/tests, web TypeScript and focused ESLint,
  web build, mobile TypeScript with the repository's documented deprecation
  override, and `git diff --check`.

## Cross-PR contract

- This PR owns core schedule contracts and should merge before the friend-link /
  friend-group PR rebases.
- Friend/group work should continue to call `serializeScheduleForUser` and should
  not add group data to `schedule.dashboard.get`.
- Template/date mutations are school configuration and must not emit friend
  schedule-change notifications. The friend PR should hook only personal
  course, lunch, and visibility changes in `schedule.dashboard.save` (or the
  focused lunch mutation if one is retained).

## Assumptions

- Canonical course identity remains `(weekday, periodNumber)`, per the shared
  contract; a special date uses its actual weekday when resolving a period.
- Date keys are interpreted in the school timezone (`America/New_York`) and
  passed/stored as calendar strings to avoid UTC day drift.
- A date override snapshots a template intentionally. Administrators explicitly
  re-apply a template when they want later template changes on an existing date.
- Regular templates contain canonical Period 1…8 blocks. A student's selected
  Period 4/5 renders as Lunch, and that canonical slot cannot hold a course.
