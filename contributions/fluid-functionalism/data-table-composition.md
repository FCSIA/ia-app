# DataTable composition proposal for Micka

Implemented locally on November 10, 2026. This supersedes the filter-specific
header proposal. No message or PR has been sent upstream. The exact published
Radix registry was fetched again before implementation; the baseline differed
from our installed copy only by an unsupported ESLint suppression comment.

## Problem and design

Column definitions can already render arbitrary headers and cells. The missing
boundary is preserving Fluid's existing parts while composing additional
behavior around them. A filter-only prop solves one case but leaves the same
problem for help, custom sort menus, commands, switches and search suggestions.

Use React composition as dependency injection: the caller supplies components;
a scoped provider supplies state, actions and metadata. The provider adapts
TanStack. Controls consume the interface rather than reaching into app state.
No service locator, global mutable plugin registry, component cloning, schema of
filter types, second table store or runtime replacement of TanStack methods.

Default callsites continue to work:

```tsx
<DataTableColumnHeader column={column} title="Name" />
<DataTableSearch table={table} />
```

These retain the original native label/input and default DOM anatomy. Opting
into composition makes the children explicit, including the native label:

```tsx
<DataTableColumnHeader column={column} title="Name">
  <DataTableColumnHeaderLabel />
  <DataTableControls>
    <HelpPopover />
    <ColumnFilterMenu column={column} />
    <ExportColumnButton column={column} />
  </DataTableControls>
</DataTableColumnHeader>
```

A function child receives `{ column, title }`, retaining the exact TanStack row
and value types. Ordinary children are preferred when they already have those
dependencies. The controls region is a layout/interaction boundary, not a
button, filter, menu, toolbar role or focus trap. Injected primitives retain
their own semantics, accessible names, focus lifecycle and state.

## Public parts

| Part | Responsibility |
| --- | --- |
| `DataTableColumnHeader` | Column-scoped provider; default label or explicit composed children |
| `DataTableColumnHeaderLabel` | Original icon, label, sort cycle and animation |
| `useDataTableColumnHeader()` | `state: { canSort, sorted }`, `actions: { onSort, setSort }`, `meta: { title, icon }` |
| `DataTableControls` | Layout and event ownership for arbitrary controls; removes duplicated cell padding when placed in body cells |
| `DataTableSearch` | Search state adapter, icon/frame, default input or explicit children; root DOM props/ref |
| `DataTableSearchInput` | Original input anatomy; input ref, ARIA, native input props and composed handlers |
| `useDataTableSearch()` | `state: { value }`, `actions: { setValue, focusFirstRow }`, `meta: { placeholder, size }` |

Hooks throw descriptive errors outside their provider. Providers are scoped to
a single header/search, so nested tables and multiple independent searches do
not share transient state. No generic row data is erased with `any` or a cast
through a generic React context: header context exposes only its behavioral
interface; the render child retains the full typed column when needed.

## Custom sort control

A custom control can consume `useDataTableColumnHeader()` and call
`actions.setSort('asc' | 'desc' | false, multi?)`, or use the fully typed column
from a function child. `canSort` remains authoritative. Clearing removes that
column's sorting; callers decide whether a menu option preserves other sorts.
The native label keeps its original click/Shift-click behavior. Custom
comparators remain TanStack `sortingFn`; remote ordering remains controlled
sorting plus `manualSorting` and a server query that implements it globally.

There is no separate `onCustomSort` state machine. Audit currently intentionally
disables sorting because its server query returns newest-first cursor pages.

## Search decorators and autocomplete

```tsx
<Command shouldFilter={false}>
  <DataTableSearch table={table}>
    <CommandInputSlot asChild value={query}>
      <DataTableSearchInput
        ref={inputRef}
        aria-label="Search activity"
        aria-expanded={suggestionsOpen}
        aria-describedby={error ? 'query-error' : undefined}
      />
    </CommandInputSlot>
  </DataTableSearch>
  <CommandList>{suggestions}</CommandList>
</Command>
```

