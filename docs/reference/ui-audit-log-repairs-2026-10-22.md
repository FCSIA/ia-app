# Admin audit log repair ledger — October 22, 2026

Scope: [page 18 findings](../../ui-audit-2026-10-22/pages/18-admin-audit-log/findings.md)
and [boards](../../ui-audit-2026-10-22/pages/18-admin-audit-log/boards.md).
The owner approved the proposed primitive/API and layout work with “do as the
plan says.” This ledger describes implemented behavior and remaining requirements;
agent browser review does not constitute design-owner approval.

## Finding status

| Finding | Implemented | Remaining / limitation |
| --- | --- | --- |
| F1 stacked tabs | Removed audit category tabs and admin horizontal tabs. Grouped sidebar, intermediate rail, small-screen section picker; route segments and legacy query links work. | Legacy `?tab=` links are supported rather than redirected. |
| F2 categories | Six shared semantic domains, stored on new events; category/action multi-select with URL state, OR within each dimension. Facet counts use aggregates after readiness. | Historical category/index backfill has not been run. |
| F3 controls | Uses approved Button/SearchInput/Input/DatePicker/Select adapters and shared sizing fixes from the parent slice. | Material visual review remains with the owner. |
| F4 separators | Shared Table body separators use `border-border/60`; hover suppression remains primitive-owned. | New separators were visually checked in the light fixture; contrast across all themes was not measured. |
| F5 counts | Exact aggregate counts for actor/category/date; loaded count before historical readiness. Complex predicates explicitly show candidate events in range. | No true exact action/type/record/source/text total or scanned-progress count; those require extra index dimensions/search or a full scan. Fixture counts are synthetic and do not certify backend totals. |
| F6 density | Desktop body rows measured 37px including border, with separate one-line Person/Action/Record/Where. Coarse-pointer table geometry is 44px plus border. | Exact audit column widths differ from the proposal; Where hides at narrower widths instead of merging into Record. Dedicated Details button remains keyboard accessible in its own narrow column. |
| F7 ID titles | Record title uses body preview, saved/current title and readable fallback. Raw IDs stay in Technical details and exact-filter controls. | Historical records without title/preview cannot recover their original contents. |
| F8 people | Shared click/tap PersonTrigger, preview, full profile, Copy ID, Open in Users; actor filter in rows and Details. Custom trigger slot supports chat/avatar reuse; current-user context is passed to profile content/dialog. | No per-person count in popover, target-person conversion throughout Details, or Remove filter toggle; current actor action always sets the filter. Default table trigger has no added avatar. |
| F9 filter placement | Co-located header popovers and mobile Drawer; one main query field with Command suggestions, keyboard selection, syntax-help popover; category/action checklists. Label truncation is fixed inside CheckboxItem. | No Last hour/Today/7/30-day preset set in When; source remains existing Select rather than a segmented control. Actions filter by selected categories but do not use expandable category groups. |
| F10 state | One applied URL model. Typed fields replace matching explicit filters and explicit fields remove matching typed terms. Invalid drafts preserve last valid applied query/results. Header survives empty results; chips clear individual values. | Free text with a contradictory independently selected category may intentionally produce no results. |
| F11 links | Backend live-checked primary/context links, deleted primary href omitted; message jump parameter supported by chat slice; exact Users target now works for staff accounts and invalid IDs fail safely. | User targets in Details are links rather than shared PersonTrigger previews. Some routes link to the parent domain where no more specific destination exists. |
| F12 rows | Whole non-control row opens Details; selected state and separate keyboard Details button; nested links/buttons do not trigger row opening. | Details chevron is persistently visible rather than hover-only. |
| F13 loading | Header plus skeleton body on first load, opt-in previous results during refresh, Updating status, `aria-busy`, identity scope reset; load-more disabled while stale. | No 60% dim or 2px progress bar; toolbar/header are not pinned in the existing admin scroll panel. |
| F14 Details | Action headline, record title, actor preview, local timestamp, related links, message before/after fields, useful action-specific metadata allowlist. Unknown metadata/IDs stay collapsed in Technical details; whiteboard snapshot kept. Empty metadata headings removed. | Not every domain has a bespoke rich card; preview duplication can remain for some record types. |
| F15 integrity | Single required-actor writer across all domain inserts; explicit system provenance, impersonation administrator retained; historical missing human actors labelled Unknown (not recorded). Static writer guard and attribution tests. Bounded recovery for retained CLUB_JOINED actor. | Backfill not invoked; unrecoverable historical approval/import actors remain unknown. No deployment changed. |
| F16 time | One-line `h:mm a`, Today/Yesterday/day group rows, full local timestamp with seconds in title and Details. | Group rows and header are not sticky; explicit timezone text/Tooltip primitive remains absent. |
| F17 outcome color | Shared neutral icons for all six categories; destructive emphasis comes from action registry, no per-type colored pills. | None beyond owner/theme review. |
| F18 phone | Existing two-line interactive Card anatomy, admin section picker, one-row search/help/filter controls; bottom Drawer with scrollable body and pinned Show events footer. Measured 72.25px items at 390×844; no document overflow (382px scroll width in 390px viewport). | Proposal's 56px/at-least-ten-visible target is not met; fixture showed nine visible items, with the ninth partially visible. Preserved approved Card geometry rather than page overrides. Actual authenticated app shell may leave fewer visible. |
| F19 persistence | Canonical `/admin/audit`, `audit_` parameters, sharedable reloadable multi-filters, admin navigation preserves params; legacy `/admin?tab=audit` still works. | Selected Details event is local, not a URL parameter. |
| F20 queries | Indexed exact actor/type/record/action/date and readiness-gated category paths; merged OR streams before filtering/pagination, memoized hydration and bounded read budget; static options independent of recent history. | Sparse text predicates can hit budget before filling a page. No `scanned` progress metric. Legacy bounded `list` remains post-hydration filtered for its existing consumers. |
| F21 vocabulary | Typed registry covers 125 known actions, consistent full readable labels in table/filter/Details, shared category/destructive mapping; test guards literal logged action vocabulary. | Unknown future/dynamic codes use readable fallback; no code migration. |

