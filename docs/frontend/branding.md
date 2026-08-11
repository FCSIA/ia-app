---
tags: [frontend, branding, assets]
---

# Brand Assets

[Home](../index.md)

The IA app uses one product mark: **IA Orbit**, the Innovation Academy phoenix
in the authored Liquid Glass app icon. Its canonical source is
`icon-composer/IA Orbit.icon`. Apple platforms consume that layered source;
`icon-composer/IA Orbit-flattened.png` and `icon-composer/IA Orbit-dark.png`
are the 1024pt iOS Default and Dark exports used as canonical raster sources
for every other platform.

Use that mark for the web shell, login, loading states, PWA icons, QR centers,
and mobile app surfaces. Do not create a separate `IA` letter tile or recolor
the phoenix for another app surface.

`apps/web/public/icons/innovation-academy-logo.png` is the official school
wordmark. Keep it for school-identification or document contexts where the full
school name is needed; it is not the app icon.

## Generated Files

After changing `IA Orbit.icon`, export the iOS Default and Dark appearances at
1024pt/1x from Icon Composer as `icon-composer/IA Orbit-flattened.png` and
`icon-composer/IA Orbit-dark.png`, then run:

```bash
pnpm brand:generate
pnpm brand:check
```

The generator owns the exact-size web icons, light/dark browser favicons,
mobile icon and in-app marks, Android adaptive foreground, monochrome
notification icon, splash mark, and the Expo-local copy of the iOS Icon
Composer source. Web and mobile marks use the Dark rendition for dark and
high-contrast app themes, and the Default rendition for other themes.
`pnpm brand:check` fails when any generated asset drifts from the source.
