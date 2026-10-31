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

## Official Fluid Sidebar and workspace navigation

The human explicitly requested the new official Fluid Sidebar for the main app
navigation and nested workspaces on 2026-10-24. `ui/sidebar.tsx`,
`sidebar-core.tsx`, `sidebar-menu.tsx`, `use-fluid-hover.ts`, and
`fluid-hover-highlight.tsx` come from the current Radix registry. The old unused
shadcn cookie/provider implementation has been replaced. `sidebar` is protected
as an adapted primitive by the Fluid update script.

Keep the official anatomy and behavior as the baseline: Provider, Sidebar,
Header/Content/Footer, Group, Menu/Item/Button/Badge, and Trigger. Main navigation
uses documented `variant="inset"` beside `SidebarInset`; the primitive owns the
8px gutter, shape, elevation and collapsed margin. The main provider uses the
documented click-peek mode: hover-peek opens over the header toggle before it can
be clicked. The edge can still show a temporary preview; the header trigger pins
the sidebar open. The default 16rem width, official off-canvas/resize rail,
active and hover surfaces, roving keyboard focus, and bare `[` shortcut remain
unchanged. Its mobile
breakpoint is the app's existing 1024px tab-bar boundary. The existing mobile tab
bar and More drawer remain the primary phone navigation. Do not recreate an
icon rail, custom menu engine, spacing ladder, or resize/collapse behavior.

`WorkspaceSidebar` is a thin app composition of those official parts. Its
supported `collapsible="none"` mode fills an externally bounded workspace;
header/footer slots and feature children remain supported. Club's existing
resizable layout and swipe-driven phone navigation remain their behavior
owners. Admin's phone header trigger uses the existing Radix Sheet focus and
dismissal lifecycle. Page links use SidebarMenuButton's native Link slot and
`isActive`, so the primitive owns `aria-current`, hover, and keyboard selection.
Club channel trees remain feature children with their own existing persistence,
unread state, and actions. Main navigation's app-owned `pageNavigation` config
composes native MenuSub links under the matching real destination. The same
links appear in mobile More. Schedule's admin sections use this shared anatomy;
Social groups Clubs, Friends and Friend Groups with existing role gates. The
sidebar's Search command opens the existing palette; channel search stays in
its conversation header. Content filters and form modes remain in context.

The main frame lives once in root `Providers`, inside the existing authenticated
boundary and navigation-loading provider. Per-page `AppShell` registers route
configuration through stable actions; its header, banner and children stay
inline under feature providers. Do not move those React nodes into frame state
or portal the page content: Calendar's header relies on route-local context.
The main SidebarProvider/Sidebar/SidebarInset are not keyed by route. Official
`persist` writes collapse preference and root layout restores `sidebar_state`
through the server cookie before initial rendering. Login/logout, password
change and immersive Wrapped keep their shellless composition. Independent
admin/club providers keep their existing boundaries and persistence rules.

Every pane edge has one owner. A standalone sidebar owns its right border;
`bordered={false}` yields it to a resize handle or enclosing Sheet. Club
navigation/thread panes must not draw another border beside their existing
handle. Admin's outer layout is flush to the app header; content padding belongs
to the content pane.

Registry dependency adaptations are deliberately narrow:

- Use the installed `framer-motion` entry point for the same Motion APIs.
- Apply the SidebarInset frame only at or above its provider's mobile
  breakpoint, so a hidden desktop sidebar does not inset mobile content.
- Map the new Sidebar's body/caption/micro classes to the existing local type
  ladder instead of overwriting SizeContext or importing new global tokens.
- Add only the two missing panel icon names to IconContext.
- Merge Tooltip's upstream optional `followCursor` motion-value behavior for
  the resize rail; retain existing grouped warm-up, portals, and themed surface.
  Sidebar's shortcut chip inherits that surface's foreground.
- Import only the required official scroll-fade/divider utilities from the
  ScrollArea registry; use the existing `--color-border` theme bridge. Existing
  global scrollbar styling remains local. Vertical-only Radix ScrollArea makes
  its generated intrinsic table sizer a shrinkable block. Horizontal/both
  scrollers retain intrinsic width. This is the exact containment issue called
  out by official SidebarContent, also reproduced in admin's nested CSV table.

