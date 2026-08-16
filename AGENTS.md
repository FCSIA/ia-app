# Agent Guide

Read, in order:

1. `agent-notes/STATE.md`;
2. the smallest relevant document under `docs/`;
3. any nested `AGENTS.md`;
4. the source files involved.

Repository truth overrides chat history.

## Non-negotiable: Web UI

Web UI is human-directed and primitive-first.

Before changing `apps/web` UI:

1. Read `.impeccable.md` and `agent-notes/WEB_UI_WORKFLOW.md`.
2. If a primitive is involved, also read
   `agent-notes/UI_PRIMITIVE_COMPATIBILITY.md`.
3. Inspect the current Fluid documentation: rendered example, Code example,
   API, exact registry source, and local adapter.

Agents may compose approved primitives and established local patterns. Agents
must not silently:

- recreate behavior already owned by a primitive;
- choose a primitive by appearance instead of semantics;
- patch primitive defects with page-level spacing, radius, clipping, or icon
  overrides;
- introduce a new visual pattern or shared primitive API.

If approved primitives cannot express the required behavior or anatomy, **stop
before coding** and request a design/architecture decision.

Agent visual review is diagnostic, not design approval. Material visual changes
remain awaiting review by the design owner.

## Working Rules

- Keep changes in one coherent subsystem.
- Inspect before editing; use `rg` for search.
- Preserve unrelated worktree changes.
- Fix causes rather than adding broad ignores or compatibility aliases.
- Update `agent-notes/STATE.md` only when coordination or handoff truth
  materially changes.
- Update documentation only when its truth materially changes.
- Use `direnv exec .` for project commands.

## Backend

For anything under `apps/convex`, read `apps/convex/AGENTS.md` and the generated
Convex guidelines before acting. Never select or mutate a shared deployment
without explicit authorization.

## Git

- Commit coherent slices regularly.
- Use `subsystem: concise change` subjects.
- Do not stage or revert unrelated work.
- Student-visible changes carry a `Devlog:` trailer with the sentence students
  should read. Commit subjects become the in-app devlog; see
  `docs/reference/versioning.md`.
- `CHANGELOG.md` and `packages/devlog/src/releases.generated.ts` are generated.
  Edit `packages/devlog/data/releases.json` and run `pnpm devlog:generate`.

## Verification

Run the narrowest relevant checks. For web code:

- `direnv exec . pnpm --filter web exec tsc --noEmit`
- `direnv exec . pnpm --filter web lint`
- `direnv exec . pnpm --filter web build` when production compilation matters

These checks establish code correctness, not design approval. Report skipped or
unavailable verification honestly.
