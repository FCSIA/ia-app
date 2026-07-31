---
tags: [mobile, frontend, design-system, audit]
---

# Mobile UI foundations

The mobile app started with useful shared colors, type roles, safe-area
handling, and accessibility labels, but without a strong composition or
density system. Screens routinely assembled their own spacing, rows, controls,
and states with inline style objects. The July 2026 foundation pass established
shared compact composition and behavior APIs while preserving the existing
NativeWind, theme, and routing architecture.

This is an architecture problem before it is a theme problem. Installing a
large themed component library will not, by itself, make the app feel more
intentional.

## Audit snapshot

The July 2026 review of `apps/mobile` found:

- 582 inline `style={{ ... }}` objects across shared UI, feature components,
  and tab screens;
- only 6 shared `Card` call sites, compared with 44 `TextField` call sites and
  46 `PressableScale` call sites;
- 143 explicit `any` annotations or casts, which makes variant-safe reusable
  components harder to enforce;
- only 2 uses of `useWindowDimensions` or `Dimensions`, so most layouts are
  merely width-capped rather than deliberately adapted for phone, landscape,
  and tablet;
- a custom `Sheet` that accepts `snapPoints` but does not implement them, even
  though `@gorhom/bottom-sheet` is already installed;
- broad base primitives with no compact density variants and incomplete
  pressed, selected, unread, focused, disabled, error, and loading state APIs;
- a component gallery, but no state matrix covering every theme, large text,
  reduced motion, long labels, and loading/error/empty cases.

Accessibility work is not absent: the app has safe-area handling, many explicit
labels, generally adequate touch targets, reduced-motion checks in several
animated features, and virtualized chat. Those are foundations to preserve.

## Direction