The table intentionally marks F5, F6, F8, F9, F11–F14, F16, F18 and F20 as
partially implemented relative to every detail of the approved specification.
They must not be reported as fully closed. The parent requested a finite final
integration after the Users deep-link fix, so the remaining layout/polish and
index extensions above are recorded instead of silently widening this slice.

## Data rollout

Backend implementation commit: `9f537867` (`audit: centralize provenance and index
history filters`). Exact Users target follow-up: `d9285fb4`.
Schema/generated API is in the parent's `0fd12ca3`. Aggregate dependencies and the
shared lockfile are installed. No deployment, reset, seed, migration invocation,
or remote push was performed.

After separately authorized deployment, invoke
`internal.audit.migrations.backfill` with no cursor once. It processes 100 rows
per transaction and schedules subsequent pages. Reinvocation is idempotent.
Verify `auditIndexState` key `v1` has `ready: true` before treating aggregate totals
or category indexes as complete. Before readiness, the API intentionally reports
`total: null` and uses legacy-safe chronological category filtering. Retained
`CLUB_JOINED.meta.userId` is the only omitted actor recovered by this migration;
other missing historical attribution stays unknown.

Both category and actor aggregates are updated in the same transaction as the
single logger insert. Category/action/type aliases merge before pagination and
are deduplicated; exact filters run before context hydration when possible.
Complex text counts are deliberately not claimed exact: the aggregates contain
category/actor/time dimensions, and calculating a true total for arbitrary text
would otherwise require scanning the complete selected history.

## Verification

Commands run through `direnv exec .` on the final owned changes:

- `bun run --filter cvx test src/audit/events.test.ts`: 39/39 pass.
- `bun run --filter cvx typecheck`: pass.
- `bun run --filter web typecheck`: pass.
- `bun run --filter web lint`: pass, 0 errors and 19 existing warnings.
- Owned-file `git diff --check`: pass.

The parent previously reported a combined 475/475 backend suite and production
build success before the last finite follow-ups. The parent owns final combined
suite/build verification after integration; those later results supersede this
snapshot. Tests cover staff/unauthenticated/student read gates, static writer
and vocabulary guards, exact safe person lookup, actor/system/unknown handling,
impersonation, indexed history beyond a page, historical type aliases, multi
category/action cursor uniqueness/order, readiness-gated counts and idempotent
backfill, context links, and meaningful metadata presentation.

## Browser diagnostics and limits

A temporary local static fixture compiled the actual AuditTab, admin shell,
shared primitives, global CSS and hook against mocked Convex/navigation/auth.
It used 18 synthetic records spanning six domains, long names/titles, deleted
records, missing actors, and a 500ms refresh delay. No authenticated backend data
was read or mutated. The fixture server was stopped after review, browser viewport
reset, and the agent-created tab closed.

Observed:

- Desktop rows remain one line and 37px tall, including border.
- Multi-category and multi-action checks update comma-separated URL parameters,
  remain checked, produce chips, and filter rows; Escape returns to the header
  filter control. Backend tests certify the OR/AND and pagination semantics.
- Typed `action:` suggestions support ArrowDown/Enter and canonical quoted terms;
  incomplete quotes preserve the previous applied URL/results with inline error.
- Profile actions and row links work independently of row selection; Escape and
  Details close restore focus. Deleted primary links are absent.
- 390px layout uses a section picker and two-line Cards, with no document overflow.
  The mobile filter footer remained inside the viewport (Show events top731,
  bottom775 at 844px height); filters do not push the activity list down.
- Final message Details show related links and collapsed Technical details without
  an empty Recorded information heading. Closing returns focus to its Card.
- Final fixture console had no error entries.

Final captures (local temporary evidence):
`/tmp/ia-audit-log-repairs/desktop-final.png`,
`mobile390-final.png`, `mobile-filters-final.png`, and `details-final.png`.
Earlier captures in that directory predate the final two-line Card and
multi-select changes. The fixture's count mock supplies synthetic denominators;
aggregate correctness is established by backend tests, not those screenshots.

Actual authenticated route integration, complete theme/contrast matrix,
reduced-motion pass, coarse-pointer/native device checks, and design-owner visual
approval remain outstanding. The shared query wrapper's opt-in keeps default
pagination consumers unchanged; retained audit rows are scoped by user identity.
