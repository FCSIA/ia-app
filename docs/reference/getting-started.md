---
tags: [setup, development, convex]
---

# Getting Started

[Home](../index.md)

The current app runs on Next.js plus Convex. The old Prisma/PostgreSQL API is no
longer part of the active local setup.

## First Run

Use Node.js 20.19 or newer. The Codex/development environment currently uses
Node 24.

```bash
cp .env.example .env
pnpm install
pnpm --filter cvx exec convex deployment create local
pnpm --filter cvx exec convex deployment select local
pnpm sync:convex-env
pnpm dev
```

Create the local deployment once per worktree; select it and sync the frontend
environment before starting `pnpm dev`. Do not copy `apps/convex/.env.local`
from another worktree.

## Browser Push Keys

Browser push is optional for basic local development, but the notification
settings page expects VAPID keys before push can be enabled.

Generate one key pair:

```bash
pnpm --filter cvx exec web-push generate-vapid-keys
```

Set the generated public key in `apps/web/.env.local`:

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
```

Set the matching Convex deployment variables:

```bash
pnpm --filter cvx exec convex env set VAPID_PUBLIC_KEY "..."
pnpm --filter cvx exec convex env set VAPID_PRIVATE_KEY "..."
pnpm --filter cvx exec convex env set VAPID_SUBJECT "mailto:admin@example.com"
```

If `pnpm` is provided by the repo's direnv shell, prefix these commands with
`direnv exec .`.

## Demo Data

Demo data is reset from the Convex Dashboard, not through a local CLI command.
Run the internal function:

```text
bootstrap:resetAndSeed
```

This destructively recreates seeded users, clubs, courses, announcements,
schedules, friendships, moderation keywords, and notification preferences. It
defaults to a 50-student, 119-staff development profile; pass
`{"profile":"full"}` only for the 1,500-student full profile. The function
schedules small internal batches; `bootstrap:seedStatus` reports `COMPLETE` or
`FAILED` with the run's completion time or error.

## Daily Workflow

```bash
pnpm dev
```

Useful focused commands:

```bash
pnpm db:generate
pnpm --filter cvx typecheck
pnpm lint
pnpm build
```

## Demo Accounts

Seeded accounts use their unique ID as the password, for example:

- `SUPER001` / `SUPER001`
- `ADMIN001` / `ADMIN001`
- `TCH001` / `TCH001`
- `STU001` / `STU001`