Keep NativeWind as the styling layer and use it consistently. NativeWind
already supports state variants, responsive styles, media queries, and themes;
it is not itself a component library. The current app installs NativeWind 4 but
mostly bypasses it with screen-local style objects. See the official
[NativeWind overview](https://www.nativewind.dev/docs) and
[state variants](https://www.nativewind.dev/docs/core-concepts/states).

For behavior-heavy primitives, use a small, headless layer:

1. Adopt [rn-primitives](https://rn-primitives.vercel.app/) incrementally for
   behavior the app needs. Collapsible and separator are the first adapters;
   dialog, alert dialog, menu, popover, select, tabs, checkbox, radio, and
   portal remain candidates rather than preinstalled abstractions.
2. Use [React Native Reusables](https://reactnativereusables.com/docs) as a
   source-owned component pattern when it saves work. It is specifically built
   around NativeWind and rn-primitives and follows a shadcn-style ownership
   model rather than imposing a theme.
3. Keep the hand-built sheet API, but implement it with the already-installed
   [Gorhom Bottom Sheet](https://gorhom.dev/react-native-bottom-sheet/) behind a
   local adapter. This is higher value than introducing another UI kit.
4. Consider [Expo UI](https://docs.expo.dev/versions/latest/sdk/ui/) selectively
   for platform-native forms, menus, pickers, and sheets where native behavior
   matters more than identical cross-platform styling. Keep it behind local
   adapters rather than mixing native components throughout feature screens.

Do not start with a wholesale migration to
[Tamagui](https://tamagui.dev/docs/intro/introduction), because it would replace
the existing styling, theme, and provider approach. Do not adopt the current
[gluestack-ui v5 setup](https://gluestack.io/ui/docs/home/getting-started/installation)
while it requires a NativeWind v5 preview path for the recommended
configuration. [React Native Paper](https://reactnativepaper.com/) is mature,
but its Material Design visual language is not a natural match for the compact,
school-centered IA direction.

## Implementation status

The shared foundation layer now includes:

- `densityMetrics` defines compact, default, and comfortable control and row
  measurements. Compact rows retain a 44px interaction envelope.
- `FeedScreen`, `WorkspaceScreen`, and `FormScreen` own task-specific rhythm and
  adapt their width and spacing for narrow and wide viewports.
- `Stack`, `Inline`, `Inset`, `Divider`, `AdaptiveSplit`, and `AdaptivePane`
  provide shared composition without imposing card chrome.
- `CompactList`, `CompactListSectionHeader`, and `CompactListItem` cover
  default, selected, unread, disabled, and destructive states with flat
  separators and optional leading or trailing content.
- `Field` and `CompactSearchField` compose labels, descriptions, validation,
  and compact inputs. `TextField` exposes density and invalid state.
- Local rn-primitives adapters now provide collapsible and separator behavior.
- `Sheet` is backed by Gorhom Bottom Sheet, implements snap points, keyboard and
  Android dismissal behavior, and automatically uses `BottomSheetTextInput`
  for fields rendered inside a sheet.
- The design-system route exercises density, list states, field states,
  collapsible behavior, and separators.
- Clubs and club chat remain the compact visual reference. Club channels are
  single-line, visibility-aware, and intentionally omit descriptions.

Expo UI was not added in this pass. Its platform-hosted API is useful when a
specific flow benefits from native SwiftUI or Jetpack Compose behavior, but it
does not replace the cross-platform primitive layer established here. React
Native Reusables remains a pattern and source reference; adopting its full
component set would duplicate local ownership without solving a current gap.

Device QA also established an important boundary: compact single-line channel
metrics must not be applied mechanically to two-line destinations, content
feeds, forms, or dashboard sections. Dashboard, Discover, Calendar, Profile,
and Settings retain their task-specific layouts until each workflow has a
separately reviewed composition.

## Missing primitives

Build or adopt these in order:

1. **Density tokens:** `compact`, `default`, and `comfortable` row/control
   metrics. Keep the visual control compact while preserving a 44px interaction
   envelope with `hitSlop` where appropriate.
2. **Layout roles:** `WorkspaceScreen`, `FormScreen`, `FeedScreen`, `Stack`,
   `Inline`, `Inset`, and `Divider`. One generic `Screen` should not determine
   the rhythm of every task.
3. **List roles:** `List`, `ListSectionHeader`, and `ListItem` with explicit
   default, pressed, selected, unread, disabled, and destructive states. Icons
   should not automatically sit inside decorative rounded boxes.
4. **Control roles:** compact icon actions, search field, toolbar, segmented
   control, and field groups with label, description, error, and required
   states.
5. **Overlay roles:** one portal/focus/dismissal system for sheets, dialogs,
   menus, popovers, and toasts.
6. **Responsive rules:** define narrow phone, wide phone/landscape, and tablet
   compositions. A maximum width alone is not responsive design.
7. **State verification:** extend the design-system route or add a component
   harness for every theme, Dynamic Type/large text, reduced motion, long
   content, keyboard, loading, empty, offline, permission-denied, and error
   states.

## Product rules

- Density follows the task. Chat, channel lists, schedules, and moderation
  queues should be compact; forms and first-run flows can remain comfortable.
- A compact visual control must still expose a usable touch target.
- Prefer separators, alignment, type weight, and state color over nested cards.
- Use one primary action per surface. Put secondary actions in a toolbar or
  menu instead of adding more pills.
- Descriptions belong where they change a decision. Do not repeat obvious
  labels or show channel descriptions in a scannable channel list.
- Treat selected, unread, permission-limited, and loading states as part of the
  component API, not one-off screen styling.

## Next foundation work

1. Extend the local headless adapters only when a real dialog, menu, popover,
   select, or tab migration needs them.
2. Add device-level state verification for large text, reduced motion,
   keyboard movement, long content, offline, permission-denied, loading, empty,
   and error cases.
3. Migrate remaining screens in coherent workflows, then remove legacy
   primitives only after their call sites reach zero.
4. Continue replacing screen-local layout objects with composition primitives
   where reuse is proven; do not pursue a mechanical repository-wide rewrite.
