# Agent Guide

Start by reading `agent-notes/STATE.md`, then the smallest relevant file under `docs/`, then the source files you will touch. Treat chat history as less reliable than the repo.

## Working Rules

- Use conventional commits, with concise multi-line bodies when the why matters.
- Keep README content human-facing. Put agent workflow, handoff, and repo-operation notes here or in `agent-notes/`.
- Do not add broad lint/build ignores to get a green run. Fix the primitive or call site drift instead.
- Prefer existing shadcn/Fluid primitives and local component APIs over compatibility aliases.
- Use `rg` for search and inspect before editing. Work with user changes in the tree; do not revert unrelated files.
- Use `gh` to inspect GitHub issues, PRs, checks, and conflict context. Resolve code conflicts in files, then verify locally.
- Update `agent-notes/STATE.md` only when the handoff state materially changes.

## Verification

Run the narrowest useful checks first, then broader checks before committing:

- API behavior: `pnpm --filter api test`
- Web and type safety: `pnpm lint`, `pnpm build`
- Database changes: `pnpm db:generate` after Prisma schema edits

Document any skipped check in the final handoff.
