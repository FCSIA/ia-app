# Web UI Workflow

This workflow applies to every change that adds, replaces, composes, or
materially restyles `apps/web` UI.

The design owner decides whether an interface is good. Agents research,
diagnose, implement approved direction, and expose decisions for review. Agent
visual inspection never substitutes for human design approval.

## Before coding

1. Read `.impeccable.md`, the relevant product document, and the affected local
   source.
2. Search the current Fluid component index before choosing any component, even
   when shadcn or a local composition initially seems likely.
3. For every relevant Fluid candidate, inspect its live rendered example, Code
   example, API, exact registry source, and local adapter.
4. Confirm this project's shadcn base with:

   ```bash
   bunx shadcn@latest info --json
   ```

5. For shadcn components, use the current **Radix** documentation and compare
   `add --dry-run` and `add --diff` before changing an installed component.

Do not infer a current component contract from memory. If browser access is
unavailable, source and API analysis may continue, but the visible result
remains awaiting human review.

## Choose by semantics

Appearance and motion do not decide the primitive. Behavior does.

| Need | Use | Do not substitute |
| --- | --- | --- |
| Status, category, or compact metadata | `Badge` | Interactive filter |
| Immediate on/off filters | Approved shared toggle/filter control | Raw pressed button or clickable Badge |
| One persisted value from known choices | `Select` or `RadioGroup` | Action menu |
| Commands, navigation, or contextual actions | `Dropdown` | Form-value Select |
| Large searchable choice set | `Command`/combobox composition | Oversized dropdown |
| Revealing inline content beside an independent control | `Collapsible` with a separate trigger | Popup menu or a trigger wrapping the other control |
| Switching panels or views | `Tabs` | Data-entry toggle |
| Visible value users should copy | `InputCopy` | Bespoke copy button |
| Comparable records with meaningful columns | Fluid `Table` | Card rows posed as a table |
| Flexible navigation or rich-action rows | Fluid `CardGroup` + `Card` | Semantic table |
| Date choice | Current shadcn Radix `Calendar` adapter | Hand-styled calendar grid |

When a choice is ambiguous, state what activation does: submit or persist a
value, navigate, switch content, or execute an action. Resolve that distinction
before styling.

Current app references:

- schedule period/class/time rows use `Table`;
- channels and club-discovery destinations use `CardGroup`;
- the club selector is navigation and therefore a `Dropdown`;
- lunch period is persisted data, not a tab panel;
- course search is a searchable command composition.

## Classify the change

Every component change is one of these:

1. **Supported composition** — use the documented public API.
2. **Shared contract defect** — the adapter exists but no longer matches its
   documented DOM, accessibility, geometry, or behavior. Repair the narrowest
   shared boundary without changing its approved visual language.
3. **Design or API gap** — the primitive cannot express the required semantics,
   anatomy, motion, or visual direction. Stop before implementation and ask the
   design owner.

Do not turn a class 3 gap into page-level Tailwind, nested incompatible
primitives, arbitrary children, or a copied one-off component.

Use this decision request:

```text
Behavior and semantic role:
Existing primitive considered:
Documented limitation:
Affected surfaces:
Options and tradeoffs:
Recommended shared API or design direction:
States requiring design review:
```

## Composition contracts

- Page code owns product state, content, and feature layout.
- Shared UI code owns semantic roles, keyboard behavior, state attributes,
  icon geometry, reusable density, focus treatment, and motion.
- Primitive-owned icon, padding, radius, clipping, and focus defects belong in
  the primitive, not the page.
- Badges remain short, non-interactive, and non-wrapping. Put secondary metadata
  in a trailing region or progressive disclosure instead of a wall of pills.
- Remove redundant wrappers and padding before shrinking type or interaction
  targets.

For Fluid proximity motion, one measured highlight moves between registered
items; independent `hover:bg-*` fades are not equivalent.

- `CardGroup` needs direct `Card` children, or a wrapper that forwards its
  injected `index` to the nested `Card`.
- Fluid table body rows need stable numeric indices.
- Do not wrap another library's menu items in a Fluid proximity group.
- Inspect positioning, overflow, and radius ancestors when highlights, borders,
  separators, or focus rings clip.
- The channel list in `components/clubs/club-workspace.tsx` is the approved
  `CardGroup` motion reference.

## Verification and human handoff

Run relevant code checks through `direnv exec .`. These prove code health, not
design quality.

For material UI changes, give the design owner:

- the affected route or component;
- the chosen primitive and rejected alternatives;
- the Fluid/shadcn pages, examples, APIs, and registry source consulted;
- the approved pattern used, contract defect repaired, or unresolved design
  decision;
- a runnable route and before/after captures when available;
- the states that need inspection, including hover, focus, open, selected,
  disabled, loading, narrow layout, theme, and reduced motion;
- any unavailable authenticated or browser review.

Do not conclude that the UI “looks good.” Say whether implementation is ready
for human visual review or blocked on a design decision.
