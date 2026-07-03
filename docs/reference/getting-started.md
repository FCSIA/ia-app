---
tags: [setup, development, convex]
---

# Getting Started

[Home](../index.md)

The current app runs on Next.js plus Convex. The old Prisma/PostgreSQL API is no
longer part of the active local setup.

## First Run

```bash
cp .env.example .env
pnpm install
pnpm cvx:dev
pnpm dev
```

Run `pnpm cvx:dev` once interactively so Convex can select or create a dev
deployment and write the deployment settings.

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
schedules, friendships, moderation keywords, and notification preferences.
The function schedules small internal batches; run the internal query
`bootstrap:seedStatus` to watch progress.

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
