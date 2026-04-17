# IA App

School communication and management platform built as a pnpm monorepo.

## Apps

- `apps/api` - NestJS API with Prisma and PostgreSQL
- `apps/web` - Next.js web app
- `apps/mobile` - Expo React Native app
- `packages/contracts` - Shared TypeScript contracts

## Requirements

- Node.js 20+
- `pnpm`
- PostgreSQL 16

Optional:

- `nix develop` or `direnv allow` to enter the repo dev shell

## Quick Start

For a brand new machine, use [SETUP.md](./SETUP.md).

For an existing machine with the toolchain installed:

```bash
cp .env.example .env
cp .env.example apps/api/.env
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

If you are using the mobile app, also copy `apps/mobile/.env.example` as needed.

## Local Services

This repo currently only needs PostgreSQL locally. Redis is not part of the active stack.

```bash
pnpm infra:up
pnpm infra:down
```

`pnpm infra:up` and `pnpm infra:down` manage PostgreSQL through Homebrew.

## Useful Commands

```bash
pnpm dev         # API + web
pnpm dev:all     # API + web + mobile
pnpm dev:mobile  # mobile only
pnpm build
pnpm lint
pnpm test
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

## Local URLs

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- Swagger: `http://localhost:3001/docs`

## Test Accounts

All demo accounts use their ID as the password.

| ID | Role |
| --- | --- |
| `SUPER001` | Super Admin |
| `ADMIN001` | Admin |
| `TCH001` | Teacher |
| `STU001` | Student |
| `STU002` | Student |
| `STU003` | Student |
| `STU004` | Student |

## Project Notes

- Package manager: `pnpm@10`
- Monorepo task runner: Turborepo
- Database: PostgreSQL via Prisma
- Shared env template: `.env.example`
