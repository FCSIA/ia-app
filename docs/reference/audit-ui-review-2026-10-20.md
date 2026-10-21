# Audit UI review — October 20, 2026

The primary checkout is on `codex/admin-audit-log-ux`. This is diagnostic
verification, with material visual changes awaiting the design owner's review.

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
