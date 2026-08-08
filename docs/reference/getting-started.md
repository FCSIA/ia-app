---
tags: [setup, development, convex]
---

# Getting Started

[Home](../index.md)

The current app runs on Next.js plus Convex. The old Prisma/PostgreSQL API is no
longer part of the active local setup.

## Prerequisites

- **Node.js**: v24 (or v20.19+)
- **pnpm**: v10.29.3 (matching `packageManager` in `package.json`)

### Optional: Nix + direnv (macOS / Linux)

If you use Nix and direnv, dependencies and Node versions load automatically:

```bash
direnv allow
```

## First Run

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Install dependencies
pnpm install

# 3. Create/select this worktree's local Convex deployment, initialize its
#    Better Auth environment, and sync its URLs to the frontend apps
pnpm setup:convex-local

# 4. Start development servers
pnpm dev
```

> [!IMPORTANT]
> Run `pnpm setup:convex-local` once in each worktree and whenever its local
> deployment selection needs repair. The command preserves existing deployment
> secrets and settings. Do not copy `apps/convex/.env.local` from another
> worktree.

## Browser Push Keys (Optional)

Browser push is optional for basic local development, but notification
settings expect VAPID keys before push can be enabled.

1. Generate key pair:

   ```bash
   pnpm --filter cvx exec web-push generate-vapid-keys
   ```

2. Set public key in `apps/web/.env.local`:

   ```env
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
   ```

3. Set matching deployment variables on Convex:

   ```bash
   pnpm --filter cvx exec convex env set VAPID_PUBLIC_KEY "..."
   pnpm --filter cvx exec convex env set VAPID_PRIVATE_KEY "..."
   pnpm --filter cvx exec convex env set VAPID_SUBJECT "mailto:admin@example.com"
   ```

   *(Prefix commands with `direnv exec .` if using Nix/direnv).*

## Demo Data & Reset

Reset the local demo data from the CLI:

```bash
pnpm --filter cvx exec convex run \
  --deployment local \
  bootstrap:resetAndSeed \
  '{"profile":"development"}'
```

Monitor the asynchronous run:

```bash
pnpm --filter cvx exec convex run \
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

Seeded accounts use their unique ID as the password:

- `SUPER001` / `SUPER001` (Super Admin)
- `ADMIN001` / `ADMIN001` (School Admin)
- `TCH001` / `TCH001` (Teacher / Staff)
- `STU001` / `STU001` (Student)

## Daily Workflow & Commands

```bash
pnpm dev              # Start web app and Convex dev server
pnpm db:studio        # Open Convex Dashboard in browser
pnpm --filter cvx typecheck # Typecheck Convex functions
pnpm --filter web exec tsc --noEmit # Typecheck web frontend
pnpm lint             # Run linter
pnpm build            # Production build check
```

## Troubleshooting

### Missing Convex Deployment Error

If you see `Convex is not configured for this checkout`:

```bash
pnpm setup:convex-local
```

### Stale Build Caches

If Turborepo or Next.js build caches are stale:

```bash
rm -rf .turbo apps/web/.next
pnpm build
```
