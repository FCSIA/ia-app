---
tags: [setup, development, convex]
---

# Getting Started

[Home](../index.md)

The current app runs on Next.js plus Convex. The old Prisma/PostgreSQL API is no
longer part of the active local setup.

## Prerequisites

- **Node.js**: v24.22.1 or a newer v24 security release (see `.node-version`)
- **Bun**: the Nix shell provides the version recorded by `packageManager` in
  `package.json`, matching CI. Without Nix, install that version separately.

### Optional: Nix + direnv (macOS / Linux)

If you use Nix and direnv, Bun, Node 24, and the repository's native development
tools load automatically:

```bash
direnv allow
```

Use `direnv reload` after changing the shell configuration, or `nix develop`
without direnv. When upgrading `packageManager`, update the corresponding Bun
release hashes in `flake.nix` as well. Node upgrades must update `.node-version`,
the Node release hashes in `flake.nix`, and the supported range in `package.json`.
CI reads `.node-version`.

## First Run

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Install dependencies
bun install

# 3. Create/select this worktree's local Convex deployment, initialize its
#    Better Auth environment, and sync its URLs to the frontend apps
bun run setup:convex-local

# 4. Start development servers
bun run dev
```

> [!IMPORTANT]
> Run `bun run setup:convex-local` once in each worktree and whenever its local
> deployment selection needs repair. The command preserves existing deployment
> secrets and settings. Do not copy `apps/convex/.env.local` from another
> worktree.

For a short-lived UI-only worktree that can reuse an existing dependency install
and explicitly selected client environment files, see [Git worktrees](worktrees.md).

## Browser Push Keys (Optional)

Browser push is optional for basic local development, but notification
settings expect VAPID keys before push can be enabled.

1. Generate key pair:

   ```bash
   bun run --cwd apps/convex web-push generate-vapid-keys
   ```

2. Set public key in `apps/web/.env.local`:

   ```env
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
   ```

3. Set matching deployment variables on Convex:

   ```bash
   bun run --cwd apps/convex convex env set VAPID_PUBLIC_KEY "..."
   bun run --cwd apps/convex convex env set VAPID_PRIVATE_KEY "..."
   bun run --cwd apps/convex convex env set VAPID_SUBJECT "mailto:admin@example.com"
   ```

   *(Prefix commands with `direnv exec .` if using Nix/direnv).*

## Demo Data & Reset

Reset the local demo data from the CLI:

```bash
bun run --cwd apps/convex convex run \
  --deployment local \
  bootstrap:resetAndSeed \
  '{"profile":"development"}'
```

Monitor the asynchronous run:

```bash
bun run --cwd apps/convex convex run \
  --deployment local \
  bootstrap:seedStatus \
  '{}' \
  --watch
```

This destructively recreates seeded users, clubs, courses, announcements,
schedules, friendships, moderation keywords, and notification preferences. It
defaults to a 50-student, 119-staff development profile; pass
`{"profile":"full"}` only for the 1,500-student full profile. The dashboard
also provides these internal functions when a visual workflow is preferred.

## Demo Accounts

Seeded accounts receive random temporary passwords. After `seedStatus` reports
`COMPLETE`, run `bootstrap:claimSeedCredentials` with that run id. Repeat while
`remaining` is `true`; claimed batches are immediately deleted and unclaimed
credentials expire after 24 hours. The generated IDs include:

- `SUPER001` (Super Admin)
- `ADMIN001` (School Admin)
- `TCH001` (Teacher / Staff)
- `STU001` (Student)

## Daily Workflow & Commands

```bash
bun run dev              # Start web app and Convex dev server
bun run db:studio        # Open Convex Dashboard in browser
bun run --filter cvx typecheck # Typecheck Convex functions
bun run --filter web typecheck # Typecheck web frontend
bun run lint             # Run linter
bun run build            # Production build check
```

## Troubleshooting

### Missing Convex Deployment Error

If you see `Convex is not configured for this checkout`:

```bash
bun run setup:convex-local
```

### Stale Build Caches

If Turborepo or Next.js build caches are stale:

```bash
rm -rf .turbo apps/web/.next
bun run build
```
