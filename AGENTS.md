# Agent Guide

Start by reading `agent-notes/STATE.md`, then the smallest relevant file under `docs/`, then the source files you will touch. Treat chat history as less reliable than the repo.

## Product Context

- Users are Innovation Academy students, teachers, sponsors, and school admins.
- The app should feel clear, capable, school-centered, organized, and dependable.
- Prefer readable density and practical hierarchy over decorative UI; do not
  repeat page titles or instructions when the shell already provides enough
  context.
- Keep README content human-facing. Put agent workflow, handoff, and
  repo-operation notes here or in `agent-notes/`.

## Working Rules

- Keep changes in coherent slices. Do not mix unrelated docs, infra, feature,
  and refactor work unless one cannot stand without the other.
- Do not add broad lint/build ignores to get a green run. Fix the primitive or call site drift instead.
- Prefer existing shadcn/Fluid primitives and local component APIs over compatibility aliases.
- Use `rg` for search and inspect before editing. Work with user changes in the tree; do not revert unrelated files.
- Use `gh` to inspect GitHub issues, PRs, checks, and conflict context. Resolve code conflicts in files, then verify locally.
- Update `agent-notes/STATE.md` only when the handoff state materially changes.
- Do not let docs drift from code. If seed data, roles, env vars, commands, or
  setup behavior changes, update the relevant doc in the same slice.

## Git

- Commit regularly.
- Prefer subsystem-first commit subjects: `subsystem: concise change`.
  Do not default to Conventional Commit prefixes such as `feat`, `fix`, or
  `chore`. Choose the subsystem people will search for later, such as `cli`,
  `state`, `tui`, `api`, `docs`, `nix`, `test`, or a narrower module.
- Keep messages compact. A small commit can use a subject line only; add a body
  when the reason, tradeoff, or implementation detail matters.
- Body bullets should explain why or how, not repeat the subject. Do not force
  a fixed number of bullets.
- Prefer backticks for literal paths, commands, package names, settings, and
  similar identifiers when they improve scanability.

```text
cli: render activity as square heatmap

- use one colored square per day instead of intensity glyphs
- keep empty days visible as gray cells
- orient the grid by week columns and weekday rows
```

```text
state: record attempt events

- keep `attempts.csv` as the latest per-question snapshot
- append every answer to `events.csv` for streaks and activity
```

```text
docs: tighten commit guidance
```

## Frontend Rules

- Fluid Functionalism, shadcn, and Tailwind are the primary UI layers for the web
  app.
- Before adding, updating, or migrating a Fluid, shadcn, Base UI, or Radix
  primitive, read `agent-notes/UI_PRIMITIVE_COMPATIBILITY.md`.
- For UI work, prefer current Fluid primitives and registry APIs over old local
  assumptions. Use Radix/shadcn directly only where Fluid does not cover the
  required accessibility or semantic behavior.
- Keep hover, focus, pressed, selected, unread, disabled, and loading states
  visible and consistent.
- Prevent button and badge text wrapping/overflow by default.
- Use current React, Next.js, and component-library docs or skills when behavior
  may have changed; do not rely on memory for unstable framework details.

## Skills And References

- When available, use these skills for frontend/component work:
  - `building-components` for reusable component design and API quality.
  - `vercel-composition-patterns` for scalable React component composition.
  - `vercel-react-best-practices` for Vercel React/Next.js performance rules.
- If a skill is missing and the task depends on it, search/install from
  `skills.sh` or continue with current official docs when installation is not
  appropriate.

## Verification

Run the narrowest useful checks first, then broader checks before committing:

- Convex behavior and generated types: `pnpm --filter cvx codegen`, then `pnpm --filter cvx typecheck`
- Focused frontend type safety: `pnpm --filter web exec tsc --noEmit`
- Web and type safety: `pnpm lint`, then `pnpm build`
- Schema changes: run `pnpm db:generate` after Convex schema/function signature edits
- Nix changes: `nix flake check --no-build`

Document any skipped check in the final handoff.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`apps/convex/src/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->
