# Audit UI review — October 20, 2026

The primary checkout is on `codex/admin-audit-log-ux`. This is diagnostic
verification, with material visual changes awaiting the design owner's review.

The subsequent main integration includes `origin/main` through `679f7a00`.
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
