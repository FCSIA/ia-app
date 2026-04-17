---
tags: [frontend, styling, tailwind, shadcn, theme]
---

# Styling — Tailwind v4, shadcn, and Theme Tokens

← [[index|Home]] / [[frontend-overview]]

---

## Tailwind CSS v4

This app is on **Tailwind CSS v4**. Instead of a generated config-first setup, the main theme now lives directly in `apps/web/src/app/globals.css`.

Key pieces:

```css
@import "tailwindcss";
@custom-variant dark (&:is(.dark *));
@config "../../tailwind.config.ts";

@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  /* ... */
}
```

That means:
- Tailwind utilities still drive the UI
- the design tokens are CSS variables first
- light/dark theme values are defined in one place
- shadcn components automatically pick up the same tokens

Tailwind is still utility-first:

```tsx
// Without Tailwind — separate CSS file needed
<div className="card-container">...</div>

// With Tailwind — everything inline
<div className="flex items-center gap-4 p-6 rounded-2xl bg-white/5">...</div>
```

### Common Classes Used in This App

| Class | CSS equivalent |
|-------|---------------|
| `flex` | `display: flex` |
| `items-center` | `align-items: center` |
| `justify-between` | `justify-content: space-between` |
| `gap-4` | `gap: 1rem` |
| `p-6` | `padding: 1.5rem` |
| `px-4` | `padding-left: 1rem; padding-right: 1rem` |
| `mb-6` | `margin-bottom: 1.5rem` |
| `w-full` | `width: 100%` |
| `max-w-2xl` | `max-width: 42rem` |
| `mx-auto` | `margin-left: auto; margin-right: auto` (centers block) |
| `text-sm` | `font-size: 0.875rem` |
| `font-semibold` | `font-weight: 600` |
| `rounded-2xl` | `border-radius: 1rem` |
| `overflow-hidden` | `overflow: hidden` |
| `cursor-pointer` | `cursor: pointer` |
| `transition-all` | `transition: all 0.15s` |
| `hover:-translate-y-1` | lifts element 4px on hover |
| `line-clamp-2` | truncates text after 2 lines |

### Opacity Modifier

Tailwind lets you append opacity to color classes:

```tsx
text-white/80    // white text at 80% opacity
bg-white/[0.04]  // white background at 4% opacity (custom value)
border-white/10  // white border at 10% opacity
```

### Responsive Prefixes

```tsx
className="p-4 md:p-8"
// p-4 on mobile, p-8 on medium (768px+) screens
```

---

## shadcn/ui Setup

The web app uses **shadcn/ui** with:

- `style: "new-york"` in `apps/web/components.json`
- Radix primitives under `apps/web/src/components/ui`
- CSS variables enabled
- Lucide as the icon set

The current shadcn docs also support Tailwind v4, which matches this repo's setup.

### Practical implication

For new UI work:

- prefer composing shadcn primitives over writing custom one-off components
- keep theme values in `globals.css`
- customize via tokens and utility classes instead of long bespoke CSS blocks
- use the orange/warm palette already established in the theme variables

---

## Theme Direction

The current visual language is warm and orange-forward:

- light mode uses bright neutral surfaces with orange and amber gradients
- dark mode uses warm near-black surfaces instead of blue-gray defaults
- cards rely on subtle borders, soft blur, and layered shadows rather than a flat white panel system
- feature pages can push the design further, but should stay anchored to the shared tokens

Examples from `globals.css`:

```css
:root {
  --accent-glow: rgba(249, 115, 22, 0.1);
  --glass-bg: rgba(255, 255, 255, 0.7);
  --glass-border: rgba(0, 0, 0, 0.08);
}

.dark {
  --accent-glow: rgba(249, 115, 22, 0.2);
  --glass-bg: rgba(255, 255, 255, 0.04);
  --glass-border: rgba(255, 255, 255, 0.08);
}
```

---

## Toasts and Current shadcn Guidance

Current shadcn docs prefer **Sonner** for new toast work.

This repo still uses the existing `react-hot-toast` + `useToast` flow in the app shell and pages. That is the current runtime truth, but if the toast system gets refactored later, Sonner is the direction that matches the latest shadcn guidance.

---

## Related

- [[frontend-overview]] — React and Next.js overview
- [[components]] — Where these classes are applied
