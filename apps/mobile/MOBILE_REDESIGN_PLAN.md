# Mobile Redesign & Polish — Implementation Plan

> Handoff spec for the IA (information architecture) + styling overhaul of `apps/mobile`.
> Two goals: **(1) fix the bloated navigation / "More" junk-drawer layout**, and
> **(2) upgrade styling with motion, a consistent component library, and best-in-class UX.**
>
> This document is prescriptive. Follow the phases in order. Do **not** invent new backend
> queries — every screen already has its Convex data wired; this is a presentation-layer
> refactor only. Read `convex/_generated/ai/guidelines.md` before touching any Convex call.

---

## 0. Current State Audit (why we're doing this)

### 0.1 Navigation is overloaded
- **6 bottom tabs** (`apps/mobile/app/(tabs)/_layout.tsx`): Home, Calendar, Posts, Clubs, Classes, + More. iOS HIG and Material both cap primary nav at **5**. Six is over budget and the labels are inconsistent ("Posts" = announcements, "Classes" = schedule).
- **"More" is a junk drawer** (`apps/mobile/app/(tabs)/more.tsx`): 9 destinations across 3 sections (Inbox / Courses / Events / Flex Friday / Flex Pass / Wrapped / Profile / Theme / Design system). Primary features (Courses, Events, Flex) are buried two taps deep; a **dev-only Design System gallery ships in production nav**; Profile and Theme are settings that don't belong next to content.
- **Heavy redundancy**: Dashboard "Quick Actions" links to Courses/Events/Flex/Flex Pass/Wrapped — the *exact same set* that also lives in More → Explore. Calendar exists as a **tab**, a **dashboard widget**, and overlaps with the **Events** destination. Announcements is a tab **and** a dashboard widget **and** overlaps the Inbox.
- **Inbox is buried** in More despite being a notification hub with an unread badge — it should be reachable from anywhere.
- **`notifications.tsx` does three unrelated jobs** in one very long scroll: push device registration, the inbox list, and notification preferences.

### 0.2 Styling / UX is thin
- **`react-native-reanimated` (~4.2) is installed but unused.** Zero animations anywhere — no entrance transitions, no press physics, no layout animation, no shared skeletons.
- **`expo-haptics` is installed but unused.** No tactile feedback on any action.
- **`@gorhom/bottom-sheet` and `react-native-draggable-flatlist` are installed but unused.** Instead we have inline "expand a card" toggles (`showCreate`) and Up/Down/Hide buttons for reordering.
- **No real component library.** Only `Card`, `Button`, `Badge`, `TextField`, `Empty` exist. Everything else is hand-rolled inline: filter pills in `announcements.tsx`, "On/Off" **Button**s used as switches in `notifications.tsx`, **Button**s used as day/period/source pickers in `schedule.tsx` / `calendar.tsx`, repeated section headers, repeated list rows.
- **`nativewind` is a dependency but nobody uses it** — every file writes verbose inline `style={{ ... }}` objects with magic numbers. Radii appear as 12/14/16/18/999 arbitrarily. `packages/design-tokens` **exports `radii`, `spacing`, `typography` that are never imported.**
- **Feedback is all `Alert.alert`** — jarring blocking native modals for things that should be toasts.
- **Loading = a bare `ActivityIndicator`; empty = plain text.** No skeletons, no illustrated empty states.
- **Date entry is raw text** (`YYYY-MM-DD` / `HH:mm`) in `calendar.tsx`.
- **Type is ad hoc**: `fontWeight: "900"` and hardcoded sizes everywhere, no scale.

---

## 1. Design Principles (apply to every change)

