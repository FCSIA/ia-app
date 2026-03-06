---
tags: [frontend, styling, tailwind, css, glassmorphism]
---

# Styling — Tailwind & Glassmorphic Design

← [[index|Home]] / [[frontend-overview]]

---

## Tailwind CSS

Tailwind is a "utility-first" CSS framework. Instead of writing CSS files with class names that you invent, you use pre-built single-purpose classes directly in your HTML/JSX:

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

## The Glassmorphic Design System

The visual style is defined in `src/app/globals.css`. The "glass" effect is achieved with:

1. **Semi-transparent background**: `rgba(255,255,255,0.04)` — 4% white
2. **Backdrop blur**: `backdrop-filter: blur(24px) saturate(180%)` — blurs what's behind the element
3. **Subtle border**: `rgba(255,255,255,0.08)` — 8% white border
4. **Inner highlight**: `box-shadow: 0 1px 0 rgba(255,255,255,0.06) inset` — top edge highlight

### The Dark Background

```css
body {
  background-color: #0c0a09; /* warm near-black */
  background-image:
    /* subtle orange glow at top-right corner */
    radial-gradient(ellipse 80% 50% at 100% 0%, rgba(249,115,22,0.06) 0%, transparent 100%),
    /* subtle orange glow at bottom-left corner */
    radial-gradient(ellipse 60% 40% at 0% 100%, rgba(234,88,12,0.04) 0%, transparent 100%);
}
```

### Background Blobs

Three fixed blurred orbs in `layout.tsx` create depth behind all content:

```tsx
// Orange orb — top right
{ background: '#f97316', filter: 'blur(120px)', opacity: 0.04, width: 500, height: 500 }

// Amber orb — bottom left
{ background: '#d97706', filter: 'blur(100px)', opacity: 0.03, width: 420, height: 420 }

// Deep orange orb — middle right
{ background: '#c2410c', filter: 'blur(90px)', opacity: 0.025, width: 300, height: 300 }
```

`opacity: 0.03–0.04` means 3–4% opacity — almost invisible but adds warmth.

---

## Custom CSS Classes

Defined in `globals.css` and used throughout the app:

### .card
```css
.card {
  background: rgba(255,255,255,0.04);
  backdrop-filter: blur(24px) saturate(180%);
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow:
    0 1px 0 rgba(255,255,255,0.06) inset,  /* top highlight */
    0 20px 60px rgba(0,0,0,0.35);           /* drop shadow */
  border-radius: 16px;
  padding: 1.5rem;
  transition: transform 0.2s ease-out, border-color 0.2s, box-shadow 0.2s;
}

.card:hover {
  transform: translateY(-2px);               /* lift */
  border-color: rgba(255,255,255,0.14);      /* brighter border */
}
```

### .btn-primary (Orange)
```css
.btn-primary {
  background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
  color: white;
  border-radius: 10px;
  padding: 0.5rem 1rem;
  box-shadow: 0 4px 20px rgba(249,115,22,0.25), 0 1px 0 rgba(255,255,255,0.15) inset;
  transition: all 0.2s ease-out;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 8px 30px rgba(249,115,22,0.35);
}
```

### .btn-secondary (Glass)
```css
.btn-secondary {
  background: rgba(255,255,255,0.06);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255,255,255,0.1);
  color: rgba(255,255,255,0.75);
  border-radius: 10px;
}
```

### .input (Dark Glass)
```css
.input {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  color: white;
  border-radius: 10px;
  padding: 0.625rem 0.875rem;
  width: 100%;
}

.input:focus {
  border-color: rgba(249,115,22,0.5);              /* orange border */
  box-shadow: 0 0 0 3px rgba(249,115,22,0.12);     /* orange glow */
  outline: none;
}
```

### .badge-* (Colored Tags)
```css
.badge-blue  { background: rgba(59,130,246,0.15);  color: #93c5fd;  border: 1px solid rgba(59,130,246,0.25); }
.badge-green { background: rgba(16,185,129,0.15);  color: #6ee7b7;  border: 1px solid rgba(16,185,129,0.25); }
.badge-yellow{ background: rgba(245,158,11,0.15);  color: #fcd34d;  border: 1px solid rgba(245,158,11,0.25); }
.badge-red   { background: rgba(239,68,68,0.15);   color: #fca5a5;  border: 1px solid rgba(239,68,68,0.25); }
.badge-gray  { background: rgba(107,114,128,0.15); color: #d1d5db;  border: 1px solid rgba(107,114,128,0.25); }
```

All badges share the same formula: colored background at 15% opacity, light-colored text, colored border at 25% opacity.

### .page-enter (Entry Animation)

```css
@keyframes fadeSlideUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}

.page-enter {
  animation: fadeSlideUp 0.3s ease-out both;
}
```

Applied to the `<main>` element in AppShell — every page slides up gently when navigating.

---

## Tailwind Config

`tailwind.config.ts` extends Tailwind with custom tokens:

```typescript
theme: {
  extend: {
    colors: {
      accent: {
        400: '#fb923c',  // lighter orange
        500: '#f97316',  // primary orange
        600: '#ea580c',  // darker orange
      },
    },
    boxShadow: {
      glass: '0 1px 0 rgba(255,255,255,0.06) inset, 0 20px 60px rgba(0,0,0,0.35)',
      'accent-glow': '0 8px 30px rgba(249,115,22,0.25)',
    },
  },
}
```

These are then available as Tailwind classes:
```tsx
className="text-accent-400 shadow-accent-glow"
```

---

## Related

- [[frontend-overview]] — React and Next.js overview
- [[components]] — Where these classes are applied
