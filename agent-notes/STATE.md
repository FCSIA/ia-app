# Current Execution State

## Active Agent Focus
- **Agent**: Codex
- **Focus**: Consolidating repository guidance, human docs, and agent handoff references.
- **Status**: In progress on a docs/dev-env PR branch.

## Current Repo Direction
- Fluid Functionalism is the primary web UI system, installed through the shadcn registry namespace in `apps/web/components.json`.
- Use current Fluid registry APIs and shadcn/Radix contracts instead of compatibility aliases in primitive files.
- Human-facing durable docs belong in `docs/` and `README.md`.
- Agent coordination and volatile handoff context belong in `agent-notes/`, with `STATE.md` as the first stop.

## Recent Actions
- (2026-05-10) Codex stabilized Fluid primitive lint drift, removed broad Next lint/type build ignores, and verified web lint/typecheck/build.
- (2026-05-10) Codex updated README setup/seed docs for PostgreSQL, flake/direnv, full seeded account ranges, and the full global role set.
- (2026-05-10) Codex updated AGENTS.md and agent-notes references so future agents know where to find current state versus durable docs.

## Next Up
- Keep `README.md` focused on human setup and orientation.
- Keep `AGENTS.md` concise and operational for agents.
- Update the smallest relevant file in `docs/` or `agent-notes/` whenever roles, seed data, env, setup, or UI-system assumptions change.
