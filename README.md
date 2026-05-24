# IA School App

A full-stack school communication and management platform for FCS Innovation Academy.

## For Coding Agents

Read [AGENTS.md](./AGENTS.md) before making changes. Keep agent workflow and handoff notes out of this README.

## What It Includes

- Authentication with JWT sessions and role-based access
- Announcements, comments, moderation, and notification preferences
- Clubs, channels, invites, membership, and leader/sponsor workflows
- Events, calendar entries, Flex Friday sessions, and student schedules
- Admin user management, audit logging, and demo seed data

## Tech Stack

| Layer | Technology |
|-------|------------|
| Web | Next.js 15, React 19, Tailwind CSS, shadcn/ui |
| API | NestJS, TypeScript, Swagger |
| Database | PostgreSQL 16, Prisma |
| Tooling | pnpm workspaces, Turborepo |

## Project Structure

```text
ia-app/
├── apps/api/       # NestJS API, Prisma schema, seed data
├── apps/web/       # Next.js web app
├── docs/           # Product, architecture, setup, and reference docs
├── infra/          # Infrastructure helpers
├── AGENTS.md       # Agent workflow rules
├── SETUP.md        # Full new-machine setup guide
└── .env.example    # Environment variable template
```

## Quick Start

For a full setup walkthrough, use [SETUP.md](./SETUP.md). Technical setup details live in [docs/reference/getting-started.md](./docs/reference/getting-started.md), [docs/reference/environment.md](./docs/reference/environment.md), and [docs/database/database-overview.md](./docs/database/database-overview.md).

```bash
git clone https://github.com/virajdas/ia-app.git
cd ia-app
cp .env.example .env
cp .env.example apps/api/.env
pnpm install
```

Start PostgreSQL, then prepare the database:

```bash
pnpm infra:up       # macOS/Homebrew
pnpm infra:up:win   # Windows

pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Optional Nix + direnv users can run `direnv allow` instead of the Homebrew/Windows database startup path. See [SETUP.md](./SETUP.md#nix--direnv-setup).

Start the app:

```bash
pnpm dev
```

| Service | URL |
|---------|-----|
| Web | http://localhost:3000 |
| API | http://localhost:3001 |
| Swagger | http://localhost:3001/docs |

Demo accounts are seeded with their ID as the password, for example `STU001` / `STU001`. See [docs/database/seed.md](./docs/database/seed.md) for the seed data.

## Common Commands

```bash
pnpm dev          # Start web + API
pnpm lint         # Lint all workspaces
pnpm build        # Build all workspaces
pnpm test         # Run tests
pnpm db:migrate   # Apply Prisma migrations
pnpm db:reset     # Reset and reseed local database
pnpm db:studio    # Open Prisma Studio
```

More commands are documented in [docs/reference/commands.md](./docs/reference/commands.md).

## Deployment

The deployment shape should stay boring and maintainable. Production is modeled as **Next.js** plus **Convex Cloud** (data, real-time, and file storage). The app is not a static site.

**Full guide:** [docs/reference/deployment-options.md](./docs/reference/deployment-options.md) — Vercel vs Azure hosting options, Convex CI/CD, and scale planning (~1,600 students, few hundred online at peak).

The detailed architecture and feature list lives in [docs/architecture/diagram-inventory.md](./docs/architecture/diagram-inventory.md). Draw production as **Next.js → Convex Cloud** (not NestJS/PostgreSQL).

**Typical choices:** Vercel + Convex (simplest ops), or **Azure Container Apps + Convex** if the frontend must stay in the school Azure subscription.

## Documentation

- [docs/index.md](./docs/index.md) — Documentation map
- [docs/architecture/overview.md](./docs/architecture/overview.md) — System overview
- [docs/architecture/tech-stack.md](./docs/architecture/tech-stack.md) — Tooling and framework details
- [docs/reference/roles-and-permissions.md](./docs/reference/roles-and-permissions.md) — Role capability reference
- [docs/backend/backend-overview.md](./docs/backend/backend-overview.md) — API overview
- [docs/frontend/frontend-overview.md](./docs/frontend/frontend-overview.md) — Web overview

## License

Private project for FCS Innovation Academy.
