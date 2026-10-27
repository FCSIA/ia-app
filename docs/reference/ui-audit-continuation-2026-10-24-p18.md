---
tags: [reference, admin, ui, review]
---

# Users table continuation — p18

This continues the recovered p18 work in `claude/ui-audit-fixes`, including
the owner's round-2 Users screenshot. Earlier audit-log changes are already
committed; this slice finishes the Users density and shared table composition.
The original evidence remains under `ui-audit-2026-10-22/` in the primary
checkout. Agent reports are historical evidence, not independent design approval.

## Implementation

- Reuse `DataTablePanel` and indexed Fluid Table rows rather than introducing
  another table family. Compact cells now follow the local Table's native
  cell padding and coarse-pointer 44px minimum; no forced row-height override.
- Align search and role selection on their existing compact control step.
  Use sentence-case headers and readable compact text.
- Keep toolbar, column headings, and pagination mounted while loading, empty,
  or failed. Render skeleton/error/empty content inside the table.
- Show page/total counts only when they describe the same scope. Search results
  retain the role total, rather than claiming it is a matching-results count.
- Use IT/HS/ENG in narrow pathway columns, retaining full accessible labels
  and native title text. Bound long names and retain their complete title.
- Reveal row actions on hover/focus, keep them visible for coarse pointers,
  and remove blank placeholders for unavailable actions.
- Use AlertDialogTrigger for password-reset and bulk-delete openers, forwarding
  the icon helper's ref and props. Cancel now returns focus through the existing
  Radix lifecycle. No deletion or password reset was executed during review.

The full original video and the newly attached October 24 copy were read. The
relevant guidance is independent action targets, immediate selection feedback,
native cancellation, grouped tooltip warmup, and real recovery. Irreversible
account deletion retains confirmation; no fake Undo or extra timing was added.

## Primitive inspection

Reviewed the current rendered, Code, API, exact registry source and local adapter
for Fluid [Table](https://www.fluidfunctionalism.com/docs/table),
[Select](https://www.fluidfunctionalism.com/docs/select),
[Button](https://www.fluidfunctionalism.com/docs/button), and
[Tooltip](https://www.fluidfunctionalism.com/docs/tooltip). Also reviewed
[Radix Alert Dialog](https://www.radix-ui.com/primitives/docs/components/alert-dialog)
trigger and focus behavior. The app's registry base is Radix/new-york/Lucide.
No registry adapter was overwritten. DataTablePanel remains an app composition;
the shared primitive retains geometry, moving hover, focus and pointer behavior.

## Screenshot critique and interaction checks

Every capture is diagnostic and must be inspected again for spacing, hierarchy,
sizes, consistency, contrast, interaction and responsive states. A screenshot
alone does not establish correctness or human design approval.

The before capture showed 57–64px rows and a 28px search beside a 36px Select.
The first after capture showed 36px rows and 28px controls, with more records
visible and no document overflow. The final primitive-first pass restores native
vertical cell padding; measured rows are now 41px, still denser than the baseline.
Reviewing cancellation then exposed focus
falling to the body; the supported trigger composition repaired that cause.
The repeated Cancel check returned focus to `Delete 1 selected` and preserved
selection. The test then cleared selection.

Authenticated browser checks on the isolated local preview covered page 1
(30/50), page 2 (20/50), Previous, unmatched search, clear-search recovery,
selection, confirmation/cancellation and 390px containment. At 390px the
document remains 390px wide; the data table owns horizontal scrolling. Native
device and coarse-pointer interaction were not simulated by viewport resizing.

Captures: `/tmp/ia-ui-continuation-2026-10-24/p18-before-users-1440.jpg` and
`p18-after-users-1440.jpg`. The latter predates completion of the new main
Sidebar migration. The final combined layout is captured at actual 1440×900 in
`p18-final-users-1440.png`; the same title/count/toolbar alignment and bounded
table remain intact with the labeled navigation.

Scoped ESLint and web TypeScript pass. Final combined typecheck/lint/build and
sidebar integration checks are recorded in the continuation coordination report.
Backend pagination and authorization were not changed. Material visual changes
remain awaiting design-owner review.
