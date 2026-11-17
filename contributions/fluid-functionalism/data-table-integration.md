# DataTable integration and upstream proposal

The November 9 registry install uses the project's Radix flavor, Tailwind v4,
`@/` alias and the app’s existing Work Sans variable font. Shared Fluid
dependency updates are retained.
No issue, message or PR has been sent upstream.

## What is installed

DataTable starts from the published registry source, extended with the explicit
composition API documented below. It also removes one ESLint suppression for `react-hooks/incompatible-library`:
the project's older ESLint plugin does not define that rule. The existing
`"use no memo"` directives remain. See `data-table-installed.diff` for the entire
difference. Default search/header anatomy remains unchanged; the new explicit
controls boundary accounts for body-cell padding.

Audit, users, feedback, moderation, analytics table views and CSV previews use
`useDataTable`, stable record IDs and column definitions with real accessors.
`AdminDataTable` is the documented search / columns / table / pagination
composition; it receives a table instance and owns no feature data or state.
Audit uses its existing server search, query syntax, date/person/action/record
filters and detail sheet. Desktop filter menus remain beside their headers;
the phone drawer remains phone-only. Audit keeps the backend's newest-first
order rather than presenting a sort of one fetched subset as a global sort.

Users keep server cursor paging and selection keyed by user IDs. The custom
footer remains an explicit product cursor footer; no TanStack methods are
replaced. Audit uses native pages over explicitly labeled loaded records and
an explicit Load older activity action. CSV and analytics use client paging,
sorting and filtering. Feedback and moderation retain their existing product
search predicates, queue/status actions, dialogs and pending states.

## Font integration

Work Sans remains the shared app font, including tables, portalled menus and
Wrapped. The initial integration unnecessarily changed the sans token to Inter
while explicit Work Sans callsites and the Pages router retained Work Sans.
That mixed-family change is corrected. App Router loads the font variable on
`html`; Pages Router sets the same variable globally using Next's documented
`style.fontFamily` API so body portals inherit it too. Work Sans supplies the
variable weight axis used by Fluid's weight animations; these animations do not
require replacing the app's font family.

## Why hover and selection radii differed

Fluid's rounded shape uses the `rounded-lg` class for hover and numeric `8` for
animated selections. This app had remapped `--radius-lg` to its legacy
`--radius: 1rem`: hover became 16px while selection stayed 8px. The header's
pressed layer uses that same named class, so changing only the hover component
would have left another mismatch. The app's shared Tailwind radius ladder now
uses 4/6/8px for sm/md/lg, matching Fluid. No component-specific radius override
is needed. A regression compiles the actual app CSS and compares hover and
pressed radii with Fluid's numeric selection radius.

Other narrow dependency adaptations: full-color references in Button, Badge
and Switch use the app's existing `--color-*` bridge to HSL theme channels;
DropdownContent forwards Radix `onCloseAutoFocus`, preserving focus handoff to
composers and the custom date-range popup. Existing adapted Dialog, DatePicker,
Calendar, CommandMenu, ScrollArea and Tabs contracts remain in place.

## Implemented general composition API

The filter-specific proposal is superseded by the implemented compound header,
search input and controls boundaries. Audit autocomplete is restored. Stable
feature providers keep header and user-action renderers mounted across state
changes, preserving open multi-select controls. See [the upstream design packet](data-table-composition.md)
for the complete API, examples, ownership rules, tradeoffs and validation limits.
`data-table-installed.diff` now records the entire implemented source delta.
