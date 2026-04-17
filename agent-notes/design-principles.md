# Design Principles

## Voice & copy
- No marketing yap. No "Keep the school day legible before the noise starts."
- Labels are nouns. Actions are verbs. Nothing else.
- Empty states: state the fact ("No upcoming events.") — do not explain what the section is for.
- If a description doesn't add information the title lacks, delete it.
- "Shortcuts" not "Fast paths". "Unread mentions" not "Clear mentions and direct follow-up".

## Layout
- Edge-to-edge. No outer page padding, no wrapper card around the app.
- Persistent dark sidebar on the left (`bg-sidebar`, 72px wide, `sticky top-0 h-screen`).
- Sticky top header inside the main column (`sticky top-0 z-20`), blurred background.
- Main content uses the document scroll — never an internal `overflow-y-auto` column.
- Max content width: `1580px`, centered, `px-6 lg:px-8`.

## Sidebar
- Icon-only, always. Labels appear via tooltip on hover.
- Active item = white circle, dark icon. Inactive = muted icon, subtle hover bg.
- Circular hit targets (`size-11 rounded-full`). Never square.
- Top: brand mark. Middle: primary nav (scrolls if crowded). Bottom: account + admin + theme toggle, pinned.
- Sign out lives in the avatar dropdown, not the sidebar.

## Top bar
- Page title + one-line detail on the left. No breadcrumbs.
- Avatar pill on the right opens a dropdown: identity header → Settings → Sign out.
- Nothing else in the top bar unless the page genuinely needs global controls.

## Surfaces
- `rounded-3xl` for panels, `rounded-2xl` for cards/stats, `rounded-full` for pills/avatars.
- Borders over shadows. Shadows only on floating elements (dropdowns, toasts).
- One accent panel tone (`bg-accent`) available on `Panel` for emphasis. Do not invent more.
- No decorative gradients, blurred orbs, or grid overlays on the page background.

## Color
- Brand primary: warm orange (`--primary: 24 95% 53%`). Used for CTA, active dots, brand mark.
- Sidebar: always dark charcoal (`--sidebar: 240 8% 10%`), regardless of light/dark mode.
- Main surface: white in light mode, near-black in dark mode.
- Outer body backdrop: soft lavender-gray (`--background: 240 16% 94%`). Visible at the edges and gutters only.
- Destructive is reserved for destructive actions. It is not a vibe.

## Density
- Generous whitespace. Cards breathe (`p-5` to `p-6`).
- Stat numbers are large and bold; their labels are small, uppercase, wide-tracked.
- Body copy: `text-sm leading-6` default, `text-base leading-7` for hero descriptions.

## Components
- `PageFrame` — centered max-width wrapper. Does not render a `<main>` (AppShell does).
- `HeroBand` — optional. Use only when the page needs a large title with aside stats. Most pages skip it.
- `HeroStat` — stat card. Value + label + optional icon. No description unless it adds a fact.
- `Panel` — titled section. Drop the description unless it's non-obvious.

## Things we do not do
- Do not add colons before tool-use style narration in the UI.
- Do not explain what a section does in its header. The header is the name.
- Do not use emojis in UI copy.
- Do not add "Welcome back, {name}. This is the fast read…" text anywhere.
- Do not render sidebar labels next to icons. Tooltip only.
- Do not nest scroll containers.
