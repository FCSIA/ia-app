# Web UI Agent Workflow

Use this workflow for every change to `apps/web` that adds, replaces, composes,
or materially restyles an interactive component. It is a required delivery gate,
not optional design advice.

The goal is a primitive-first interface: pages describe product behavior and
layout, shared primitives own interaction, accessibility, geometry, and motion.

## 1. Establish current truth

Run commands through the repository environment:

```bash
direnv exec . pnpm dlx shadcn@latest info --json
```

Then read, in order:

1. `AGENTS.md` and `agent-notes/STATE.md`;
2. `agent-notes/UI_PRIMITIVE_COMPATIBILITY.md`;
3. the smallest relevant product/design document;
4. the local primitive source and every call site that will change.

Do not infer the library base, installed version, or component API from memory.

## 2. Review the real component before choosing it

Before selecting any web component, search the current Fluid component index to
determine whether Fluid covers the behavior. For every relevant Fluid candidate,
explicitly inspect its current page on
[fluidfunctionalism.com/docs](https://www.fluidfunctionalism.com/docs):

- interact with the rendered example;
- read the usage guidance and API;
- open and read the Code example;
- compare that code with the exact registry source and the local copy.

For shadcn, select this project's configured **Radix** base in the current docs,
then use `docs`, `add --dry-run`, and `add --diff`. Never paste the default Base
UI example into this project.

If interactive browser access is unavailable, record that limitation and use
the live documentation HTML plus exact registry JSON/source as a temporary
fallback. The task may proceed when the contract is unambiguous, but rendered
visual and interaction QA remains explicitly unverified; do not claim the docs
example was visually inspected.

Record the pages, examples, APIs, and registry files consulted in the handoff.

## 3. Choose by semantics

Motion and appearance do not decide the primitive. Behavior does.

| Need | Use | Do not substitute |
| --- | --- | --- |
| Non-interactive status, category, or compact metadata | `Badge` | Clickable filter chip |
| One or more immediate on/off view filters | shared filter-control API backed by `ToggleGroup` as appropriate | Raw `button[aria-pressed]` or a clickable `Badge` |
| One persisted value from a known list | `Select` or `RadioGroup` | Action menu |
| Commands, navigation, or contextual actions | `Dropdown` | Form-value `Select` |
| Large searchable choice set | `Command`/combobox composition | Oversized dropdown menu |
| Switching panels or views | `Tabs` | A data-entry toggle styled to look like tabs |
| A visible value users should copy | `InputCopy` | Bespoke clipboard button |
| Comparable records with meaningful columns | Fluid `Table` | Card rows positioned as a table |
| Flexible rows that navigate or perform a rich action | Fluid `CardGroup` + `Card` | Semantic table |
| Date choice | current shadcn Radix `Calendar` adapter | Hand-styled calendar grid |

Examples in this app:

- schedule period/class/time rows are a `Table`;
- channel and Discover Clubs destinations are a `CardGroup`;
- the club selector is route navigation, so it is a `Dropdown`, not a `Select`;
- lunch period is persisted single-choice data, not a tab panel;
- course search is a searchable command/combobox, not a menu.

When a component sits between categories, write down what activating it changes,
whether the value is submitted/persisted, whether it navigates, and whether its
items are actions. Resolve semantics before styling.

## 4. Preserve Fluid motion contracts

"Buttery smooth hover" means one measured, animated highlight moves between
registered items. It does **not** mean every row has an independent
`hover:bg-*` transition.

- `CardGroup` must receive direct `Card` children, or an intermediate component
  must accept the injected `index` and forward it to its `Card`.
- Fluid table body rows must receive stable numeric indices so they register
  their geometry with the table highlight.
- Do not wrap a different library's menu items in `CardGroup`; both primitives
  will compete for focus, selection, DOM, and highlight ownership.
- Keep the animated layer and every row in the same positioning/overflow
  context. Inspect ancestor `overflow-hidden` and border radii when outlines or
  separators appear cut off.
- Treat the channel list in `components/clubs/club-workspace.tsx` as the current
  golden reference for `CardGroup` proximity motion.

Test movement from the first item to a non-adjacent item, keyboard focus, the
selected/current row, scroll, and reduced motion. A static screenshot cannot
verify this behavior.

## 5. Classify gaps before changing code

Every problem belongs to one of three classes:

1. **Existing supported composition** — use the documented primitive and its
   public API.
2. **Shared contract defect** — the primitive exists, but its local adapter,
   DOM assumptions, or API is wrong. Repair `components/ui` in a coherent,
   separately reviewable slice, then remove call-site workarounds.
3. **Missing product capability** — the primitive cannot represent the needed
   semantics or anatomy. Stop and propose a shared API before implementation.

For class 3, provide the user/designer with:

- behavior and semantic role;
- proposed component API and composition;
- required rest, hover, focus, pressed, selected/current, disabled, loading, and
  reduced-motion states;
- keyboard and screen-reader behavior;
- density/responsive constraints;
- affected call sites and migration plan.

Do not hide a missing capability behind arbitrary children, nested incompatible
primitives, page-level radius/overflow patches, or copied custom chips.

## 6. Stop and escalate when

- a design asks for interaction from a non-interactive primitive such as
  `Badge`;
- the current primitive lacks the required semantic role, row anatomy,
  navigation composition, orientation, or motion axis;
- a fix requires changing a shared primitive's public API or visual language;
- page Tailwind overrides are compensating for primitive-owned icon size,
  padding, radius, clipping, focus, or open-state behavior;
- the local component materially differs from the current registry and the
  migration impact is not yet understood;
- two headless component systems would own focus/selection for the same UI.

An escalation is a successful outcome when it prevents architectural debt.

## 7. Implementation boundaries

- Page code owns feature layout, content, and product state.
- Shared UI code owns roles, keyboard behavior, state attributes, icon geometry,
  density variants, focus treatment, overflow behavior, and reusable motion.
- Use primitive icon/leading-media APIs. Do not size a primitive-owned icon from
  the page unless that API explicitly delegates sizing.
- Keep badges short, non-interactive, and non-wrapping. Move secondary metadata
  to a compact trailing region or progressive disclosure instead of creating a
  wall of pills.
- Favor readable density. Remove nested padding and redundant headings before
  shrinking text or interaction targets.

## 8. Required verification and handoff

Run the narrowest checks first, then:

```bash
direnv exec . pnpm --filter web exec tsc --noEmit
direnv exec . pnpm --filter web lint
direnv exec . pnpm --filter web build
```

Visually exercise, at minimum:

- rest, hover movement, focus-visible, pressed/open, selected/current, disabled,
  loading, and reduced-motion states;
- mouse and keyboard operation;
- narrow and wide layouts;
- light and dark themes;
- long labels and an empty/loading list.

The handoff must include:

1. the semantic choice and rejected alternatives;
2. Fluid/shadcn docs, Code examples, APIs, and registry source consulted;
3. whether the change used an existing composition, fixed a shared contract, or
   introduced an approved capability;
4. checks and interaction states exercised;
5. any unavailable visual/browser QA, with no implied signoff.