1. **Five tabs, max.** Everything else is reachable via header actions or in-tab segmentation.
2. **One home for each job.** No feature appears as both a tab and a redundant dashboard widget destination that competes with it. The dashboard *summarizes and deep-links*; the tabs *own* the full experience.
3. **Settings live behind the avatar, not in content nav.** Profile, theme, notification preferences, account, sign-out.
4. **Motion is meaningful, never decorative-only.** Entrance = orientation, press = affordance, layout = continuity. Target 60fps; all animation on the UI thread via Reanimated worklets.
5. **Tokens over magic numbers.** All spacing/radii/type comes from a single `theme` module. No raw pixel literals in screens.
6. **Every async action gets feedback** — optimistic UI + haptic + toast, not a blocking Alert (Alerts reserved for destructive confirms only).

---

## 2. Information Architecture Redesign (Goal 1)

### 2.1 New tab bar (5 tabs)

| # | Tab | Route | Owns | Replaces / absorbs |
|---|-----|-------|------|--------------------|
| 1 | **Home** | `(tabs)/dashboard` | Personalized summary + deep links | (unchanged role, simplified) |
| 2 | **Calendar** | `(tabs)/calendar` | Segmented hub: **My Week / Month / Events** | current Calendar tab + **Classes** tab + **Events** destination |
| 3 | **Clubs** | `(tabs)/clubs` | Club list + channels | (unchanged) |
| 4 | **Feed** | `(tabs)/announcements` | Announcements | (unchanged, was "Posts") |
| 5 | **Discover** | `(tabs)/discover` | Browse content: **Courses, Flex Friday (+Pass), Wrapped** | replaces **More** as a *content* tab, not a settings dump |

**Removed from primary nav:** the standalone **Classes** tab, the standalone hidden **notifications** tab entry stays routable but is reached via the header bell, and the **More** tab is deleted.

### 2.2 Global header (new shared component)

Introduce `AppHeader` rendered by tab screens (replaces the per-screen big title inside `Screen`). Layout:

```
[ Avatar ]  Screen Title                        [ 🔔 bell w/ badge ]
            optional subtitle
```

- **Avatar (left)** → pushes `/profile`. Uses new `Avatar` component (image or initials).
- **Bell (right)** → pushes `/notifications` (the **inbox list only** after the split — see 2.4). Shows the same `unreadCount` badge currently on the hidden tab.
- Title/subtitle replace the giant `fontSize: 30` heading block inside `Screen`.

This single move removes **Inbox** and **Profile** from "More" entirely and makes both reachable from every tab.

### 2.3 Where each former "More" item goes

| Former "More" item | New home |
|--------------------|----------|
| Inbox | Header bell (global) → `/notifications` |
| Profile | Header avatar (global) → `/profile` |
| Theme | Inside Profile → "Appearance" row → `/settings/theme` |
| Design system | **Dev-only.** Gate the route behind `__DEV__`; reach it via long-press on the version label in Profile. Remove from all production nav. |
| Courses | **Discover** tab (primary card) |
| Events | **Calendar** tab → "Events" segment |
| Flex Friday | **Discover** tab (primary card) |
| Flex Pass | Merged into Flex Friday screen as a prominent "Show my pass" action (not a separate nav item) |
| Wrapped | **Discover** tab (seasonal card, shown when open) |

Result: the "More" screen no longer exists. Nothing is buried more than one tap from where a student expects it.

### 2.4 Split the notifications screen

`notifications.tsx` currently does 3 jobs. Split into:
- **`/notifications` (Inbox)** — the bell destination. **Only** the notification list + mark-read. Add pull-to-refresh, swipe-to-mark-read, section headers ("New" / "Earlier").
- **Push setup + Preferences** → move into **Profile → "Notifications" row** → new `/settings/notifications` screen (device registration, test push, per-category toggles using the new `Switch`).

### 2.5 Calendar hub (absorbs Classes + Events)

`calendar.tsx` becomes a hub with a `SegmentedControl` at the top:
- **My Week** — the weekly timetable + friends UI currently in `schedule.tsx` (move that logic here as a sub-view/component `MyWeekView`).
- **Month** — the existing month entries list + source filters (convert source filter Buttons → `FilterChip` row; convert prev/next Buttons → `IconButton`s).
- **Events** — the events list currently at `/events`.

