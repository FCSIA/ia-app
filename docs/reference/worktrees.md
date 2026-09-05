---
tags: [reference, development, worktrees]
---

# Git Worktrees

[Home](../index.md)

Git worktrees let a developer keep a small fix or review open without changing
their main checkout. Each worktree has its own Git branch and generated state.

## Create and bootstrap a worktree

From the primary checkout:

```bash
git worktree add -b fix/button-spacing ../ia-app-button-spacing main
cd ../ia-app-button-spacing
pnpm worktree:bootstrap
```

The bootstrap command links the root and workspace `node_modules` directories
and local environment files, including the primary worktree's local Convex
configuration and data. After it completes, start the full local app with:

```bash
pnpm dev
```

> [!WARNING]
> The default configuration shares one stateful local Convex backend. Run only
> one `pnpm dev` or `pnpm cvx:dev` watcher against it at a time. Stop the other
> worktree's watcher before starting this one; otherwise two branches can deploy
> incompatible schema/function code to the same local data.

## Optional and isolated configuration

Use `--isolated-convex` when the worktree needs its own local data and backend.
It creates/selects that isolated backend and writes worktree-local web and
mobile URLs:

```bash
pnpm worktree:bootstrap -- --isolated-convex
```

Pass `--no-convex` when neither shared nor isolated backend setup is wanted.
In that mode, environment files are opt-in:

```bash
pnpm worktree:bootstrap -- --no-convex --env .env.local
```

The shared default links `.env.local`, all client environment files,
`apps/convex/.env.local`, and the local Convex state. Changes to any of those
files or backend data affect the primary worktree too. Do not run
`pnpm setup:convex-local` or `pnpm sync:convex-env` while using shared
configuration: use `--isolated-convex` first.

## Customize or opt out

Pass `--no-dependencies` when you want a separate install; run `pnpm install`
before `--isolated-convex` setup in that case. Repeat `--env` to link additional
local files. Choose another source checkout with `--from <path>`, preview work
with `--dry-run`, and repoint only an existing symlink with
`--replace-symlinks`. The command never replaces a real file, so remove or
rename a local file before linking it.

Keep build output and caches local to each worktree: `.next`, `.turbo`, Expo
state, coverage, and generated artifacts must not be linked. When dependencies
or the lockfile change, run `pnpm install` in the primary worktree, then rerun
the bootstrap command in the dependent worktree if its links need repair.
