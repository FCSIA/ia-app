---
tags: [reference, calendar, schedule, ui, review]
---

# Calendar and date-picker continuation — p04

This finishes the interrupted p04 round-2 adapter slice. Read the full recovered
visible transcript, original task/follow-up tool records, PRIMER, FIX, human
prompts, OWNER-ROUND-2, original verification report, current product documents,
and local source. Private reasoning was not extracted. Directly inspected the
owner's `round-2/6-schedule-day-plans.webp` markup.

The owner asked for one date-picker family, a school calendar with useful day
states, removal of “Select a school date,” and a properly composed assignment
action. This continuation owns the three previously dirty Calendar/DatePicker/
ScheduleDatePicker files and a narrow ManageBlocksPanel callsite change. It
preserves unrelated work and does not change backend state or runtime.

## Supported changes

- ScheduleDatePicker delegates to DatePicker while retaining its long weekday
  label and date-key callback. DatePicker adds the existing interrupted id,
  layout-class and label-format support, with one compact default format.
- Calendar retains the existing `--cell-size` contract. Cells can stretch within
  a planner while native day buttons keep their target size. The unused new
  size API and forced circular radius were removed: Button owns its shape.
- Selected/range endpoints use foreground/background, matching the local
  primary Button contrast. Today retains its primary ring. The parent supplies
  the surface, removing the extra background box inside Day Plans.
- School day markers now use CalendarDayButton's existing metadata slot instead
  of displacing the numeral. A legend describes the actual existing data states:
  Assigned, No school, Unassigned Friday. No A/B or Flex state was invented.
- Day Plans removes the redundant subtitle. Assign is a labelled native Button
  with its supported leading icon and loading state; school-year limits,
  inheritance, linkage, permissions and explicit mutation remain intact.

## Composition and dependency inventory

| Family | Current composition / consumers |
| --- | --- |
| Single dates | DatePicker → Radix Popover + Calendar; reminder all-day dates, academic-year settings, audit filters, Flex Friday form. |
| Schedule navigation | ScheduleDatePicker → DatePicker; resolved school-day panel and friend schedule dialog. |
| Date and time | Existing DateTimePicker → Popover + Calendar + native time input; announcements, events and timed reminders. Its previously committed required-selection and label fixes are retained. |
| Period/range navigation | ReUI EventCalendarDatePicker → Popover + Calendar single/range modes; calendar route. No separate DateRangePicker exists in this checkout. |
| School planner | ManageBlocksPanel → Calendar with supported custom DayButton and metadata; actual date-assignment query. |
| Dashboard | Existing seven-day agenda reuses CalendarEventRow; the old mini-month is retired. Parent owns dashboard changes. |

Date selection remains immediate through the native day button. DatePicker
closes after a valid selection; required fields cannot be cleared by selecting
their current day. DateTimePicker stays open so the separate time input remains
available. Escape/dismissal belong to Radix. Changing a viewed date is navigation;
reminder and day-plan persistence retain explicit Save/Assign actions.

## Reference inspection

Applied frontend-design, shadcn and React guidance with the repository's stated
school-day utility context. Read the full latest user video at
`/Users/sreysus/.codex/attachments/06b1b43e-5244-4d4d-9f5a-2d08ba168cca/Pasted text.txt`.
Relevant principles: distinct date/time/action targets, native pointer release
and cancellation, immediate truthful feedback, and primitive-owned dismissal.
No delay, gesture engine, fake undo, autosave or recovery contract was added.

The current [Fluid index](https://www.fluidfunctionalism.com/llms.txt) has no
Calendar/date picker. The repository correctly chooses the current shadcn
Radix Calendar adapter. Compared the official
[Calendar](https://ui.shadcn.com/docs/components/radix/calendar),
[Date Picker](https://ui.shadcn.com/docs/components/radix/date-picker),
[Radix Popover](https://www.radix-ui.com/primitives/docs/components/popover),
and [Fluid Button](https://www.fluidfunctionalism.com/docs/button) documentation,
API/usage source, exact Radix Button registry and local adapters.

`shadcn info --json` confirms Radix/new-york/Lucide, `@/` aliases, Tailwind v4,
Next 16.3.8. Calendar `add --dry-run` and `--diff calendar.tsx` completed and
were reviewed; they would overwrite both Calendar and Button, so no overwrite
was performed. `docs calendar date-picker …` reports date-picker is not a
registry item (the documentation confirms it is a composition). The subsequent
multi-component docs command failed in the temporary bunx cache on missing
`@babel/types`; official web documentation supplied the fallback. The child has
no CUA surface; parent owns live rendered/Code inspection and authenticated QA.

## Verification and critique loop

- Web typecheck: passed.
- Scoped ESLint on all four changed p04 source files: passed without warnings.
- `git diff --check`: passed.
- No backend, dependency, seed, deployment, persistence contract or server change.

The user's current requirement is explicit: every screenshot/photo starts a
fresh holistic critique of spacing, consistency, control size, hierarchy,
interactions and surrounding context. Use issues → supported fix → recapture →
critique again; a capture alone is not a pass. The critique skill was read.
Directly inspected the parent CUA captures under
`/tmp/ia-ui-continuation-2026-10-24/`:

- `p04-school-calendar-390.jpg`: seven columns fit within the school panel,
  numbers and markers remain separate, the selected today numeral is readable,
  month arrows sit beside the title, and the legend explains the states without
  another nested box. Three administrative tabs remain scrollable; no fourth
  section or sidebar was invented. No further supported defect was identified.
- `p04-period-picker-390.jpg`: the 248px popup fits within the viewport; 32px day
  targets, range bands, outside dates and selected/today states remain legible.
  The popup has a clear surface distinction without a second grid background.
  No clipping or new composition defect was identified.
- `p04-reminder-date-390.jpg`: the popup layers over the form correctly, its
  selected numeral contrasts with both surfaces, and its bottom does not cover
  Save reminder. The date trigger's value remains readable in the form column.
  This resolves the old geometry concern in the inspected all-day flow; the
  timed flow was not exercised in this continuation.

Parent exercised authenticated SUPER001 navigation: school day changed to
October 26 and the route/summary updated; next/previous month worked. Calendar
period Escape restored its trigger. Re-selecting October 24 in the all-day
reminder retained that date and closed the popup. Selecting October 26 closed
it and updated Starts/Last day; Escape restored the October 26 trigger. The
reminder was cancelled without saving. Parent measured no document overflow.
SUPER001 has school management, so My schedule/student DatePicker verification
is a separate role check and was still pending at this commit.

## Original larger findings and limits

The historical p04 report is a baseline, not today's verified state. Earlier
commits already repair the empty grid (`f70d577c`), period heading/toolbar
(`66a49ce3`), differentiated surfaces (`be7abfdc`), labels/required selections
(`847d6be1`), retained reminder duration (`cf5851f8`), agenda density
(`b134f277`), duplicate Day rail (`c2a156cb`) and shortcuts after dialogs
(`011ee162`). Current event chips dim through text/color mix rather than whole
chip opacity. Those page/engine/backend slices were not rewritten here.

Capacity limits and feed failure copy require their own backend/product review;
they are not solved or regressed by this adapter work. All-family native touch,
themes, reduced motion, VoiceOver, and final design-owner review remain open.
Schedule still has three administrative sections, so round-2's conditional
four-section sidebar proposal was not activated. Sidebar migration belongs to
the separate official Fluid Sidebar worker.
