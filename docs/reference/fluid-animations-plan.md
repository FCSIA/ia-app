# Smooth Fluid animations plan

Tracking: [issue #215](https://github.com/FCSIA/ia-app/issues/215).
Owner: @rebanto. Status: proposal; implementation and design approval pending.

## Goal

Make web interactions feel continuous, responsive, and restrained by reusing
Fluid's existing motion contracts. Select the first affected surfaces with the
design owner before implementation.

## Existing foundations

- `apps/web/src/lib/springs.ts` defines fast, moderate, and slow transitions
  plus exit timing fallbacks. Audit consumers before changing global timings.
- `apps/web/src/components/ui/fluid-hover-highlight.tsx` owns the moving
  highlight and reads the reduced-motion preference.
- `CardGroup` and `Table` consume the shared highlight. Preserve registration
  and stable item indices; the club workspace channel list is the approved
  CardGroup reference in the web UI workflow.
- Tabs, switches, and tooltips already use shared springs and reduced-motion
  hooks. Inspect each candidate rather than assuming motion is missing.
- `apps/web/src/app/globals.css` contains reduced-motion rules. Check both
  CSS and JavaScript animation paths.

These are starting points for an audit, not findings that these components are
defective or approval to change all of them.

## Implementation sequence

1. Inventory candidate interactions, documenting trigger, semantic role,
   current behavior, proposed behavior, owning primitive, and affected routes.
2. Follow [the web UI workflow](../../agent-notes/WEB_UI_WORKFLOW.md) and
   [primitive compatibility guidance](../../agent-notes/UI_PRIMITIVE_COMPATIBILITY.md).
   Inspect current Fluid rendered examples, Code examples, APIs, exact registry
   sources, and local adapters; record the references with the implementation.
3. Classify each change as supported composition, shared contract defect, or
   design/API gap. Obtain a design-owner decision for gaps before coding.
4. Implement one coherent shared motion subsystem at a time. Reuse existing
   springs and primitive-owned behavior. Avoid page-level animation overrides,
   duplicate highlight systems, blanket transition-all, or new dependencies
   without a demonstrated requirement.
5. Keep feedback immediate and allow transitions to interrupt or reverse.
   Preserve focus, dismissal, selected state, scroll position, and touch use.
   Reduced motion must retain useful state feedback without spatial animation.

## Decisions before implementation

- Which interactions form the initial slice: proximity feedback, panel
  switching, overlay entry/exit, or inline disclosure?
- For that slice, is the goal to restore documented Fluid behavior or introduce
  a new motion direction? What exact before/after behavior should reviewers see?
- Can the documented primitive API express the result? If not, record the
  limitation, alternatives, proposed shared API, and required review states.

Do not treat the candidate list as approval for route transitions, global
stagger effects, shared timing changes, or a new primitive API.

## Verification and handoff

- Exercise rapid pointer movement, repeated activation, interruption/reversal,
  keyboard focus and Escape, and touch interactions.
- Inspect open/closed, selected, disabled, loading, narrow layouts, supported
  themes, reduced motion, and changing content sizes. Check for stale
  highlights, flicker, clipping, scroll jumps, and unnecessary layout work.
- Run `direnv exec . bun run --filter web typecheck`,
  `direnv exec . bun run --filter web lint`, and
  `direnv exec . bun run --filter web build` for implementation changes.
- Supply routes, before/after evidence, references consulted, and unavailable
  device/browser coverage. Design-owner visual approval remains separate from
  code correctness checks.

This planning PR changes documentation only. Runtime implementation, browser
verification, and final design-owner review have not been performed.
