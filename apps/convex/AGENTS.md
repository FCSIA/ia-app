<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`src/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

## Local-First Deployment Safety

Before selecting a deployment, starting `convex dev`/`pnpm dev`, or running a
seed reset, read `docs/backend/convex-local-production.md` and
`docs/reference/environment.md`; for seed work, also read
`docs/backend/seed-and-reset.md`. Inspect `git worktree list` and the current
worktree's `apps/convex/.env.local` first.

Use an isolated local deployment by default. Initialize or reselect it with
`pnpm setup:convex-local`, which preserves existing deployment variables and
syncs the local URLs to the clients. A named cloud dev deployment requires a
specific need such as a public URL, physical-device testing, a webhook, or
shared dashboard access. Never copy `.env.local` between worktrees or run two
schema-changing watchers against the same deployment.

## Agent Skills

Official Convex skills live at repo-root `.agents/skills/` with lockfile
`skills-lock.json`. Refresh them from the repo root with
`npx skills add get-convex/agent-skills --yes`. Skill auto-install is disabled
in `convex.json`; do not create a second skills tree under `apps/convex/`.
