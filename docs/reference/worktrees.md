---
tags: [reference, development, worktrees]
---

# Git Worktrees

[Home](../index.md)

Git worktrees let a developer keep a small fix or review open without changing
their main checkout. Each worktree has its own Git branch and generated state.

## Create and bootstrap a UI worktree

From the primary checkout:

```bash
git worktree add -b fix/button-spacing ../ia-app-button-spacing main
cd ../ia-app-button-spacing
pnpm worktree:bootstrap
```

The bootstrap command links the root and workspace `node_modules` directories
from Git's primary worktree. It does not run an install, link environment files,
or link build output. Use `pnpm --filter web dev` for a web-only UI change.

## Optional shared local configuration

Environment files are deliberately opt-in. Link only files whose shared values
you need:

```bash
pnpm worktree:bootstrap -- \
  --env .env.local \
  --env apps/web/.env.local \
  --env apps/mobile/.env.local
```

`apps/web/.env.local` and `apps/mobile/.env.local` include the client URLs for
the source worktree's selected backend. This is useful for a short-lived UI-only
worktree when that backend watcher is already running. Changes made to a linked
file change the source worktree too.

Never link `apps/convex/.env.local`. It selects a stateful Convex deployment,
and sharing it can make two branches write to the same data or deploy to the
same backend. The bootstrap command rejects that path. A worktree that needs
backend development must keep its own file and run:

```bash
pnpm setup:convex-local
```

Do not run `pnpm setup:convex-local`, `pnpm sync:convex-env`, or a Convex
watcher from a worktree whose web or mobile environment file is linked: those
commands write client URLs and would modify the source worktree's file. Remove
the link and initialize the worktree's own local backend first.

## Customize or opt out

Pass `--no-dependencies` when you want a separate install. Repeat `--env` to
select exactly the local files to share; omitting it shares no environment
files. Choose another source checkout with `--from <path>`, preview work with
`--dry-run`, and repoint only an existing symlink with `--replace-symlinks`.
The command never replaces a real file, so remove or rename a local file before
linking it.

Keep build output and caches local to each worktree: `.next`, `.turbo`, Expo
state, coverage, and generated artifacts must not be linked. When dependencies
or the lockfile change, run `pnpm install` in the primary worktree, then rerun
the bootstrap command in the dependent worktree if its links need repair.
