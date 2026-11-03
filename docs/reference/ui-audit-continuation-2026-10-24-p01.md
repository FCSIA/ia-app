# Dashboard edit-mode continuation

This continues the original p01 agent, including the owner's round-2 markup 4.
The implementation is diagnostic work for design-owner review, not design approval.

## Original instructions and scope

Read the full continuation primer, fix instructions, owner-round-2 notes,
human prompts, original visible p01 transcript, relevant original tool records,
and `reports/verify/p01.md` in `/tmp/ia-claude-continuation/`. Original agent:
`agent-a780cef6ed05d89bd`. Private reasoning was excluded.

The owner requested evenly spaced Reset/Cancel/Save controls, an X for Cancel,
an accent edit bar without global search or the user chip, and removal of
overlapping drag pills and redundant dashed outlines. The original screenshot
`ui-audit-2026-10-22/owner-examples/round-2/4-dashboard-edit-mode.webp` was
inspected directly. Its nested outlines, mismatched wrapper corners, and
floating control pills compete with the panel headings and content. The parent
owns the separate Unread empty-space/count follow-up and shared Panel changes.

The user explicitly reattached the video transcript at
`/Users/sreysus/.codex/attachments/06b1b43e-5244-4d4d-9f5a-2d08ba168cca/Pasted text.txt`.
It was read in full. The implementation keeps independent native action targets,
actual draft cancellation and actual Reset Undo. It adds no gesture timers,
custom drag engine, fake undo, delayed feedback, or automatic persistence.

## Supported composition

- Dashboard opts into an app-owned `headerMode="editing"` composition. The header
  uses the existing primary token for its mode surface, hides search and the user
  chip, and retains the official Sidebar trigger. The optional push notice is
  hidden while editing. Other routes retain the default header.
- Existing Button `sm` and `icon-compact` sizes own control and icon geometry.
  Reset, X Cancel, and Save share one spacing value. Add is secondary; Save is
  primary and uses the supported loading state. The mobile Add label remains
  visible.
- Drag and remove controls stay in normal layout above their widget. The panel
  owns its own shape and surface. Populated columns and widgets no longer draw
  extra edit outlines; the drag overlay no longer imposes another radius/ring.
  Only an actually empty column uses the established `Empty frame="dashed"`
  composition and a drop instruction.
- The existing scroll to a newly added widget remains. The obsolete outline-color
  flash was removed with the extra outline. No new animation was introduced.
- Existing dnd-kit sensors, keyboard coordinates, pointer-header dragging,
  drag cancellation, announcements, draft snapshot, Reset Undo, balance Undo,
  explicit Save mutation, failure-preserves-draft behavior, and Escape guards
  remain the behavior owners.
- Live QA exposed a nested Escape conflict: dismissing Add widget also exited
  dashboard editing. The dashboard listener now respects `event.defaultPrevented`
  as well as the existing picker/drag guards, so Radix and the keyboard drag
  sensor retain their own Escape dismissal. Actual dashboard exit restores
  focus through the Customize button ref after it remounts. This is feature
  focus management, without intercepting Dialog dismissal.

No primitive implementation or shared primitive API changed. AppShell's optional
mode prop is a feature-composition choice. Concurrent Social/navigation props
are preserved and are not part of this slice.

## Primitive research

Project context remains Radix, new-york, Lucide, Tailwind v4 and Next.js 16.
Read current repository UI workflow/compatibility guidance, `.impeccable.md`,
frontend-design, shadcn, React best practices, critique, local Button/Dialog/Card,
Panel and AppShell implementations, and the installed Next.js client-component
guide. No dashboard feature document exists in this checkout.