`query` above must be the same controlled filter value backing the table.
Do not attach a second `onValueChange` that writes it again: the native search
input commits through its provider, and Command observes that value. The input
provider owns value and density; decorators receive the actual input ref and
can add ARIA/events. A consumer `onChange` runs first; preventing default vetoes
the filter update. Accepted changes reset the page to zero. A consumer
`onKeyDown` runs first; preventing default vetoes native row focus. An open
combobox (`aria-expanded="true"`) owns ArrowDown. Otherwise unmodified ArrowDown
retains Fluid's focus-first-row behavior. IME/input behavior stays with the
native input and decorating command primitive.

IA's existing structured query suggestions are restored with these parts:
people, actions, types, loaded record IDs, sources and date examples. Parsing,
server queries, invalid-draft retention and local-date filters remain app code.

## Event ownership is part of the API

A slot without event isolation is unsafe when headers also drag/reorder and
the table also handles spreadsheet selection:

- Header drag ignores resize handles and controls boundaries.
- Alt-arrow reordering ignores controls and resize handles.
- Table keys respect `defaultPrevented` and controls boundaries.
- Those handlers reject targets outside their DOM subtree. React portals bubble
  through the component tree, even though their DOM is outside the table.
- This uses ownership checks rather than blanket `stopPropagation`, so menus,
  ancestor application shortcuts and analytics keep their own events.
- Body row activation also recognizes the controls boundary, including a custom
  control whose semantics are not one of the built-in button/link selectors.

These guards supplement the existing primitive behavior. They do not implement
keyboard handling, focus trapping or selection for injected controls.

## Stable dependencies across all callsites

Do not recreate `ColumnDef.header` or `cell` component functions whenever a
menu option or mutation pending flag changes. `flexRender` treats them as React
component types; changing identity remounts open menus. Memoizing an array with
those changing flags as dependencies does not solve it.

IA audit headers now read live filter state from a feature-scoped provider,
with stable header renderers. User action cells use a stable component and a
feature-scoped actions provider. Mutation/selection updates therefore update
controls without replacing their component type. This is the same dependency
injection principle at the product boundary; feature services never enter Fluid.
Other admin callsites retain native defaults and existing TanStack options.

## Compatibility, tradeoffs and upstream scope

- Additive API: no required migration for the simple examples.
- Explicit children replace the default part; `null` intentionally omits it.
- No filter-specific imports or bundle dependencies are added to DataTable.
- Context consumers rerender on scoped state changes, including through memoized
  table rows. Existing TanStack subscriptions and row memoization remain intact.
- More parts require documentation, but avoid a growing matrix of feature props
  and the complexities of a global, dynamically registered plugin system.
- Default font, radii, row typography, sort animation and search geometry are
  not changed by this extension. Separate integration fixes are documented below.
- Patch currently targets Radix. Base UI uses the same conceptual contracts but
  must be ported and tested in that implementation before upstream release.

## Separate integration repairs

These should not be confused with requirements of the composition API:

- The app's radius aliases had been 16px where Fluid animations used 8px.
- Work Sans remains the product font; changing font families was unnecessary.
  Fluid's documented Inter optical-size behavior has not been certified for
  Work Sans; do not claim identical width/animation metrics between families.
- Menu labels used cap/alphabetic trim inside truncation. The local fix keeps
  normal line boxes to avoid font-dependent descender clipping.
- Switch accepts ReactNode labels so callers with an existing visible label can
  provide a screen-reader-only label without duplicating visible text.
- Resolve and Dismiss are both exposed directly rather than hiding Dismiss in
  a secondary menu. Table controls account for cell padding centrally.

## Validation and remaining review

Focused DOM tests cover default sorting/search/paging, protected selection,
manual pagination, injected control clicks, Alt-arrow ownership, native label
reordering, portalled keyboard events, input ref/ARIA decoration, controlled
filter updates and open-combobox focus ownership. Web typecheck, lint and the production build pass, alongside 43 UI tests.
The exact installed patch passes a reverse-apply check.

Luna completed one independent screenshot review at max reasoning. Its four
findings, current-source follow-up and image-resolution audit limitation are
recorded in [the review handoff](data-table-ui-review.md). These screenshots are
pre-fix evidence, not proof of current rendering. No authenticated browser, screen-reader, touch,
reduced-motion or design-owner approval is implied by DOM tests.

Exact local runtime changes: `data-table-installed.diff`. Original published
source: https://www.fluidfunctionalism.com/r/radix/data-table.json . Current docs:
https://www.fluidfunctionalism.com/docs/data-table .
