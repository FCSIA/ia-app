# IA School App

A full-stack school communication and management platform for FCS Innovation Academy.

## For Coding Agents

Read [AGENTS.md](./AGENTS.md) before making changes. Keep agent workflow and handoff notes out of this README.

## What It Includes

- Authentication with Better Auth on Convex and role-based access
- Announcements, comments, moderation, and notification preferences
- Clubs, channels, invites, membership, and leader/sponsor workflows
- Events, calendar entries, Flex Friday sessions, and student schedules
- Admin user management, audit logging, and demo seed data

## Tech Stack

| Layer              | Technology                                                  |
| ------------------ | ----------------------------------------------------------- |
| Web                | Next.js 15, React 19, Tailwind CSS, shadcn/ui               |
| Backend & Database | Convex (Reactive Functions, Database, Search, File Storage) |
| Tooling            | pnpm workspaces, Turborepo                                  |

## Project Structure

```text
ia-app/
├── apps/web/       # Next.js 15 web app
├── apps/convex/    # Convex backend (schema, functions, auth, storage)
├── docs/           # Current product, architecture, backend, frontend docs
├── packages/       # Transitional shared packages
├── AGENTS.md       # Agent workflow rules
├── SETUP.md        # Full developer setup guide
└── PORTING.md      # Historical backend-to-Convex migration context
```

## Quick Start

For a full setup walkthrough, use [SETUP.md](./SETUP.md).

```bash
git clone https://github.com/virajdas/ia-app.git
cd ia-app
cp .env.example .env
pnpm install
```

Start the application (Next.js frontend and Convex dev server in parallel):

```bash
pnpm dev
```

On a new checkout, run `pnpm convex:dev` once first so Convex can select or create a dev deployment and write `CONVEX_DEPLOYMENT` to `apps/convex/.env.local`.

Demo seed/reset is intentionally dashboard-only. In the Convex Dashboard, run
the internal function `bootstrap:resetAndSeed` to schedule a destructive reset,
then run `bootstrap:seedStatus` to watch progress.

| Service          | URL                                                    |
| ---------------- | ------------------------------------------------------ |
| Web App          | http://localhost:3000                                  |
| Convex Dashboard | https://dashboard.convex.dev (or run `pnpm db:studio`) |

Demo accounts are seeded with their ID as the password, for example `STU001` / `STU001`. See [SETUP.md](./SETUP.md#5-test-accounts) for a complete list of demo logins.

## Common Commands

```bash
pnpm dev          # Start web app and Convex dev server in parallel
pnpm db:studio    # Open local/dev Convex Dashboard console
pnpm lint         # Lint all workspaces
pnpm build        # Build all workspaces for production
pnpm test         # Run test suites
```

---

## Deployment

The active deployment model is a Next.js frontend plus Convex backend.

```text
Users -> Next.js Web App (Vercel / Azure App Service)
           └─> [React Hooks / Subscriptions] ──> Convex Cloud (Managed Serverless Backend)
```

### 1. Backend Deployment (Convex)

Convex manages database hosting, file storage, serverless functions, and scaling automatically. To deploy backend changes to production:

```bash
pnpm --filter cvx deploy
```

This pushes your schema, indexes, and server functions to your production Convex deployment. Auth credentials and other runtime secrets are configured securely via the Convex Dashboard.

### 2. Frontend Deployment (Next.js)

The Next.js frontend can be deployed anywhere that supports Node.js or edge runtimes:

- **Vercel**: The native hosting environment for Next.js, offering optimal performance and automatic zero-config deployments.
- **Azure App Service / Azure Container Apps**: Suitable for school environments that require hosting within an enterprise cloud subscription. The web app runs as a lightweight Docker container.
- **Generic Single Server**: A simple Linux virtual machine running the Next.js server behind a reverse proxy.

### React Server Components (RSC)

Next.js App Router and React Server Components are fully supported. Since database operations and reactive subscriptions go directly from the client and server to Convex's real-time API, the web app scales horizontally without maintaining stateful database connection pools.

---

## Documentation

- [SETUP.md](./SETUP.md) — Step-by-step developer environment setup.
- [docs/index.md](./docs/index.md) — Current documentation hub.
- [docs/architecture/overview.md](./docs/architecture/overview.md) — Current Convex-era architecture.
- [docs/backend/convex-overview.md](./docs/backend/convex-overview.md) — Backend function layout and rules.
- [docs/frontend/frontend-overview.md](./docs/frontend/frontend-overview.md) — Frontend structure and conventions.
- [PORTING.md](./PORTING.md) — Historical migration context, not the active operating manual.

## License

Private project for FCS Innovation Academy.