Current Sidebar sources and dependencies were inspected through the shadcn CLI;
its dry-run would create six files and overwrite ten adapters. Do not apply that
wholesale update. Reviewed rendered, Code, and API examples:
[Sidebar](https://www.fluidfunctionalism.com/docs/sidebar),
[Card](https://www.fluidfunctionalism.com/docs/card), and
[Scrollbars](https://www.fluidfunctionalism.com/docs/scrollbars), plus
[Radix Sheet](https://ui.shadcn.com/docs/components/radix/sheet).
Material visual changes still await the design owner; diagnostic screenshots
must be re-critiqued after every capture and are not design approval.

## Official Fluid Calendar and DatePicker

The owner requested the latest official Calendar, DatePicker and CommandMenu
on 2026-10-27. Calendar now uses `@daypicker/react` 10 and the exact current
Fluid registry anatomy. DatePicker uses the Radix registry wrapper and shared
DatePickerCore. The former DayPicker 9 adapter, `CalendarDayButton.meta`, and
bespoke DateTimePicker are removed. Calendar, DatePicker and CommandMenu are
protected adapted components in the selective update script.

CommandMenu shortcut caps render arrow keys with the app's Lucide arrows and
screen-reader labels, as requested by the owner; other shortcut glyphs retain
the registry behavior. Keyboard handling and cap geometry remain unchanged.

Keep native Calendar selection, month navigation/slides, measured hover,
range behavior, focus and ARIA. School calendar status dots use its documented
`dayDetail` callback with accessible descriptions, `fill`, and `cellSize={56}`;
do not replace the DayButton or structural class names. The full agenda/week/
month event calendar remains the feature calendar; Fluid Calendar owns its
Go-to-date chooser, with native autofocus and the published padded popup frame.

Native DatePicker owns date labels, optional clear, time parsing/editing,
quarter-hour slots, responsive segments and popup interaction. `forms/DateField`
and `DateTimeField` are app-owned serialization boundaries for existing local
ISO strings. They use distinct names and do not add a parallel date/time UI.
A required date remains selected when re-clicked; optional clear is explicit.
Time can be drafted before selecting a date. Named groups distinguish multiple
date/time fields for assistive technology.

Registry adaptation is limited to installed `framer-motion`, the current local
type ladder, equivalent ShapeContext values, the required calendar icon,
upstream HoverHighlight's optional `fadeIn`, and official popup/keyboard/omit
helpers. Do not overwrite global size/shape contexts or theme variables to
install a component. Reviewed rendered, Code and API examples:
[Calendar](https://www.fluidfunctionalism.com/docs/calendar),
[DatePicker](https://www.fluidfunctionalism.com/docs/date-picker), and
[CommandMenu](https://www.fluidfunctionalism.com/docs/command-menu), plus exact
`/r/calendar.json`, `/r/date-picker.json` and `/r/command-menu.json` registry items.
See `docs/reference/ui-fluid-calendar-continuation-2026-10-27.md` for evidence.

## Concrete failure: `Toggle` inside `Tooltip`

`Tooltip` renders Radix `Trigger asChild`, which passes its own `data-state`
(`closed`, `delayed-open`, `instant-open`) to the child. Radix `Toggle` spreads
incoming props after its own attributes, so the tooltip's value replaced
`data-state="on"` and every `data-[state=on]:` style silently stopped matching:
the viewer's chat reactions and the announcement editor's B/I/U looked unpressed
while `aria-pressed="true"`. The Toggle adapter therefore styles pressed state
from `aria-pressed` as well as `data-state` (single-select `ToggleGroup` items
expose `aria-checked`, so they still need `data-state`). Callers that restyle a
pressed Toggle must use `aria-pressed:` variants, as `ReactionToggle` does.

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

Select and Dropdown share `popup-shape.ts`: 12px container, 8px item/highlight,
and 10px focus ring at a 4px inset. The trigger can follow the global shape;
the menu must not inherit it. Use fixed values here: the application's
`rounded-lg` resolves to 16px, unlike the registry's expected 8px. Nested popup
portals use the same overlay layer so later inner portals paint above their
parent; changing only the parent's z-index can hide its controls.

Default Light/Dark `border-border` and `bg-border` resolve against the scoped
surface foreground, like hover and active layers. Explicit palette themes use
`--theme-border-color` to preserve Custom Accent, Bubblegum colors, and opaque
high-contrast borders. Keep the web token bridge and app mapping aligned;
`border-input` remains a separate contract.

The design owner approved Card's independent `attention` state for unread
announcements (2026-10-16). Card owns its neutral translucent surface and shape;
the existing Group hover remains visible beneath it. Selection takes precedence
and retains its own semantics. Callers supply an explanation through visible
context and an accessible name; attention never implies `aria-pressed`. Do not
recreate the surface or its corners on feature pages. The stretched focus target
uses the same shape token as the surface and Group hover.

The owner approved `CardGroup corners="compact"` for announcement previews
(2026-10-17). It gives the frame, attention surface, moving hover, and stretched
focus target the same 12px corners without changing buttons or the global shape.
The default continues to follow ShapeContext. Do not substitute feature-level
radius overrides. In a clickable Card, passive footer text and gaps pass through
to the stretched target; semantic controls retain independent pointer targets.

For flush dashboard Panels, the owner approved `CardGroup corners="panel"`.
The Panel supplies an inset radius derived from its shape and its 1px border
plus 4px content inset; CardGroup shares it with hover, focus and persistent
surfaces. The compact contract remains unchanged outside these Panels. Check
single and multiple rows, both shape modes, focus, and narrow widths when
reviewing this geometry. Material visual changes still await owner review.

Solid neutral Badge uses the shared foreground-based active fill and border,
so it remains bounded on an attention surface. Colored and dot badges retain
their existing mappings. Native modal scroll locking must not add a second body
margin when the root already reserves a stable scrollbar gutter; the global
`body[data-scroll-locked]` rule handles that supported-browser case.

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
