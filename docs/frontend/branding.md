---
tags: [frontend, branding, assets]
---

# Brand Assets

[Home](../index.md)

The IA app uses one product mark: the white Innovation Academy phoenix on the
orange app-icon field. The canonical raster source is
`apps/web/public/icons/logo.png`.

Use that mark for the web shell, login, loading states, PWA icons, QR centers,
and mobile app surfaces. Do not create a separate `IA` letter tile or recolor
the phoenix for another app surface.

`apps/web/public/icons/innovation-academy-logo.png` is the official school
wordmark. Keep it for school-identification or document contexts where the full
school name is needed; it is not the app icon.

## Generated Files

Run this after changing the canonical source:

```bash
pnpm brand:generate
pnpm brand:check
```

The generator owns the exact-size web icons, mobile icon and in-app mark,
Android adaptive foreground, monochrome notification icon, splash mark, and the
iOS Icon Composer phoenix layer. `pnpm brand:check` fails when any generated
asset drifts from the source.
