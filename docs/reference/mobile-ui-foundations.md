---
tags: [mobile, frontend, design-system, audit]
---

# Mobile UI foundations

The mobile app has useful shared colors, type roles, safe-area handling, and
accessibility labels, but it does not yet have a strong composition or density
system. Screens routinely assemble their own spacing, rows, controls, and
states with inline style objects. The result is consistent at the token level
but repetitive and visually generic: large rounded surfaces, icon-in-a-box
rows, pill controls, 24px section rhythm, and the same title/subtitle/chevron
hierarchy across unrelated tasks.

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

For behavior-heavy primitives, prefer a small, headless layer:

1. Evaluate [rn-primitives](https://rn-primitives.vercel.app/) directly for
   dialog, alert dialog, menu, popover, select, tabs, collapsible, checkbox,
   radio, separator, and portal behavior.
2. Use [React Native Reusables](https://reactnativereusables.com/docs) as a
   source-owned component pattern when it saves work. It is specifically built
   around NativeWind and rn-primitives and follows a shadcn-style ownership
   model rather than imposing a theme.
3. Replace the hand-built sheet implementation with the already-installed
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

## Recommended rollout

1. Use Clubs and club chat as the compact workspace reference implementation.
2. Extract the proven compact header, toolbar, section header, and list-row
   metrics into shared variants.
3. Replace the custom sheet and establish the overlay adapter.
4. Migrate Discover, Calendar, and Dashboard one workflow at a time; avoid a
   repository-wide visual rewrite.
5. Add the state matrix before deleting old primitives, then remove unused
   compatibility paths and barrel-import cycles.
