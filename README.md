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

The deployment shape should stay boring and maintainable. This app is not a static site: the web app is a Next.js server, the API is a NestJS server, and the database is PostgreSQL. Uploaded files are currently stored on disk by the API, so production backups must include both PostgreSQL and the upload directory.

The detailed architecture and feature list lives in [docs/architecture/diagram-inventory.md](./docs/architecture/diagram-inventory.md). Use that doc when explaining what belongs in a system diagram, including the baseline server/database version and the hypothetical Azure version.

### React Server Components

Next.js App Router and React Server Components are compatible with all server-based scenarios below as long as the Next.js app runs as a Node server or container. RSC does **not** mean the app can be deployed as static files.

The current app is mostly client-rendered and stores auth in browser `localStorage`. That is simple, but it limits useful RSC adoption because server components cannot read a browser-only JWT. A serious RSC migration should first decide whether auth moves to secure HttpOnly cookies, then migrate read-heavy pages gradually.

### Scenario 1: Generic Single Server

This is the simplest private-school deployment model:

```text
Users
  -> HTTPS reverse proxy
  -> Next.js web app
  -> NestJS API
  -> PostgreSQL database
  -> Upload directory on persistent disk
```

This can run on one Linux server or VM with Docker Compose. It is the easiest option to understand and operate, but the school or project owner is responsible for OS patching, backups, monitoring, and recovery.

RSC: The server already has to run Node for Next.js, so RSC does not materially change this scenario. The important requirement is that the reverse proxy forwards requests to the Next.js server instead of serving static build files.

### Scenario 2: Azure VM

If the school closes on Azure but wants to avoid many separate cloud services, the most practical Azure version is still a single-server design:

```text
Azure Linux VM
  -> reverse proxy container
  -> Next.js container
  -> NestJS API container
  -> PostgreSQL container or attached database
  -> persistent upload volume
```

This keeps the architecture close to the generic server model while giving the school Azure billing, access controls, networking, backups, and administrative ownership. For this project, that is probably the best balance between privacy, cost, and maintainability.

RSC: This scenario is essentially the generic single-server setup running inside Azure. The Next.js container can serve App Router/RSC pages normally.

### Scenario 3: More Managed Azure

A more managed Azure setup can split responsibilities across services:

- Azure App Service or Container Apps for the web/API containers.
- Azure Database for PostgreSQL for managed database backups and patching.
- Azure Blob Storage for uploaded files.
- Azure Key Vault for secrets.
- Azure Monitor/Application Insights for logs and metrics.

This is more sustainable if the app becomes important school infrastructure, because less operational risk sits on one VM. The tradeoff is complexity: more Azure services, more configuration, more security review, and more things for someone to own long-term.

RSC: Azure App Service or Container Apps can run the Next.js server/container, but Azure Static Web Apps or static blob hosting are not a fit for full RSC/App Router runtime behavior. Managed Azure also makes cookie/session, API origin, and private networking choices more important.

### Sustainability Recommendation

For a school-private app, the best starting point is usually **Azure VM + Docker Compose + managed backups**. It keeps the system small enough for students/staff to reason about while giving the school an official cloud environment and recovery path.

If the app becomes production-critical, the first upgrade should be moving PostgreSQL to managed Azure Database for PostgreSQL. The second upgrade should be moving uploaded files to Azure Blob Storage. Those two changes reduce the biggest long-term risks: database loss and file backup mistakes.

## Documentation

- [docs/index.md](./docs/index.md) — Documentation map
- [docs/architecture/overview.md](./docs/architecture/overview.md) — System overview
- [docs/architecture/tech-stack.md](./docs/architecture/tech-stack.md) — Tooling and framework details
- [docs/reference/roles-and-permissions.md](./docs/reference/roles-and-permissions.md) — Role capability reference
- [docs/backend/backend-overview.md](./docs/backend/backend-overview.md) — API overview
- [docs/frontend/frontend-overview.md](./docs/frontend/frontend-overview.md) — Web overview

## License

Private project for FCS Innovation Academy.