Delete the standalone `(tabs)/schedule.tsx` tab entry (keep the code by relocating it into `src/features/calendar/MyWeekView.tsx`). `/events` can remain as a detail-capable route but is surfaced through the Events segment.

> If full Classes-into-Calendar consolidation is too large for one pass, acceptable fallback:
> keep Classes as a **fourth-ish** view but still remove it from the tab bar — surface it via
> the Calendar hub segment. The tab bar must end at 5 regardless.

### 2.6 Simplify the Dashboard

- Drop the **Up/Down/Hide** editing mode. Replace with **drag-to-reorder** using the already-installed `react-native-draggable-flatlist`, in a bottom sheet ("Customize home"). Persist via the existing `updateDashboardLayout` mutation.
- Remove the **Quick Actions** widget's redundancy: it duplicates Discover. Either delete it or reduce it to 2–3 truly high-frequency shortcuts (e.g. Flex Pass, Search courses).
- Each summary widget gets a **"See all →"** affordance deep-linking to the owning tab, reinforcing "dashboard summarizes, tabs own."

---

## 3. Component Library (Goal 2 — consistency)

Create `apps/mobile/src/components/ui/` primitives. **Every screen must be refactored to use these** — no more bespoke inline pills/rows/toggles. Each consumes `useTheme()` and the token module (§4).

| Component | File | Purpose | Replaces today's… |
|-----------|------|---------|-------------------|
| `Section` | `ui/section.tsx` | Titled block: `title`, optional `action` (right-aligned pressable), `children`. | repeated `<Text …900>` + `<View gap>` headers |
| `ListRow` | `ui/list-row.tsx` | `icon?`, `title`, `subtitle?`, `trailing?` (badge/chevron/switch), `onPress?`. Press animation + haptic built in. | `MenuLink` in more.tsx, friend rows, preference rows |
| `SegmentedControl` | `ui/segmented-control.tsx` | iOS-style segmented tabs with an **animated sliding thumb** (Reanimated). | announcements filter pills, calendar/schedule day pickers |
| `FilterChip` / `ChipGroup` | `ui/chip.tsx` | Toggleable pill for multi-select filters. | Buttons-as-filters in calendar/schedule |
| `Switch` | `ui/switch.tsx` | Animated native-style toggle. | "On/Off" Buttons in notifications |
| `Avatar` | `ui/avatar.tsx` | `uri?`, `name`, `size`. Image or initials fallback. | inline avatar blocks in profile/header |
| `Skeleton` + `SkeletonList` | `ui/skeleton.tsx` | Shimmering placeholder (Reanimated loop). | bare `ActivityIndicator` |
| `EmptyState` | upgrade `ui/empty.tsx` | Add `icon` + optional `action` button. | plain-text `Empty` |
| `IconButton` | `ui/icon-button.tsx` | Circular pressable icon w/ press scale + haptic. | prev/next text Buttons, close buttons |
| `Sheet` | `ui/sheet.tsx` | Thin wrapper over `@gorhom/bottom-sheet` with themed background/handle. | inline `showCreate` expand toggles |
| `Stat` | `ui/stat.tsx` | Big number + label (credits, member counts). | inline metric text |
| `PressableScale` | `ui/pressable-scale.tsx` | Reanimated wrapper: scale-to-0.97 spring on press + optional haptic. | raw `Pressable` opacity feedback |
| `Toast` (+ provider) | `ui/toast.tsx` | Non-blocking top/bottom toast queue. | most `Alert.alert` calls |

**Barrel export:** add `apps/mobile/src/components/ui/index.ts` re-exporting all primitives so screens import from one place.

**Update the Design System gallery** (`design-system.tsx`) to showcase **all** of the above (dev-only). It becomes the visual regression surface for the library.

---

## 4. Styling Standardization (tokens & type)

