# UI Primitive Compatibility

Read this before adding, updating, composing, or migrating anything under
`apps/web/src/components/ui/`.

## The rule

Treat copied registry components as source code with dependencies on a specific
primitive contract, not as interchangeable styling snippets.

Fluid, shadcn, Radix UI, and Base UI can expose similar component names while
differing in:

- rendered DOM shape and wrapper elements;
- trigger composition (`asChild` for Radix versus `render` for Base UI);
- required companion components and nesting;
- event, focus, portal, and dismissal behavior;
- state and data attributes used by selectors;
- icon ownership, sizing, and wrapper behavior;
- default padding, negative margins, height, and radius assumptions.

Those differences often compile cleanly. The failure appears only in the
rendered UI as wrong spacing, oversized icons, broken focus, or a trigger that
does not open. Do not begin by tweaking page-level Tailwind classes when the
primitive contract may be wrong.

## Registry ownership and updates

`bun run fluid:update` is preview-only unless the caller supplies both `--write`
and an explicit component list. It must never overwrite the whole registry in
one operation.

Components listed as adapted in `scripts/update-fluid-components.mjs` preserve
product-required APIs or DOM contracts. The script blocks automatic writes for
them. Review the current rendered example, Code example, API, registry source,
local source, and all callsites, then merge the upstream change deliberately.
Do not bypass the guard merely to make the local file match the registry.

Registry-managed components may be updated selectively after reviewing the
dry-run. App-owned compositions must use distinct semantic names and filenames;
for example, `InputControl` is the inline addon/action composition, while
Fluid's `InputGroup` remains the animated labeled-field group. Do not create
same-name compatibility exports between the two.

## Concrete failure: `InputGroupButton`

The copied shadcn `InputGroupButton` assumed that its icon was a direct SVG
child. The local Fluid `Button` wraps children and icons in nested spans. A
selector such as `&>svg` therefore matched nothing, leaving Lucide's default
24px SVG inside a 24px tool button. The result looked like a padding problem,
but the control had no breathing room because the icon-sizing contract was
broken.

The correct fix belongs in the primitive adapter:

- use a descendant selector that matches the actual local DOM (`&_svg`);
- define icon size as part of each `InputGroupButton` size variant;
- remove inherited negative button margins that assume upstream shadcn button
  geometry;
- keep call-site padding concerned only with local layout.

This is the model for similar bugs: inspect the rendered contract, then repair
the narrowest shared primitive that owns it.

## Concrete failure: `ResizableHandle` after v4

`react-resizable-panels` v4 renamed the group primitives and removed the old
`data-panel-group-direction` styling hook. Its separator now exposes
`aria-orientation`, but that value describes the separator line: a horizontal
panel group has a **vertical** separator. Treating it as the panel-group
direction makes the handle consume the full width and collapses both panels.

Keep the v4 `Group`/`Panel`/`Separator` adapter explicit, use
`aria-orientation="horizontal"` only for the horizontal separator styling used
by a vertical panel stack, and verify actual panel and handle bounding boxes.
For stable initial sizing, give the group and panels stable IDs and pass a
matching `defaultLayout` map.

## Concrete failure: calendar navigation and day metadata

The shadcn DayPicker adapter depends on `months` remaining positioned relative
so its absolute navigation stays anchored to the month caption. Replacing the
adapter's `classNames.months` value from a page removes that positioning and
can place the previous/next buttons against an outer card or viewport. Use the
adapter's existing width contract; do not replace its structural class names.

The local Fluid `Button` also wraps button content, while upstream shadcn's
calendar expects direct day-button children. `CalendarDayButton` therefore owns
an explicit vertical content slot for the date numeral and optional metadata.
Status content must remain in that slot's normal flow so it cannot overlap the
date.

## Counterexample: actual compounded spacing

Not every oversized primitive is a contract mismatch. The chat mention menu
rendered the DOM its Plate/Ariakit selectors expected, but accumulated spacing
at three nested levels: popup padding, group padding, and item margin/minimum
height. It also carried a fixed width that was unnecessary for names-only rows.

In that case the correct fix was geometry, applied where each layer owned it:

