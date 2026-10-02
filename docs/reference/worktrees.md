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
bun run worktree:bootstrap
```

The bootstrap command installs local `node_modules` directories from Bun's
shared package cache and creates/selects an isolated local Convex backend. It
does not symlink `node_modules`: Turbopack rejects dependency symlinks that point outside the
worktree. After it completes, start the full local app with:

```bash
bun run dev
```

### LAN devices

The isolated backend defaults to loopback URLs, which work only on the Mac running
the local backend. To use the app from another device on the same network, set
the development Mac's current LAN IPv4 address, then restart `bun run dev`:

```bash
bun run sync:convex-env -- --host <LAN IPv4>
bun run dev
```

Use the same LAN address when opening the web app on the device, for example
`http://10.0.0.231:3000`. Reset to loopback for desktop-only work with
`bun run sync:convex-env -- --host 127.0.0.1`.

When using shared configuration, syncing client URLs also updates the primary
worktree because the environment files are linked.

## Optional and isolated configuration

Use `--shared-convex` only for a short-lived UI task that explicitly needs the
primary worktree's local data and backend:

```bash
bun run worktree:bootstrap -- --shared-convex
```

Shared mode links `.env.local`, client environment files,
`apps/convex/.env.local`, and local Convex state. It also makes `bun run dev`
start only the web server, so it cannot start a second Convex watcher. Start
the Convex watcher from the primary worktree first. Changes to linked files,
backend data, and deployed functions affect the primary worktree too.

Pass `--no-convex` when neither shared nor isolated backend setup is wanted.
In that mode, environment files are opt-in:

```bash
bun run worktree:bootstrap -- --no-convex --env .env.local
```

Do not run `bun run setup:convex-local` or `bun run sync:convex-env` while using
shared configuration: rerun bootstrap without `--shared-convex` first.

## Customize or opt out

Pass `--no-dependencies` to skip the local dependency install; run
`bun install` before starting the app in that case. Repeat `--env` to link
additional local files. Choose another source checkout with `--from <path>`,
preview work with `--dry-run`, and repoint only an existing symlink with
`--replace-symlinks`. The command never replaces a real file, so remove or
rename a local file before linking it.

Keep build output and caches local to each worktree: `.next`, `.turbo`, Expo
state, coverage, and generated artifacts must not be linked. When dependencies
or the lockfile change, run `bun install` in the primary worktree, then rerun
the bootstrap command in the dependent worktree if its links need repair.
