# Smooth page transitions plan

Tracking: [issue #215](https://github.com/FCSIA/ia-app/issues/215).
Owner: @rebanto. Status: proposal; implementation and visual review pending.

## Goal

Make navigation between pages feel smooth and fluid. This work concerns route
changes, including sidebar/mobile navigation and browser Back/Forward.
Control hover effects, tab animations, and menu/dialog animations are outside
this issue's scope.

## Current behavior and ownership

- `apps/web/src/components/layout/page-transition.tsx` currently renders a
  plain div; it performs no page animation.
- `apps/web/src/components/layout/AppShell.tsx` wraps page content with that
  component. `apps/web/src/app/login/template.tsx` also uses it.
- `apps/web/src/components/layout/navigation-loading-overlay.tsx` animates
  loading feedback separately. Coordinate that feedback with route transitions
  so fast navigation does not flash or animate twice.
- `apps/web/src/lib/springs.ts` provides existing shared motion timings.

## Implementation plan

1. Trace route commits, shell persistence, loading boundaries, scroll restoration,
   and mobile navigation. Check installed Next.js documentation before choosing
   the transition lifecycle; do not assume exit animations retain an old route.
2. Agree on page transition direction with the design owner: a restrained fade,
   subtle movement, or another approved treatment. Record duration, interruption,
   loading, and reduced-motion behavior before introducing a new visual pattern.
3. Implement at the shared route/content boundary. Keep navigation chrome stable
   and avoid page-by-page wrappers, artificial navigation delays, and remounting
   persistent providers or workspaces solely to restart an animation.
4. Handle rapid repeated navigation, Back/Forward, slow routes, errors, and
   redirected navigation without stale content, blank frames, or blocked input.
5. Preserve focus handling, scroll restoration, query/hash navigation semantics,
   sticky/fixed elements, and viewport-bounded workspaces. Honor reduced motion.

Follow [the web UI workflow](../../agent-notes/WEB_UI_WORKFLOW.md). If a Fluid
primitive participates, inspect its current rendered example, Code example,
API, registry source, and local adapter. New route motion remains subject to
design-owner review; this plan supplies no implicit visual approval.

## Acceptance and verification

- [ ] Page navigation has a consistent, smooth transition on desktop and mobile.
- [ ] Shared chrome stays stable; fast navigation has no loading-overlay flash.
- [ ] Rapid navigation and Back/Forward do not leave stale pages or blank frames.
- [ ] Slow loading, error, redirect, query-only, and hash navigation remain usable.
- [ ] Focus, scroll restoration, sticky/fixed layout, and workspace state survive.
- [ ] Reduced-motion users receive immediate, accessible page changes.
- [ ] Review supported themes, narrow layouts, and touch behavior.
- [ ] Run web typecheck, lint, and production build through `direnv exec .`.
- [ ] Provide before/after navigation recordings and obtain design-owner review.

This draft adds a plan only. Page transition implementation and browser/device
validation remain pending.
