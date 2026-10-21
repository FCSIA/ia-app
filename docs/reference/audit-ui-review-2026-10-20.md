# Audit UI review — October 20, 2026

The primary checkout is on `codex/admin-audit-log-ux`. This is diagnostic
verification, with material visual changes awaiting the design owner's review.

## Focus edge clipping follow-up

The search field's orange focus ring was clipped by the shared admin scrolling
panel, rather than duplicated by the SearchInput wrapper. Before the repair,
both the input and scroll viewport began at y=140, so the 1px outset ring lost
its entire top edge. Fields at either horizontal edge also lost part of their
ring. The input itself has the existing neutral border plus accent focus ring.

`AdminScrollTabPanel` now puts the existing 12px top gap inside the viewport.
The panel also reserves a 4px horizontal gutter with an equal outer expansion,
preserving content alignment and available width. This repairs the ScrollArea
composition using its existing `viewportClassName` contract; no input focus
style, shared primitive API, or audit-specific override changes. The desktop
search remains at x=343.8359375, y=140, width=1015.2265625, height=36; the clipping
viewport now begins at y=128. The independently scrolling Users panel retains
its previous spacing.

The current Fluid index, [InputGroup](https://www.fluidfunctionalism.com/docs/input-group)
and [Scrollbars](https://www.fluidfunctionalism.com/docs/scrollbars) rendered
examples, Code, API, registry sources, and local adapters were inspected.
The existing SearchInput composition is retained. Current shadcn Radix
[ScrollArea documentation](https://ui.shadcn.com/docs/components/radix/scroll-area),
example, and Radix API were checked. No registry component was updated.

Desktop pointer/keyboard focus, search clearing, expanded filters, and native
touch scrolling at 320px were checked. Search and edge fields retain complete
focus rings without horizontal document overflow; Student roster also fits the
shared panel. Typecheck and lint pass, with the same 21 existing lint warnings.
Production build was not repeated for this layout-only adjustment. Captures:
`/tmp/ia-audit-review/input-focus-before.png`, `input-focus-after.png`,
`input-focus-side-after.png`, `input-focus-320-touch.png`, and
`input-focus-320-expanded.png`. Native device testing and owner visual approval
remain outstanding.

## Latest composition and repetition pass

The previous composition used separate full-width rows for search, Filters, and
Advanced search. Closed disclosures consumed the same horizontal emphasis as
results, while desktop Activity and Record columns separated one event's meaning.
The latest pass replaces that arrangement with the following composition:

- Activity views, search, and a compact Filters trigger share one desktop toolbar.
  Below desktop width, views sit above the search/filter row. Search remains
  visible; its value is not repeated in a summary.
- The filter disclosure expands inline. Existing Field/FieldGroup patterns use
  one column on mobile, two at `md`, and four at `xl`. Record ID spans two columns;
  From and To each receive a full column. A first experiment paired both dates
  inside a single column; selected date text plus two clear actions exposed its
  insufficient width, so that layout was discarded.
- Advanced search uses the existing local Radix Collapsible with a Button trigger,
  inside Filters. Applied field/query summaries and Clear filters remain visible
  when closed; an unapplied draft remains explicitly distinguished. Invalid
  drafts keep the last applied query and results.
- The first table cell contains category plus concise action, followed by the
  affected record. Person and time use bounded columns. At narrow widths they
  fold beneath the activity. IDs appear only when the title cannot be resolved.
- Shared action copy uses `action` and `entityType`, stripping only the event's
  own entity prefix. Qualifiers such as reaction/member role remain. Unknown
  pairs fall back to the full label. Original codes remain in search and Details.
- Category colors now remain constant across additions/deletions; the action
  states what happened. Long names and unknown category text stop at two lines,
  alongside existing title/context/preview bounds. Details preserve complete values.
- A date-on-first-row experiment was discarded: scrolling would leave times
  without visible date context. Every event retains its date and exact time.

Current Fluid Table and Button rendered examples, Code/API, exact registries,
and local adapters were checked again. Fluid does not provide Field/Collapsible
in its current registry; current shadcn **Radix** docs and local adapters were
reviewed. Collapsible's dry-run matches the installed Radix wrapper. This uses
existing composition contracts, with no new shared primitive API or geometry
patch. The existing Table row index contract remains intact.

The schema already separates action, entity type, and entity ID. No normalization
migration is necessary for the display change. New comment events now retain
`announcementId` and the title in existing metadata; deletion no longer loses the
parent's context. Comment text is not added to the audit snapshot. Historical
missing/deleted relationships cannot be recovered and retain their ID fallback.
Convex 1.47's [staged validators](https://docs.convex.dev/database/schemas#staged-validators)
validate proposed schemas in the background; they do not migrate records. The
repo remains on 1.46.0.

Browser diagnostics cover 320, 390, 768, 1024, and 1440px without document
horizontal overflow. Selected dates and independent clear buttons fit at 320px
and tablet width. The October 17 inclusive range returns 16 records. Structured
`type:Comment` returns two historical events; an unterminated quote keeps those
results while disabling Apply and showing the validation error. Clearing, empty
results, filter keyboard order, raw event data, and Escape/focus return pass.
Synthetic cases cover long Unicode names, unbroken previews/IDs, unknown types,
automatic/deleted actors, loading, sparse pages, pagination states, six themes,
and reduced motion. Theme captures also include intermediate transition frames;
the preceding settled color review still applies because the pass adds no color
tokens. The temporary fixture route was removed before building;
the original Custom theme was restored.

Evidence is in `/tmp/ia-audit-review/composition-*.png`, including
`composition-final-desktop.png`, `composition-expanded-desktop.png`,
`composition-final-320.png`, `composition-final-390.png`,
`composition-tablet-filled-dates.png`, and `composition-long-320.png`.
Earlier experiments remain evidence of diagnosis, not the final design.
The authorized typechecked local demo function update succeeded with its 55
historical records intact. Eight comment tests, 32 audit tests, and four
engagement tests pass. Backend and web typechecks pass; web lint passes with the same 21 existing
warnings, and the Turbopack production build passes. The final live browser
console has no errors. Native device behavior and owner visual approval remain
outstanding; no remote push or production update was performed.

## Follow-up primitive and readability review

The follow-up fixes the owners of the defects rather than compensating in the
audit page. Current Fluid Table, Tabs, Tabs Subtle, Accordion, Select, Button,
and Badge rendered examples, Code, API, registry sources, and local adapters
were reviewed. The project remains Radix / new-york; shadcn Calendar and Popover
dry-run/diff were inspected without overwriting the Fluid adaptations.

- The current [Radix Date Picker Basic example](https://ui.shadcn.com/docs/components/radix/date-picker#basic)
  uses an intrinsic-width Popover and `defaultMonth={date}`. Both date-picker
  compositions now follow that geometry and reopen on the selected month.
  DatePicker no longer invents navigation bounds; callers' explicit bounds remain.
  The installed DayPicker API's `autoFocus` replaces deprecated `initialFocus`.
  DateTimePicker uses the standard month-navigation caption: DayPicker's year
  dropdown defaults to ending at the current year, which blocked future events.
- Touch dates previously occupied 32px of a 40px column, offsetting their centers
  by 4px from weekday labels. The audit popup now measures 248px, with matching
  32px columns and date targets. All seven centers match exactly at 320px.
- PopoverContent lacked the `data-slot` expected by Calendar's transparency
  selector. Adding that standard DOM contract lets the raised popup surface
  show through. Its transform origin now correctly reads Radix's CSS variable.
- Calendar caption/dropdown heights used invalid CSS-variable syntax. Valid
  Tailwind v4 syntax and centered grid alignment keep the caption aligned with
  44px touch navigation. Normal, outside, today, and selected colors belong on
  the actual Fluid day button, whose own color otherwise overrides cell inheritance.
  Dashboard's approved Month slot and full-calendar link remain intact.
- TableRow's inherited fixed `wght` axis prevented nested font-weight emphasis.
  The adapter preserves normal/semibold defaults and optical sizing through
  ordinary font weight, so action labels and person names can have their intended
  hierarchy. Record categories use existing compact Badge colors; removals use
  a red tint. Badge text stays foreground-colored, and unknown/long record types
  remain wrapping text. IDs and timestamps remain secondary.
- The selected shared tab reveals itself within its horizontal scroll owner on
  selection and resize without changing focus or vertical scroll. Settled checks
  confirm Audit Log remains visible at 320, 390, 768, 1024, and 1440px.
- Accordion, Tabs, Tabs Subtle, Select, and Table springs honor reduced motion.
  Button press scaling and Popover animation do too; normal spring tokens remain.
- Unfinished quoted search values now identify the missing quote. Four regression
  cases distinguish that error from a missing separator. Live invalid drafts keep
  the applied query and its matching row visible.

Follow-up browser checks cover five widths, settled colors in six themes,
selected-month reopening, popup alignment, Details/focus return, reduced motion,
and the shared dashboard calendar. Theme transitions were allowed to settle;
an earlier intermediate Bubblegum frame was not a token defect. No global theme
tokens were changed. Screenshots are `/tmp/ia-audit-review/final-*.png`, including
`final-custom.png`, `final-details-390.png`, and `calendar-fixed-320.png`.
The clean desktop view is `review-audit-final.png`; the date-time popup is
`final-date-time-390.png`.
The final typography repair is visible in `final-custom.png` and
`final-bubblegum-dark.png`; earlier captures precede that repair.

Web typecheck, lint (21 existing warnings), production build, and all 21 focused
audit tests pass. The authorized local demo function update also passes Convex
typechecking and retains all 55 original records. DateTimePicker creation-form
checks pass selected-month reopening, native keyboard time editing, January 2027
navigation, and Escape focus return. At 390px its 248px popup fits the viewport,
and caption/navigation centers match. The unsaved form was canceled; no event was
created. Native hardware and design-owner approval remain outstanding.

After owner direction, announcement read/unread mutations stop emitting audit
events. Other read-state domains already omitted them. Personal read state,
access checks, old audit entries, and significant-change logging are preserved.
All 25 focused audit/engagement tests pass, including four new regressions for
that behavior and authorization. Backend typecheck and the authorized one-time
local function update pass. The live audit view retains all 55 historic records;
its console has no application errors (two unrelated browser-extension errors
were present).

The earlier main integration includes `origin/main` through `679f7a00`.
Its approved calendar cell-sizing rule replaces the overlapping touch-width
fix described in the initial review below. Other audit and passive-hover changes
are retained. The merged tree passes web/backend typechecks, web lint (21 existing
warnings), production build, and all 407 backend tests across 84 files.
The merged calendar was rechecked at 320px: its grid spans x=20–300, with
32px date buttons and no horizontal overflow. Captures are
`/tmp/ia-audit-review/merged-calendar-320.png` and `merged-audit.png`.

## Primitive decisions

- Reviewed current Fluid examples, Code/API documentation, exact registry source,
  and local adapters for Accordion, Card, Table, Button, Tabs Subtle, and Select.
  Sources: `https://www.fluidfunctionalism.com/docs/accordion`, `/docs/card`,
  `/docs/table`, `/docs/button`, `/docs/tabs-subtle`, `/docs/select`, and matching
  `/r/<component>.json` registry files. A later documentation revisit returned
  403; the previously retrieved examples and registry sources remained available.
- Accordion owns disclosure behavior. Its supported `className` fills the
  available width; a responsive grid composes the existing filter controls.
- Table expresses comparable audit records. Existing responsive visibility
  patterns fold columns into the activity cell. Existing Tabs Subtle panels
  supply the tab/panel relationships; no shared API was introduced.
- Passive CardGroups use their existing local `proximityHover={false}` API.
  Upstream's renamed API was not copied into the local adapter.
- Read local ScrollArea, Sheet, Input, DatePicker, and Calendar adapters, current
  shadcn component documentation, and the calendar registry dry-run/diff. The
  calendar fix belongs in its adapter: Fluid's coarse-pointer icon-button width
  and square aspect forced seven columns beyond the popup. Calendar day buttons
  now fill their column width while retaining 44px touch height.
- Controlled Sheet has no SheetTrigger. Its supported open/close autofocus
  callbacks retain and restore the actual opener. Primitive behavior was not
  reimplemented on the page.

## Browser evidence

Chrome used the authenticated local admin screen and read-only DOM measurements.
Target-specific device emulation verified the actual viewport width. Every
tested width had zero document horizontal overflow.

| Viewport | Filter columns | Approximate field width |
| --- | --- | --- |
| 320px | 1 | 256px |
| 390px | 1 | 326px |
| 768px | 2 | 340px |
| 1024px | 3 | 277px |
| 1440px | 5 | 243px |

The local screen verified disclosure resizing, search with no matches, source,
action, person and record-ID filters, clearing filters, detail loading, original
data, Escape dismissal, focus return, and mobile Select/calendar bounds. At
320px the calendar grid ends at x=300 inside a 304px popup, with all seven
columns visible. Reports' passive CardGroups had no hover highlight layer.

A temporary route composed the actual UI components with synthetic records and
local state. It exercised Unicode and unbroken long content, automatic/deleted
actors, complete detail data, empty/sparse pages, loading, loading more,
pagination completion, valid and invalid query drafts, and all six themes
(light, dark, high contrast, bubblegum, bubblegum dark, custom). Reduced-motion
emulation was also checked for detail layout and focus. The temporary source
route was removed before the production build. The original custom theme and
normal viewport were restored.

Screenshots and the disposable fixture copy are in `/tmp/ia-audit-review/`:
`after-filters.png`, `after-desktop.png`, `filters-<width>.png`,
`calendar-320.png`, `long-detail-320.png`, and `theme-<theme>.png`.
These temporary artifacts are local review evidence, not tracked project assets.

## Checks and limits

- `direnv exec . bun run --filter web typecheck`: passed.
- `direnv exec . bun run --filter web lint`: passed with 21 existing warnings.
- `direnv exec . bun run --filter web build`: passed with Turbopack.
- `direnv exec . bun run --filter cvx test src/audit/events.test.ts`: 17 passed,
  including complete 620-record pagination, sparse batches, date boundaries,
  advanced query errors, and authorization gates. These tests run offline.
- After explicit owner authorization, a one-time typechecked function push
  updated the existing local demo at `127.0.0.1:3210` (`anonymous-agent`). No reset,
  seed, or stored-record mutation was performed. The 55 original audit events
  remain. Live checks pass General (55), Flex & Events (0), inclusive October 17
  dates (16), and `action:"comment added"` (1). Invalid query drafts preserve the
  last applied result. Details resolve the related announcement title.
- The primary checkout's stale watcher was stopped; web runs alone on port 3000.
  The demo backend uses the state stored in the `merge-pr147` worktree, distinct
  from the primary checkout's local selection. Do not start a second schema
  watcher using that primary selection.
- Browser emulation does not establish native-device behavior, every possible
  dataset, or design approval. Main is merged locally and the authorized local function update is complete.
  No remote branch push or production deployment was performed.
