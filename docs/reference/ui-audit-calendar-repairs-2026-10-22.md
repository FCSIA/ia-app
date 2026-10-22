# Calendar audit repairs — October 22, 2026

Scope: `ui-audit-2026-10-22/pages/04-calendar/{boards,findings}.md`, F1–F22.
The owner approved proceeding with the audit's shared API/layout direction.
The table records implementation closure of the reported defects, not human
visual approval. Material visuals still await the design owner.

## Finding ledger

| Finding | Implementation | Evidence and remaining diagnostic limits |
| --- | --- | --- |
| F1 — pending invite crash | Pending-invite results explicitly project the return validator's fields instead of spreading the stored document. The invite control has a local error boundary; the calendar route has a retry error boundary. | `calendar.test.ts` exercises the real validated query, acceptance, recipient authorization, and visibility before/after acceptance. Fixture shows a pending invite without replacing the grid. Updated authenticated backend/browser integration has not been deployed or exercised. |
| F2 — orphaned period navigation | Period controls occupy the AppShell heading: previous/next, date-picker title, and Today only outside the active period. ReUI pairs `sm` text controls with `icon-compact`. | Desktop month/day and phone agenda/three-day fixtures; title is shortened on phone while the accessible name retains the full period. Today is also available in the phone overflow. |
| F3 — indistinguishable gear and plus | A labelled `Reminder` action creates entries; `Calendar feeds` is a named overflow command. | 320px and 390px fixtures fit without clipping; primary action and feed action have distinct semantics. |
| F4 — undifferentiated surfaces | ReUI distinguishes toolbar/header/gutter, canvas, outside dates, off days and today. Hour lines use 7% foreground; structural lines retain the shared border. Past chips dim through their existing state attribute. | Desktop month and timed-view screenshots inspected. Agent review is diagnostic; full theme and reduced-motion owner review remains. |
| F5 — translucent event chips | The shared event wrapper mixes source color into the opaque card surface instead of alpha-compositing over the grid. | Desktop time-grid fixture inspected with overlapping events; source review confirms all grid chips use the same opaque fill. |
| F6 — imported all-day/date/link loss | ICS DATE and floating values use America/New_York. All-day end dates remain exclusive across DST; recurrence occurrences use their own dates. Safe VEVENT URLs survive normalization. The client uses explicit `allDay`. | ICS tests cover summer/winter/DST-change date-only entries, recurring dates, floating times, safe/unsafe URLs and oversize import rejection. Existing imported rows acquire these fields on their next successful sync after deployment; no live subscriptions were refreshed. |
| F7 — inert month cells and incomplete more | Month numerals navigate to Day, empty cells/add controls open a prefilled reminder, and More opens the complete day. Numerals occupy the top-left header. | Desktop fixture More opened Day with all nine events; phone empty-slot click opened a reminder with the chosen date/time. |
| F8 — chip density and unexplained source | Month chips lead with compact timed labels, use smaller vertical padding, and omit time for explicit all-day entries. A labelled source filter includes source-color dots and passes sources into the query. New Flex entries write `FLEX_FRIDAY` with a real school-day interval; historical linked SCHOOL rows are projected consistently. | Browser fixture source legend and all-day bars; legacy Flex projection and empty-source regression tests. Historical rows are rendered through projection, without a data migration. |
| F9 — disabled forms instead of details | Every entry opens details: desktop anchored Popover or the existing responsive Dialog sheet. Own personal details expose Edit; published entries and connected entries expose their source links. Shared details identify the sender and allow only the recipient to remove acceptance, leaving the owner's reminder intact. | Fixture personal details → Edit and external assignment source link; real backend tests reject a stranger's removal and prove the owner entry survives recipient removal. School/club/Flex routes are source-reviewed, not authenticated end-to-end tested. |
| F10 — restyled, inconsistent reminder forms | Add/Edit share `ReminderForm`, approved Field/Input/Textarea/Switch/DatePicker/DateTimePicker compositions and Dialog defaults. Both persist start, end and all-day intent; delete uses AlertDialog. | Phone 320px form fit, desktop editor, all-day date selection and captured update payload. Native keyboard/screen-reader review remains. |
| F11 — DatePicker never closes | The shared DatePicker owns open state and closes after a valid day selection. | Fixture selected the last day in an all-day reminder; the popup closed and the update used the intended exclusive end. Other consumers inherit this shared fix; their product flows were not re-exercised here. |
| F12 — hidden view choices and unreliable shortcuts | Approved Tabs expose the current panel. The focused calendar canvas implements M/W/D/A/3/T and ignores editable controls/modifiers. | Desktop and phone tab changes update the URL and selected panel. Shared focus-token repair is owned by the root UI slice. Native assistive-technology review remains. |
| F13 — phantom rows, wide slabs, no school context | All-day lane defaults to auto; single Day omits the duplicate date header. Phone gutter is narrower. Day chips cap at 36rem, an xl day summary uses the freed space, and schedule bands use the supported ReUI background slot. Week/multi-day headers use a consistent today numeral. Initial scrolling includes early timed events. | Fixture verifies an absent lane with no all-day entries and a present lane with Flex/connected entries, schedule-band rendering and Day summary. Fixture schedule data is mocked; live schedule resolution is not part of this browser proof. |
| F14 — phone clipping and nonfunctional grid creation | Phones initialize to Agenda, offer Day/3 days, shorten the period title, retain a labelled creation action, wrap toolbar controls within the viewport and show complete two-line time ranges. ReUI slot clicks create without a hold/drag gesture. | 320×844 and 390×844 screenshots; `documentElement.scrollWidth === innerWidth === 320`; a 320px empty time-grid slot opened a correctly prefilled form. A native touch device was not used. |
| F15 — jumping invite strip and teacher dead end | A stable student-only toolbar control replaces the conditional strip. Editor invitations are a separate action with a searchable Command composition using regular/preferred names; selected recipients are explicit and capped at 20. Non-students do not see friend-invite controls. | Fixture no-result search, keyboard selection and selected indicator; role branch and backend student eligibility reviewed. Teacher browser/authenticated sharing flow remains unverified. |
| F16 — feed naming, validation and spinners | One `Calendar feeds` name, useful Canvas steps, one cadence statement, inline HTTPS/credential validation, relative update time and human failure copy. Pending state is keyed by subscription/action; concurrent operations are disabled. | Fixture HTTP rejection is inline. During Canvas refresh, Canvas `aria-busy=true`; the second feed remains non-busy. No real feed URL was submitted. |
| F17 — sparse agenda with missing context | One sticky day label includes Today. Calendar and Dashboard share `CalendarEventRow`: time range, source dot, title, source/sender and location; phone time ranges wrap rather than truncate. Separators are lighter. | Desktop/phone agenda screenshots and source reuse in the root Dashboard slice. Complete title/details remain available by opening the entry. |
| F18 — empty/loading/URL/mobile initialization | Empty uses the shared inline Empty with create/connect actions. Range changes retain the previous entries and show a 2px progress indicator; the canvas is not dimmed/disabled. `view` and `date` are URL state, with browser navigation synchronized. Mount waits for the responsive hook before choosing the default view. | Fixture reload, tab/More URL transitions, delayed mock queries and phone default Agenda. Calendar URL inputs reject rollover/nonexistent school wall clocks. Live network failure/reconnect behavior was not exercised. |
| F19 — unbounded private reads, missing overlaps, lost end | Personal ranges use owner/source indexes, public ranges source indexes, and imported ranges owner indexes. Start and overlapping-end reads are bounded and deduplicated. Edits send end/allDay; omitted end preserves existing duration. | Tests include 1,001 other-owner private reminders, overlap inclusion, own-volume explicit failure, foreign-owner write refusal, invalid end and retained duration/all-day intent. See bounded-read contract below. |
| F20 — Dashboard/page drift | Shared source definitions and `CalendarEventRow` are reused by the root Dashboard seven-day agenda; full-calendar links carry the intended day. Shared CalendarDayButton metadata has a reserved absolute bottom slot, so it cannot displace the numeral. | Root owns Dashboard integration/QA and commits. The retired mini-month no longer needs source dots; the shared date-picker adapter remains reusable. |
| F21 — repeated headings/copy | The period is the page heading. Dialog labels/CTAs use reminder terminology; duplicate view/day headings and optional-field annotations are removed. | Source review and fixture headings. Accessible Dialog descriptions remain concise rather than being removed. |
| F22 — low-contrast today numeral | Month, multi-day headers and shared CalendarDayButton use semibold foreground numerals on a 20% primary tint with a primary ring, the audit's alternate contrast treatment. | Actual fixture inspection caught that `primary-foreground` remained white over orange (249,112,21), so token naming alone did not fix contrast. The alternate is checked in light mode; all-palette human review remains. |

