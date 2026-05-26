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
| Backend & Database | Convex (Reactive Functions, Database, Search, File Storage) |
| Tooling | pnpm workspaces, Turborepo |

## Project Structure

```text
ia-app/
├── apps/web/       # Next.js 15 web app
├── apps/convex/    # Convex backend (schema, query/mutation functions, custom auth)
├── docs/           # Product and feature documentation
├── packages/       # Shared utility packages and contracts
├── AGENTS.md       # Agent workflow rules
├── SETUP.md        # Full developer setup guide
└── PORTING.md      # Detailed backend-to-Convex replatform guide
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

Seed the database with demo accounts and data (requires `BOOTSTRAP_SECRET` set in `.env`):

```bash
pnpm db:seed
```

| Service | URL |
|---------|-----|
| Web App | http://localhost:3000 |
| Convex Dashboard | https://dashboard.convex.dev (or run `pnpm db:studio`) |

Demo accounts are seeded with their ID as the password, for example `STU001` / `STU001`. See [SETUP.md](./SETUP.md#5-test-accounts) for a complete list of demo logins.

## Common Commands

```bash
pnpm dev          # Start web app and Convex dev server in parallel
pnpm db:seed      # Seed Convex database (requires BOOTSTRAP_SECRET)
pnpm db:reset     # Reset and re-seed database (requires BOOTSTRAP_SECRET)
pnpm db:studio    # Open local/dev Convex Dashboard console
pnpm lint         # Lint all workspaces
pnpm build        # Build all workspaces for production
pnpm test         # Run test suites
```

---

## Deployment

With the replatform to **Convex**, the deployment model is highly streamlined, secure, and modern. 

```text
Users -> Next.js Web App (Vercel / Azure App Service)
           └─> [React Hooks / Subscriptions] ──> Convex Cloud (Managed Serverless Backend)
```

### 1. Backend Deployment (Convex)
Convex manages database hosting, file storage, serverless functions, and scaling automatically. To deploy backend changes to production:
```bash
pnpm deploy
```
This pushes your schema, indexes, and server functions to your production Convex deployment. All secrets (like `BOOTSTRAP_SECRET` and auth credentials) are configured securely via the Convex Dashboard.

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
- [PORTING.md](./PORTING.md) — Comprehensive reference of architecture decisions and data mapping during the NestJS-to-Convex port.
- [docs/features/notifications.md](./docs/features/notifications.md) — Scoped notification preference systems.
- [docs/features/clubs.md](./docs/features/clubs.md) — Club roles, invite systems, and visibility rules.

## License

Private project for FCS Innovation Academy.