### 4.1 Create `apps/mobile/src/lib/tokens.ts`
Re-export and extend the design-tokens package so screens import one module:
```ts
import { radii, spacing, typography } from "@ia/design-tokens";
export { radii, spacing };
export const text = {
  // semantic type scale — weight + size + lineHeight bundled
  display:  { fontSize: 30, fontWeight: "800", lineHeight: 36 },
  title:    { fontSize: 22, fontWeight: "800", lineHeight: 28 },
  section:  { fontSize: 18, fontWeight: "700", lineHeight: 24 },
  body:     { fontSize: 15, fontWeight: "500", lineHeight: 22 },
  label:    { fontSize: 13, fontWeight: "600", lineHeight: 18 },
  caption:  { fontSize: 12, fontWeight: "500", lineHeight: 16 },
  overline: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6, textTransform: "uppercase" },
} as const;
export const elevation = { /* shadow presets sm/md/lg */ };
export const duration = { fast: 150, base: 220, slow: 320 } as const;
```
- Add a `<Text>` wrapper component `ui/typography.tsx` exposing `<Txt variant="title">` etc., OR a `useTextStyle(variant)` hook. Replace all inline `fontSize/fontWeight` in screens.
- **Kill magic numbers.** All `borderRadius`, padding, gap literals → `radii.*` / `spacing.*`.

### 4.2 Consistent surfaces
- Standardize `Card` radius to `radii.lg` and one shadow preset from `elevation`. Add optional `Card` variants: `flat` (no shadow) and `interactive` (adds `PressableScale`).
- Standardize screen horizontal padding (`spacing.lg`) and inter-card gap (`spacing.md`) via `Screen`.

### 4.3 Decide on the styling mechanism (pick ONE, document it)
Recommended: **keep StyleSheet/inline but always via tokens** (nativewind is unused and mixing the two is worse than either). If you prefer nativewind, migrate wholesale and delete inline styles — do **not** leave the app half-and-half. Default recommendation: **StyleSheet + tokens**, and remove `nativewind` from deps if it stays unused after the refactor.

---

## 5. Motion System (Goal 2 — animations)

All via `react-native-reanimated` worklets + `expo-haptics`. Create `src/lib/haptics.ts` (thin wrappers: `tapLight()`, `tapMedium()`, `success()`, `warning()`) and `src/lib/motion.ts` (shared entering/exiting presets and spring configs).

| Interaction | Animation | Where |
|-------------|-----------|-------|
| Screen entrance | Staggered `FadeInDown` on cards/sections (40–60ms stagger) | all tab + detail screens |
| List items | `entering={FadeIn}` + `Layout` spring for insert/remove/reorder | announcements, inbox, clubs, calendar, friends |
| Press feedback | `PressableScale` → scale 0.97 spring + `tapLight()` | every tappable card/row/button |
| Tab press | `tapLight()` on tab change | `(tabs)/_layout` via `tabPress` listener |
| Segmented control | Sliding thumb `withSpring` between segments | `SegmentedControl` |
| Switch toggle | Thumb translate + track color interpolate + `tapMedium()` | `Switch` |
| Bottom sheets | Native spring (gorhom) + backdrop fade | `Sheet` usages |
| Skeleton | Opacity/translateX shimmer `withRepeat` | `Skeleton` |
| Pull to refresh | Themed `RefreshControl` | every scroll screen |
| Success actions | `success()` haptic + toast | bookmark, mark read, save schedule, enable push |
| Destructive confirm | `warning()` haptic before Alert | delete personal entry, remove friend, sign out |
| Dashboard reorder | Drag via `react-native-draggable-flatlist` + `Layout` | dashboard customize sheet |
| Unread badge | Subtle pulse `withRepeat` when count increases | tab bell / header bell |