- the shared inline-combobox item owns row height and horizontal inset;
- the group owns only a minimal list-edge inset;
- the mention call site owns its popup width and maximum height.

Inspect first so a real padding problem is not misdiagnosed as a migration bug,
and a contract mismatch is not buried under padding overrides.

## Base UI and Radix are different implementations

The project currently reports `base: radix` from `bunx shadcn@latest info
--json`. New shadcn projects default to Base UI, but shadcn explicitly says
working Radix projects do not need to migrate.

Never paste the default/Base example into this Radix project without switching
the docs tab and registry base. Components such as comboboxes and dropdowns may
need a different component file, companion primitives, trigger API, and content
structure. Replacing an import or changing `asChild` to `render` is not a
complete migration.

When a migration is intentional, migrate one component family at a time and
keep both implementations explicit until every call site is verified. Follow
the project `migrate-radix-to-base` skill and the current official shadcn docs.

References:

- [Base UI as the default](https://ui.shadcn.com/docs/changelog/2026-07-base-ui-default)
- [Base UI combobox](https://ui.shadcn.com/docs/components/base/combobox)
- [Radix UI combobox](https://ui.shadcn.com/docs/components/radix/combobox)

## Required audit workflow

1. Run `bunx shadcn@latest info --json` and record the
   configured base, style, icon library, aliases, and installed components.
2. For each Fluid component, explicitly inspect its current live documentation,
   rendered example, Code example, API, exact registry source, and local copy.
   If browser access is unavailable, record the fallback and leave visual QA
   unverified.
3. Fetch the current shadcn docs for the configured base with `bunx
   shadcn@latest docs <component>`. Compare Base and Radix docs when a migration
   or copied example is involved.
4. Before updating an installed component, use `add --dry-run` and `add --diff`.
   Do not overwrite local Fluid adaptations blindly.
5. Inspect the local dependency primitives and the rendered DOM. Check wrappers,
   direct-child selectors, `data-*` states, trigger props, portals, and focus
   ownership.
6. Verify computed control geometry: outer height, content box, icon size,
   padding, gaps, and any negative margin. Test both resting and open states.
7. Fix a shared contract mismatch in `components/ui`; use page-level classes
   only for layout that is genuinely unique to that page.
8. Typecheck and lint, then diagnostically exercise open/close, hover, focus,
   keyboard, disabled, selected, and narrow-width states. Type safety alone is
   not proof of behavior, and agent inspection is not design approval.

## Direct-child and motion contracts

The design owner approved Card's independent `attention` state for unread
announcements (2026-10-16). Card owns its neutral translucent surface and shape;
the existing Group hover remains visible beneath it. Selection takes precedence
and retains its own semantics. Callers supply an explanation through visible
context and an accessible name; attention never implies `aria-pressed`. Do not
recreate the surface or its corners on feature pages. The stretched focus target
uses the same shape token as the surface and Group hover.

Fluid proximity components register item geometry. A component can render with
no errors while silently losing the shared moving highlight if an index or ref
is swallowed by an intermediate component.

- `CardGroup` should contain direct `Card` children. If a feature wrapper is
  necessary, it must accept the injected numeric `index` and forward it to the
  rendered `Card`.
- Fluid `TableRow` instances in a moving-highlight body need stable numeric
  indices.
- Do not put another library's menu item inside a Fluid proximity group. Choose
  one owner for focus, selection, geometry registration, and animation.
- Inspect positioning and overflow ancestors when a moving highlight, border,
  focus ring, or separator is clipped at rounded corners.

The web channel list in `components/clubs/club-workspace.tsx` is the current
golden reference for `CardGroup` registration and highlight movement. See
`agent-notes/WEB_UI_WORKFLOW.md` for the semantic `Table` versus `CardGroup`
decision and escalation protocol.

## Review questions

- Is this source from the project's configured registry base?
- Does the component render the DOM its selectors expect?
- Does the local `Button`, `Input`, or trigger wrap children differently?
- Is a selector accidentally limited to direct children?
- Are negative margins compensating for upstream geometry we no longer have?
- Does the target base require a different companion component or nesting?
- Would fixing the primitive remove several call-site overrides?

If any answer is uncertain, stop styling the page and inspect the primitive
boundary first.