Consulted current official [Fluid Button](https://www.fluidfunctionalism.com/docs/button),
[Dialog](https://www.fluidfunctionalism.com/docs/dialog), and
[Card](https://www.fluidfunctionalism.com/docs/card) examples/API pages. The CLI
returned exact current Radix registry sources through
`shadcn view @fluid/button @fluid/dialog @fluid/card`, saved at
`/tmp/ia-claude-continuation/p01-fluid-current.json`; these sources were compared
with local adapters. The supported Button loading/icon APIs and Dialog trigger
composition were retained. No registry update was applied.

`shadcn docs button dialog card tooltip` returned configured Radix references.
Read the official [Radix Button](https://ui.shadcn.com/docs/components/radix/button)
and [Dialog](https://ui.shadcn.com/docs/components/radix/dialog) usage. Fluid's
current API and exact registry take priority over generic shadcn Button styling.
This child cannot control CUA; separate rendered/Code-tab inspection and live
interaction evidence are coordinated through the parent.
The parent inspected current Button rendered/Code/API and Dialog's rendered
Basic example and Code tab, including opening and dismissing the live dialog.

## Checks and visual loop

The user's explicit instruction is that **every screenshot or photo begins a new
holistic critique loop**: inspect hierarchy, spacing, alignment, density, sizes,
interaction targets, consistency and the full surrounding composition; identify
issues, make only supported fixes, recapture, then critique again. A screenshot
alone never establishes a pass or design approval.

- `direnv exec . bun run --filter web typecheck` passed.
- Scoped ESLint on DashboardLayout, dashboard page, AppShell and AppShellHeader
  passed with zero warnings.
- Full `direnv exec . bun run --filter web lint` passed with zero errors and
  19 warnings in unrelated feedback/report and existing UI adapter files.
- `git diff --check` passed.
- Parent CUA capture `p01-edit-1440.png` in
  `/tmp/ia-ui-continuation-2026-10-24/` was inspected directly. Fresh holistic
  critique: the accent bar clearly separates editing from the content; Save is
  the single primary toolbar action; Add and trailing actions have separate
  layout space; drag/remove targets do not overlap panel edges; the actual
  Panel shapes and headers remain consistent. Empty widgets remain visible
  while editing, which allows removal; their empty content is not another
  nested frame. No new geometric issue called for a primitive override.
  Its live Add/Escape failure led to the focused behavior fix above.
- The fresh `p01-edit-390.png` capture in the same directory was inspected
  directly after that fix. Holistic re-critique: Add/X/Save fit and align with
  the content edges; the accent surface and primary Save distinguish the mode
  without extra explanatory copy; full-width panels keep their own stable
  corners and readable headings; the two widget targets remain separate and
  outside the panel edge. The empty Needs you panel remains removable while
  editing. The metadata in the populated Unread panel wraps within the existing
  row anatomy. No new edit-mode layout issue required another source change.
- Parent CUA retest passed: Add widget → Escape closes only the chooser and
  focuses Add widget; Space → Escape on Drag Needs you announces "Move
  canceled", retains editing and drag-handle focus; remove My clubs → Reset →
  Undo restores that removed-widget draft; X restores the original My clubs
  placement and focuses Customize. Normal Escape at 390 also restores
  Customize. The first Reset Undo toast expired while notes were being read;
  a prompt repeat exercised the actual Undo successfully.
- No Save was clicked and no dashboard preference was written. Pointer-drag
  cancellation, remove-all, saving/failure states and Even out were not
  exercised in this continuation; their preexisting source paths remain.
- Production compilation, native coarse-pointer/device checks, light theme,
  reduced motion and assistive-technology review have not been run for this slice.

Reviewed route: `/dashboard`, desktop 1440 and phone 390. The original marked-up
owner image is the before reference; no new authenticated before capture was
taken before this edit. No new implementation tests mirror this composition-only
change; the live interactions exercise its actual behavior. Material visuals
remain ready for design-owner review, including inspection of native touch,
light theme and reduced motion.

## Additional p04 evidence

After the calendar commit, the parent tested as a student. Required-day
reselection in ScheduleDatePicker retains the selected date, closes the popup,
and restores focus to its trigger. The new
`/tmp/ia-ui-continuation-2026-10-24/p04-student-date-390.png` was inspected directly
and began a fresh holistic critique: the 248px popup fits the phone viewport;
32px numerical targets, weekday alignment and selected/today distinction remain
legible; the popup layer stays clear of the bottom tab bar. Surrounding Schedule
cards retain older nested school-day framing outside the date-adapter slice;
that broader product composition has not been redesigned by this continuation.
Native coarse-pointer interaction is still unverified.
