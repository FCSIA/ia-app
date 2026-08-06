---
tags: [commands, development]
---

# Commands

[Home](../index.md)

## App

| Command                 | What it does                                              |
| ----------------------- | --------------------------------------------------------- |
| `pnpm dev`              | Start the web app and Convex dev server through Turborepo |
| `pnpm cvx:dev`          | Start only the Convex dev server                          |
| `pnpm --filter web dev` | Start only the Next.js web app                            |
| `pnpm lint`             | Lint all workspaces                                       |
| `pnpm build`            | Build all workspaces                                      |
| `pnpm test`             | Run test suites                                           |

## Deploy

Pushes to `main` deploy the web app to Vercel production via
[`.github/workflows/vercel-production.yml`](../../.github/workflows/vercel-production.yml).

Production URL: `https://ia-app-alpha.vercel.app`

Manual deploy from the repo root:

```bash
pnpx vercel --prod --yes --archive=tgz
```

GitHub Actions needs `VERCEL_TOKEN` (secret) plus `VERCEL_ORG_ID` and
`VERCEL_PROJECT_ID` (repository variables). The workflow uses `--archive=tgz`
because the monorepo exceeds Vercel's default upload file limit.

## Convex

| Command                       | What it does                       |
| ----------------------------- | ---------------------------------- |
| `pnpm db:generate`            | Regenerate Convex generated files  |
| `pnpm db:studio`              | Start Convex dev/dashboard tooling |
| `pnpm --filter cvx codegen`   | Regenerate Convex generated files  |
| `pnpm --filter cvx typecheck` | Typecheck Convex functions         |
| `pnpm --filter cvx deploy`    | Deploy Convex backend changes      |
| `pnpm --filter cvx exec convex deployment create local` | Create this worktree's local backend once |
| `pnpm --filter cvx exec convex deployment select local` | Select this worktree's local backend |
| `pnpm sync:convex-env` | Sync the selected Convex URLs to the web app |

## Demo Data

There are no local `pnpm db:seed`, `pnpm db:reset`, or `pnpm db:clear`
commands. To destructively recreate demo data, open the Convex Dashboard and run
the internal function:

```text
bootstrap:resetAndSeed
```

Seed/reset does not use `BOOTSTRAP_SECRET`. The default development profile
seeds 50 students and 119 staff; pass `{"profile":"full"}` for 1,500 students
and 119 staff. The function schedules small internal batches.
`bootstrap:seedStatus` reads the seed run and reports `IDLE`, `RUNNING`,
`COMPLETE`, or `FAILED`, including completion time and any error.

## Package Management

| Command                           | What it does                            |
| --------------------------------- | --------------------------------------- |
| `pnpm install`                    | Install dependencies for all workspaces |
| `pnpm --filter web add <package>` | Add a package to the web app            |
| `pnpm --filter cvx add <package>` | Add a package to the Convex backend     |

This repository currently pins pnpm `10.29.3` through `packageManager`. If a
newer global pnpm refuses to run, use `corepack pnpm@10.29.3 <command>`.
