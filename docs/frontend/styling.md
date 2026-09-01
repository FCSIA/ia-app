---
tags: [frontend, styling, tailwind, shadcn, theme]
---

# Styling

[Home](../index.md) / [Frontend overview](frontend-overview.md)

The web app uses Tailwind CSS v4, shadcn/ui, Radix primitives, and local layout
components.

## Tailwind v4

The main theme lives in `apps/web/src/app/globals.css`.

```css
@import "tailwindcss";
@custom-variant dark (&:is(.dark *));
@config "../../tailwind.config.ts";

@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
}
```

Use utility classes for local layout and spacing. Keep global CSS for tokens,
base styles, and reusable app-wide utilities.

The standalone web shell opts into `viewport-fit=cover` and applies iOS
safe-area insets at its shared header and main surface. Do not add page-level
notch or home-indicator padding; that would double the shell-owned inset.
Viewport-bounded workspaces use `AppShell`'s `visual` viewport mode so the
software keyboard resizes the shell, the document stays locked, and the
workspace's designated scrollport remains the only scrolling surface.
On touch-primary devices, a focused channel composer collapses the shell's
home-indicator inset and its own bottom padding because the keyboard already
owns that edge. Keep this focus-owned adjustment in CSS; do not add keyboard
detection or page-level viewport resizing for composer spacing.
The Previous/Next/Done form assistant above the iPhone keyboard is owned by
iOS/WebKit and has no web API for hiding it. Do not replace accessible inputs
or editors with simulated controls to suppress operating-system chrome.

## Common Utilities

| Class | Meaning |
| --- | --- |
| `flex`, `grid` | layout |
| `items-center`, `justify-between` | flex alignment |
| `gap-4`, `p-6`, `px-4` | spacing |
| `w-full`, `max-w-2xl`, `mx-auto` | sizing and centering |
| `text-sm`, `font-semibold` | typography |
| `rounded-xl`, `border`, `shadow-sm` | surface styling |
| `text-muted-foreground`, `bg-card` | theme token colors |
| `md:p-8`, `lg:grid-cols-3` | responsive variants |

Opacity modifiers are common:

```tsx
className="border-border/70 bg-card/95 text-muted-foreground"
```

## Interaction Surfaces

Fluid controls use two semantic overlays instead of theme-specific hover or
selection colors:

| Class | Meaning |
| --- | --- |
| `bg-hover` | foreground mixed over the current substrate at 6% |
| `bg-active` | foreground mixed over the current substrate at 10% |

Because these colors are translucent, they remain relative to the card, panel,
popover, or page underneath them. Use `bg-hover` for preview/hover feedback and
`bg-active` for selected or pressed states; do not add light/dark branches for
the same interaction.

## shadcn/ui

The app uses shadcn/ui with Radix primitives under
`apps/web/src/components/ui`.

For new UI:

- compose existing primitives first,
- use theme tokens instead of hard-coded colors where practical,
- prefer Lucide for common icons unless a local feature already uses another
  icon set,
- keep loading, empty, and error states visually consistent.

## Layout Primitives

Use these before creating new page shells:

- `AppShell`
- `ScrollPageLayout`
- `FillPageLayout`
- `PageFrame`
- `HeroBand`
- `Panel`
- `FeatureFilterBar`

## Bounded Scrolling

Use the shared Fluid `ScrollArea` for app-owned panes with a bounded height or
width, such as navigation lists, table workbenches, calendar grids, dialogs,
and sheets. Set a definite constraint on `ScrollArea`, put content spacing on
the viewport, and choose `orientation="horizontal"` or `"both"` when the
content can overflow on those axes. Fluid's scrollbar reveals on hover or
scroll without remounting, providing the edge affordance for these generic
panes; do not add a mask fade that can imply overflow when everything already
fits.

Do not wrap scrollports whose owning component depends on being the scrolling
element. This includes `MessageScroller`, command/select/menu internals, rich
text editors, tabs, and snap-scrolling attachment rails. Those components keep
their local scrolling contract. Touch-primary devices automatically use native
overflow through the shared `ScrollArea` fallback.

## Theme Direction

The current visual direction is warm, clean, and operational:

- neutral surfaces with orange/accent highlights,
- readable dense pages for admin and school workflows,
- restrained motion and shadows,
- responsive layouts that avoid clipping and horizontal overflow.

New web and mobile installs start in dark mode. A theme explicitly selected by
the user remains persisted locally and is never overwritten by the default.

Custom palette colors update their paired foreground tokens together. In
particular, the Secondary color owns card, popover, and muted surfaces, so its
automatic contrast is applied to each matching foreground token rather than
only to secondary controls. Automatic foregrounds choose black or white by
comparing WCAG contrast ratios. The Custom theme also exposes a Text color for
page content over a background image, whose contrast cannot be inferred from a
single color token. Raised surfaces scope generic `foreground` utilities back
to `card-foreground`; popup adapters narrow that scope to
`popover-foreground`. Manual `bg-card` or `bg-surface-*` containers must apply
the shared card-surface foreground scope so page text choices do not leak onto
opaque surfaces.

## Toasts

The app currently renders both the existing `react-hot-toast` path and the
shadcn toast renderer. Do not add a third toast flow. If toast behavior is
refactored, consolidate it deliberately across the app.

## Related

- [Components and hooks](components.md)
- [Frontend overview](frontend-overview.md)