## Bounded-read and import contract

- A requested calendar range is at most 92 days and must contain finite dates.
- Each indexed source/owner start or overlap scan allows 1,000 rows and reads
  one extra to detect overflow. An overflow throws a clear error; no result is
  silently truncated. Accepted invitations have the same explicit 1,000 cap.
- End-index overlap scans are owner/source scoped but may inspect future
  events before filtering to `startAt < range.start`. More than 1,000 future
  rows in a source/owner can therefore fail even a short requested range. The
  root approved this bounded implementation with an explicit failure contract.
  A per-day/span materialization or paginated interval architecture is future
  work if real volume reaches that limit; it is not represented as solved.
- A feed imports at most 300 events in its 31-day-back/one-year-forward window
  and inspects at most 20,000 recurrence occurrences. Exceeding either limit
  fails the sync, preserving the previously successful import rather than
  silently omitting later dates.
- All optional schema additions and indexes are in the root schema commits.
  No shared deployment, seed, reset, live feed or migration was changed.

## Primitive research and composition decisions

Current [Fluid index](https://www.fluidfunctionalism.com/llms.txt), rendered
examples, Code, API and exact registry sources were inspected for Button,
Dialog, Tabs and Switch; InputGroup was compared with this project's existing
Field/Input adapters. The relevant Radix Calendar dry-run/diff and local
DatePicker/DateTimePicker/AlertDialog/Popover/FilterToggleGroup adapters were
reviewed. `shadcn info --json` reported Radix/new-york. Registry sources were
compared directly, without automatic overwrite.

- [Dialog](https://www.fluidfunctionalism.com/docs/dialog) and
  [Tabs](https://www.fluidfunctionalism.com/docs/tabs) supply the modal and
  view-switching semantics. The existing Dialog mobile sheet is retained.
- [Switch](https://www.fluidfunctionalism.com/docs/switch) owns All day.
- FilterToggleGroup is the established immediate-filter pattern, inside a
  Popover; it is not a set of interactive badges.
- The current Fluid [Combobox](https://www.fluidfunctionalism.com/docs/combobox)
  and CommandMenu were considered. Friend selection composes the already
  approved local Command/Popover course-search pattern; no new shared API or
  copied Base UI component was introduced.
- ReUI exposes slot clicks, event rendering, day backgrounds, navigation,
  all-day visibility and view settings. Those supported slots/defaults carry
  calendar-specific behavior, rather than page-level primitive overrides.

The audit's optional phone swipe/FAB/alternate drawer composition was not added.
Arrows, a labelled toolbar creation action and the existing responsive sheet
resolve the reported navigation/clipping/creation failures. These are explicit
implementation adaptations, not claims that every speculative layout detail in
the audit was copied. Material visual decisions remain awaiting owner review.

## Checks and review environment

- `direnv exec . bun run --filter cvx test -- src/calendar.test.ts src/events/externalCalendarIcs.test.ts`:
  13 passing tests, including the multi-user negative authorization paths.
- Backend TypeScript passes. Web lint passes with 19 warnings outside calendar.
- Final backend and web TypeScript pass after the detail/friend-search changes.
  The root repaired the concurrently edited Flex Friday hook's nullable URL
  access before the final run.
- Production compilation is part of the root's combined verification, not a
  calendar-specific deployment claim.
- Browser QA used a separate esbuild fixture in
  `/tmp/ia-calendar-audit-repairs`, serving the actual route/components at port
  3014 with mocked auth, query, router and mutation boundaries. CSS was compiled
  from current globals through Tailwind/PostCSS, not copied from an old Next
  build. This proves client composition/interaction only.
- Inspected states: desktop 1280×900 month/day/agenda, phone 390×844 and
  320×844 agenda/three-day/form/details; month More→Day; all-day conversion and
  exclusive-end update payload; empty-slot create; friend search/selection;
  feed inline error and independent pending state; external source details.
- A dedicated shared Calendar fixture with metadata on every day confirms a
  32px target and 3px metadata slot positioned 2px above its bottom; the numeral
  remains centered. The Button content wrapper is made static by the day
  adapter so it cannot become the metadata containing block.
- Screenshots were inspected in the browser tool output during this session.
  Authenticated localhost redirected to login, so no updated full-stack route
  was exercised. Native touch, VoiceOver, all-theme/reduced-motion and final
  human visual review remain open validation gates.

No reported calendar defect is knowingly left as an unimplemented quick fix.
The explicit capacity limit, optional gesture/layout alternatives and review
gates above remain visible rather than being counted as verified behavior.
