---
tags: [commands, development]
---

# Commands

[Home](../index.md)

## App

| Command                 | What it does                                              |
| ----------------------- | --------------------------------------------------------- |
| `bun run dev`              | Start the web app and Convex dev server through Turborepo |
| `bun run cvx:dev`          | Start only the Convex dev server                          |
| `bun run --filter web dev` | Start only the Next.js web app                            |
| `bun run lint`             | Lint all workspaces                                       |
| `bun run build`            | Build all workspaces                                      |
| `bun run test`             | Run test suites                                           |

## Release log

| Command                | What it does                                                  |
| ---------------------- | ------------------------------------------------------------- |
| `bun run devlog:check`    | Verify `CHANGELOG.md` and the in-app devlog match the source   |
| `bun run devlog:preview`  | Show the release the current commits would produce             |
| `bun run devlog:generate` | Regenerate both outputs after editing `releases.json` by hand  |
| `bun run release`         | Prepare a release PR (`--minor`, `--set=`, or `--dry-run`)     |

See [versioning and the devlog](versioning.md) for the version scheme and how
commit subjects become changelog entries.

Temporary public URL for any local port:

```bash
bunx localtunnel --port <PORT>
```

Web development through the shared LocalTunnel hostname:

```bash
pnpm dlx localtunnel --port 3000 --subdomain ia-app-dev
```

## Deploy

[`.github/workflows/prod.yml`](../../.github/workflows/prod.yml) deploys an
existing `vMAJOR.MINOR.PATCH` tag whose commit has already merged into `main`.
Prepare the generated release data with `bun run release`; merging its PR
creates and pushes the matching tag automatically. Humans do not create or
push release tags.

Production URL: `https://ia-app-alpha.vercel.app`

Manual deploy from the repo root:

```bash
bunx vercel --prod --yes --archive=tgz
```

GitHub Actions needs `VERCEL_TOKEN` (secret) plus `VERCEL_ORG_ID` and
`VERCEL_PROJECT_ID` (repository variables). The workflow uses `--archive=tgz`
because the monorepo exceeds Vercel's default upload file limit.

## Convex

| Command                       | What it does                       |
| ----------------------------- | ---------------------------------- |
| `bun run db:generate`            | Regenerate Convex generated files  |
| `bun run db:studio`              | Start Convex dev/dashboard tooling |
| `bun run setup:convex-local` | Create/select local Convex, initialize auth, and sync client URLs |
| `bun run --filter cvx codegen`   | Regenerate Convex generated files  |
| `bun run --filter cvx typecheck` | Typecheck Convex functions         |
| `bun run --filter cvx deploy`    | Deploy Convex backend changes      |
| `bun run sync:convex-env` | Sync the selected Convex URLs to the web and mobile apps |

## Demo Data

There are no local `bun run db:seed`, `bun run db:reset`, or `bun run db:clear`
commands. To destructively recreate demo data on the local deployment:

```bash
bun run --filter cvx exec convex run \
  --deployment local \
  bootstrap:resetAndSeed \
  '{"profile":"development"}'
bun run --filter cvx exec convex run \
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
| `bun install`                    | Install dependencies for all workspaces |
| `bun add --filter web <package>` | Add a package to the web app            |
| `bun add --filter cvx <package>` | Add a package to the Convex backend     |

CI pins Bun through `packageManager`; local developers must install Bun
separately and may use a newer compatible release. Use Bun for installs and
scripts; do not regenerate the lockfile with another tool.

## Security audit

Contributor Validation builds a production-only inventory from `bun.lock` and
scans it with OSV-Scanner. Required runtime edges establish the production
closure; optional edges are included only when their resolved instance is also
independently selected by that closure. This excludes unused optional-peer
artifacts without excluding selected runtime optionals, and excludes workspace
`devDependencies` while retaining the two known `image-size` findings as
reported, accepted production exceptions.
The raw `bun audit --prod` command is not the CI production gate because Bun
can include workspace tooling and optional-peer resolution paths in its output.
