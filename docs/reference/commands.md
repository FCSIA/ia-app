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
| `pnpm worktree:bootstrap -- [options]` | Install local dependencies and initialize an isolated local backend; use `--shared-convex` only for explicit UI work; see [Git worktrees](worktrees.md) |
| `pnpm test`             | Run test suites                                           |

## Release log

| Command                | What it does                                                  |
| ---------------------- | ------------------------------------------------------------- |
| `pnpm devlog:check`    | Verify `CHANGELOG.md` and the in-app devlog match the source   |
| `pnpm devlog:preview`  | Show the release the current commits would produce             |
| `pnpm devlog:generate` | Regenerate both outputs after editing `releases.json` by hand  |
| `pnpm devlog:cut`      | Cut the next version locally (`--minor`, `--patch`, `--set=`)  |

See [versioning and the devlog](versioning.md) for the version scheme and how
commit subjects become changelog entries.

Temporary public URL for any local port:

```bash
pnpm dlx localtunnel --port <PORT>
```

Web development through the shared LocalTunnel hostname:

```bash
pnpm dlx localtunnel --port 3000 --subdomain ia-app-dev
```

## Deploy

[`.github/workflows/prod.yml`](../../.github/workflows/prod.yml) deploys an
existing `vMAJOR.MINOR.PATCH` tag whose commit has already merged into `main`.
Prepare the generated release data in a normal PR, merge it, then push the
matching tag. Manual dispatch only retries an existing validated tag; the
workflow never writes to `main`.

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
| `pnpm setup:convex-local` | Create/select local Convex, initialize auth, and sync client URLs |
| `pnpm --filter cvx codegen`   | Regenerate Convex generated files  |
| `pnpm --filter cvx typecheck` | Typecheck Convex functions         |
| `pnpm --filter cvx deploy`    | Deploy Convex backend changes      |
| `pnpm sync:convex-env` | Sync the selected Convex URLs to the web and mobile apps |

## Demo Data

There are no local `pnpm db:seed`, `pnpm db:reset`, or `pnpm db:clear`
commands. To destructively recreate demo data on the local deployment:

```bash
pnpm --filter cvx exec convex run \
  --deployment local \
  bootstrap:resetAndSeed \
  '{"profile":"development"}'
pnpm --filter cvx exec convex run \
  --deployment local \
  bootstrap:seedStatus \
  '{}' \
  --watch
```

Seed/reset does not use `BOOTSTRAP_SECRET`. The default development profile
seeds 50 students and 119 staff; pass `{"profile":"full"}` for 1,500 students
and 119 staff. The function schedules small internal batches. The dashboard
provides the same internal functions as an alternative.

## Package Management

| Command                           | What it does                            |
| --------------------------------- | --------------------------------------- |
| `pnpm install`                    | Install dependencies for all workspaces |
| `pnpm --filter web add <package>` | Add a package to the web app            |
| `pnpm --filter cvx add <package>` | Add a package to the Convex backend     |

This repository currently pins pnpm `10.29.3` through `packageManager`. If a
newer global pnpm refuses to run, use `corepack pnpm@10.29.3 <command>`.
