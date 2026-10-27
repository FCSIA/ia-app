# Fluid date and command continuation

The owner requested the latest official Fluid Cmd+K and calendar controls,
useful native capabilities, consistent composition and React behavior. Original
human prompts and the supplied interaction video transcript remain the intent
reference. Work is isolated to `.claude/worktrees/ui-verify` on
`claude/ui-audit-fixes`; unrelated primary checkout changes are preserved.

## Source and composition

Reviewed current rendered, Code and API examples for
[Calendar](https://www.fluidfunctionalism.com/docs/calendar),
[DatePicker](https://www.fluidfunctionalism.com/docs/date-picker) and
[CommandMenu](https://www.fluidfunctionalism.com/docs/command-menu), exact
registry items at `/r/calendar.json`, `/r/date-picker.json`,
`/r/command-menu.json`, and the local dependency/callsite contracts. Fresh
shadcn info reports Radix, Next 16.3.8, Tailwind 4 and Lucide. Selective install
preview showed six new files, eleven adapter overwrites and 112 CSS variables;
those wholesale changes were not applied. The installed Next use-client guide
was consulted before editing client components.

The native Calendar uses `@daypicker/react` 10. The old DayPicker 9 adapter is
removed. Required selection, disabled dates, academic bounds, date navigation,
focus, ARIA and native hover/month motion stay with Fluid. Day plans use the
published fill, cell-size and day-detail APIs for status dots. Their descriptions
remain available to assistive technology and the existing legend remains.

Radix DatePicker and DatePickerCore own native date labels, clear, editable
time segments, quarter-hour suggestions and responsive wrapping. App-owned
DateField/DateTimeField only translate existing local ISO form strings; the
bespoke DateTimePicker is removed. Draft time can precede date selection.
Accessible named groups distinguish start/end/expiry controls. Feature date
constraints, serialization and submission callbacks remain intact.

The full event calendar keeps its agenda/week/month functionality. The new
Fluid Calendar supplies its date-selection popup. Its frame uses the published
DatePicker padding rather than the old transparent-grid assumption. Native
selected-day autofocus and an accessible popup name are supplied through the
existing APIs. No page-specific radius, clipping or day geometry is added.

Upstream-to-local changes are limited to installed framer-motion, equivalent
existing type/shape values, the calendar icon mapping, the upstream optional
HoverHighlight fadeIn flag, and exact popup/keyboard/omit helpers. Shared size,
shape and global theme definitions are retained. Calendar, DatePicker and
CommandMenu are guarded against automatic overwrite by fluid:update.

Command migration and the owner-approved native DialogTrigger focus contract
are documented in `ui-command-menu-continuation-2026-10-27.md`.

## Runtime and verification

The web preview now runs at http://localhost:3000. Port 3101 was previously used
to keep this work isolated; 3000 was free when the owner asked to use it. Both
ports use this same isolated checkout/backend, not the unrelated primary work.
The existing local backend is `local:local-ia_app-ia_app-3231` at 3280/3281.
No data reset/seed, shared or production deployment, push, merge or release was
performed in this continuation.

Web typecheck, full lint (zero errors, 19 existing warnings), production build
and whitespace checks pass for this date/command migration. These checks will
be rerun after the subsequently requested contextual search/workshop work.
Agent visual review is diagnostic; material visuals await the owner.

## Diagnostic review

Every saved screenshot receives a fresh critique of hierarchy, spacing,
consistency, sizing, surfaces/contrast, interactions, overflow and state. Capture
artifacts live at `/Users/sreysus/.codex/visualizations/2026/10/27/ia-fluid-upgrade`;
current exact registry snapshots are saved in its `registry/` directory.

- `day-plans-desktop.png` (1440×900): native fill grid fits its existing calendar
  panel, status details are compact and legended, selected date has a clear
  persistent fill, and the plan table remains readable. The sidebar/content
  boundaries and heading scale are consistent with the existing frame. No
  overflow or extra date-button layer is introduced. Detail-bearing days use
  Fluid's native two-line anatomy; no page baseline adjustment is applied.
- Day-plan click selects an unassigned Friday and shows its existing assignment
  UI. PageDown moves keyboard focus/month to November without changing selected
  date until activation. No plan was changed.
- Event form checks preserve a drafted 10:30 AM time when October 30 is chosen,
  disable October 29 in the end chooser, and clear an optional end date. These
  were canceled without saving an event.

- `date-time-phone.png` (390×844): the native date/time segments fit one row,
  the popup fits above the mobile navigation, and calendar captions/day targets
  stay aligned within the published frame. The popup deliberately covers later
  form controls while open; canceling restores the form. Header placement was
  checked against actual DOM geometry after resize/HMR; final captures use the
  actual CDP viewport, without full-document capture artifacts.
- `calendar-popover-desktop.png` (1440×900): the old square-on-rounded surface
  mismatch is gone with the published padded frame. Caption/navigation, selected
  and focused day, popup edge, and parent calendar remain distinct and fit.
  Selected-day autofocus, ArrowRight and Enter navigate to October 28 and close
  the popup; the resulting URL is `/calendar?view=month&date=2026-10-28`.
- `command-desktop.png` (1440×900): native query, scope tabs, matching row and
  footer align inside one panel; selected scope and result are visibly distinct,
  and the backdrop makes the interaction owner clear. Its native caption/footer
  density remains for owner review. Search opens one dialog with input focus;
  Cmd+K toggles once, query survives Pages selection, Enter opens Calendar, and
  Escape returns focus to Search after Radix's close lifecycle completes.
- Existing local presence reports a duplicate session ID when multiple preview
  tabs share the login. No new date-control error was observed; this unrelated
  presence diagnostic is not represented as a clean-console pass.

## Remaining owner review

Review the native controls in daily use, especially touch keyboard/device
behavior, long localized labels, all product themes and reduced-motion states.
Source conformance, screenshots and code checks are not design approval.
