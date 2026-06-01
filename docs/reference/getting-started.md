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
pnpm convex:dev
pnpm dev
```

Run `pnpm convex:dev` once interactively so Convex can select or create a dev
deployment and write the deployment settings.

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
