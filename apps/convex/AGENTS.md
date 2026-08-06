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

Use an isolated local deployment by default. Create/select it with
`pnpm --filter cvx exec convex deployment create local` (once), then
`pnpm --filter cvx exec convex deployment select local` and
`pnpm sync:convex-env`. A named cloud dev deployment requires a specific need
such as a public URL, physical-device testing, a webhook, or shared dashboard
access. Never copy `.env.local` between worktrees or run two schema-changing
watchers against the same deployment.