**Perf rules:** worklets only, `useAnimatedStyle`, no state-driven layout thrash. Respect reduce-motion (`AccessibilityInfo.isReduceMotionEnabled` → skip/shorten). Verify on a physical device in a **dev client** (Reanimated animations are unreliable in Expo Go — note this to the tester).

---

## 6. Per-Screen Task List

For each, the pattern is: swap the global header in, replace bespoke inline UI with library primitives, tokenize styles, add motion + haptics + skeleton loading + pull-to-refresh.

### 6.1 `(tabs)/_layout.tsx`
- Reduce to 5 tabs: Home, Calendar, Clubs, Feed, Discover. Remove `schedule` and `more` entries; add `discover`.
- Keep `notifications` routable but `href: null` (reached via header bell).
- Add `tabPress` haptic. Tokenize tab bar dims. Icons: pick a consistent lucide set (Home, CalendarDays, UsersRound, Megaphone, Compass).

### 6.2 `(tabs)/dashboard.tsx`
- Add `AppHeader` (avatar + bell). Remove Edit-widgets Up/Down/Hide; add "Customize" → `Sheet` with draggable list.
- Convert widgets to use `Section` + `ListRow`/`Stat`; add "See all →" deep links. Skeletons while `undefined`. Staggered entrance. Trim/curate Quick Actions.

### 6.3 `(tabs)/calendar.tsx`  ← hub
- Add `SegmentedControl`: My Week / Month / Events. Extract `MyWeekView` (from schedule.tsx), `MonthView`, `EventsView` into `src/features/calendar/`.
- Month: prev/next → `IconButton`; source filters → `ChipGroup`; "Add personal entry" → `Sheet` with a **date/time picker** (add `@react-native-community/datetimepicker` or `expo`'s) instead of raw text fields; delete → `warning()` + confirm.

### 6.4 `(tabs)/schedule.tsx` → `src/features/calendar/MyWeekView.tsx`
- Remove from tab bar. Convert day/period pickers → `SegmentedControl`/`ChipGroup`. Course search + assign → `Sheet`. Friend search rows → `ListRow` with `Avatar`. Visibility toggle → `Switch`.

### 6.5 `(tabs)/announcements.tsx` (Feed)
- Filter pills → `SegmentedControl`. Keep `FlashList` but enable scroll + `RefreshControl` + item entering animation. `AppHeader`.

### 6.6 `announcement-card.tsx`
- `PressableScale`. Read/Save actions → `IconButton`s with optimistic toggle + haptic + toast (drop the text Buttons). Tokenize.

### 6.7 `(tabs)/clubs.tsx`
- Cards → `PressableScale`; add club `Avatar`/logo; member count → small `Stat`/caption; skeleton list; entrance stagger.

### 6.8 `(tabs)/discover.tsx`  ← NEW (replaces more.tsx; delete more.tsx)
- Feature cards for **Courses**, **Flex Friday**, **Wrapped** (seasonal). Rich cards with icon, description, CTA — not a settings list. `PressableScale` + entrance.

### 6.9 `notifications.tsx` → split
- `/notifications` = inbox only: `ListRow`-style items, "New"/"Earlier" `Section`s, swipe-to-read, pull-to-refresh, skeletons.
- `/settings/notifications` = push registration + `Switch` preference rows (moved out).

### 6.10 `profile.tsx`
- `Avatar` (tap → change). Settings as `ListRow`s: Appearance (`/settings/theme`), Notifications (`/settings/notifications`), Account deletion, Sign out (`warning()` + confirm). Password change → `Sheet`. Long-press version → dev Design System.

### 6.11 Detail screens (`events/[id]`, `courses/[slug]`, `clubs/[clubId]*`, `announcements/[id]`, `flex-friday*`, `wrapped`)
- Apply the same primitives, tokens, entrance motion, skeletons. `flex-friday.tsx` gains a prominent "Show my pass" → `/flex-friday/pass`.

### 6.12 Shared infra
- `Screen`: accept an optional `header` slot / integrate `AppHeader`; add `RefreshControl` support; tokenize padding. `AppBackHeader` → `IconButton` style, tokenized.
- `data-boundary.tsx`: loading branch renders a `Skeleton` (accept a `skeleton` prop / variant) instead of `ActivityIndicator`; empty branch uses upgraded `EmptyState`.
- Add `ToastProvider` to `app/_layout.tsx` (inside ThemeProvider). Add `BottomSheetModalProvider` (gorhom) at root.

---

## 7. Execution Phases (sequence for the implementer)

**Phase 0 — Foundation (no visible change yet)**
1. `src/lib/tokens.ts`, `ui/typography.tsx`, `src/lib/haptics.ts`, `src/lib/motion.ts`.
2. Root providers: `ToastProvider`, `BottomSheetModalProvider` in `_layout.tsx`.

**Phase 1 — Component library**
3. Build every primitive in §3 + update `design-system.tsx` gallery. Typecheck (`npm run typecheck`).

**Phase 2 — Navigation / IA**
4. `AppHeader` + wire avatar/bell. 5-tab `_layout`. Create `discover.tsx`, delete `more.tsx`. Split notifications, add `/settings/notifications`. Move Theme/account into Profile.
5. Calendar hub with segments; relocate schedule into `MyWeekView`; remove schedule tab.

**Phase 3 — Screen refactors**
6. Refactor each screen in §6 to primitives + tokens (mechanical, screen by screen).

**Phase 4 — Motion & haptics**
7. Layer in entrance/press/list/segmented/switch/skeleton animations + haptics + pull-to-refresh. Add reduce-motion guard.

**Phase 5 — Polish & verify**
8. Dashboard drag-reorder sheet. Replace remaining `Alert.alert` (non-destructive) with toasts. Remove `nativewind` if still unused. Device QA in a dev client.

Run `npm run typecheck` after each phase (it's the `lint`/`test`/`build` script). Keep each phase a separate commit.

---

## 8. Acceptance Criteria

- [ ] Bottom tab bar has exactly **5** tabs; no "More" tab exists.
- [ ] Inbox and Profile are reachable from **every** tab via the header (bell + avatar).
- [ ] No feature is more than **one tap** from its expected location; Design System is **not** in production nav.
- [ ] Classes/Events are reachable through the **Calendar** hub; Courses/Flex/Wrapped through **Discover**.
- [ ] All screens use shared primitives (`Section`, `ListRow`, `SegmentedControl`, `Switch`, `Chip`, `Avatar`, `Skeleton`, `EmptyState`, `Sheet`, `IconButton`, `Toast`) — **no bespoke inline pills/toggles/rows remain**.
- [ ] No raw pixel literals for radius/spacing/type in screen files; all via `tokens`.
- [ ] Every list/scroll screen has skeleton loading + pull-to-refresh + entrance animation.
- [ ] Every primary action has press physics + haptic; success paths use toasts, not blocking Alerts (Alerts only guard destructive actions).
- [ ] `react-native-reanimated`, `expo-haptics`, `@gorhom/bottom-sheet`, `react-native-draggable-flatlist` are all actually used.
- [ ] Reduce-motion is respected. `npm run typecheck` passes.

---

## 9. Dependencies

**Already installed (must start being used):** `react-native-reanimated`, `expo-haptics`, `@gorhom/bottom-sheet`, `react-native-draggable-flatlist`, `react-native-gesture-handler`, `@shopify/flash-list`, `lucide-react-native`.

**May need to add:** a date/time picker (`@react-native-community/datetimepicker`) for the Calendar personal-entry sheet.

**Candidate for removal:** `nativewind` + `tailwindcss` if the StyleSheet+tokens direction is kept and no classes are adopted.

**Testing note:** Reanimated / gorhom animations need a **dev client**, not Expo Go — flag this to whoever QAs. Maestro flows in `apps/mobile/maestro` may need selector updates after the nav change.
