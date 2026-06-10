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
| Web                | Next.js 16, React 19, Tailwind CSS, shadcn/ui               |
| Backend & Database | Convex (Reactive Functions, Database, Search, File Storage) |
| Tooling            | pnpm workspaces, Turborepo                                  |

## Project Structure

```text
ia-app/
├── apps/web/       # Next.js 16 web app
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

Open Convex dashboard:

```bash
pnpm --filter cvx exec convex dash
pnpm --filter cvx exec convex dashboard
```

> [!IMPORTANT]
> Do not run `pnpx convex dev`, `npx convex dev`, or other Convex commands from the repository root. This monorepo's Convex app lives in `apps/convex`, so root-level Convex commands can initialize and push an empty `convex/` app. Use `pnpm --filter cvx ...` from the root instead.

On a new checkout or new Convex project:

```bash
pnpm --filter cvx dev          # link/create deployment → apps/convex/.env.local
pnpm sync:convex-env           # copy Convex URLs into apps/web/.env.local
```

Then set required secrets on the **new** deployment (once):

```bash
pnpm --filter cvx exec convex env set BETTER_AUTH_SECRET "<long-random-string>"
pnpm --filter cvx exec convex env set SITE_URL http://localhost:3000
```

Browser push also needs VAPID keys. Generate one key pair, put the public key in
`apps/web/.env.local`, and set the matching Convex deployment values:

```bash
pnpm --filter cvx exec web-push generate-vapid-keys
pnpm --filter cvx exec convex env set VAPID_PUBLIC_KEY "<public-key>"
pnpm --filter cvx exec convex env set VAPID_PRIVATE_KEY "<private-key>"
pnpm --filter cvx exec convex env set VAPID_SUBJECT "mailto:admin@example.com"
```

Then seed demo data from the Convex Dashboard by running the internal function
`bootstrap:resetAndSeed`, and check `bootstrap:seedStatus` until users and clubs
are populated.

Run **both** `pnpm --filter cvx dev` and `pnpm --filter web dev` (or `pnpm dev` from the repo root) so localhost talks to the same deployment.

Demo seed/reset can also be run from the Convex Dashboard via internal function `bootstrap:resetAndSeed`.

| Service          | URL                                                    |
| ---------------- | ------------------------------------------------------ |
| Web App          | http://localhost:3000                                  |
| Convex Dashboard | https://dashboard.convex.dev (or run `pnpm db:studio`) |

Demo accounts are seeded with their ID as the password, for example `STU001` / `STU001`. See [SETUP.md](./SETUP.md#5-test-accounts) for a complete list of demo logins.

## Common Commands

```bash
pnpm dev          # Start web app and Convex dev server in parallel
pnpm --filter cvx exec convex dashboard  # Open local/dev Convex Dashboard console
pnpm lint         # Lint all workspaces
pnpm build        # Build all workspaces for production
pnpm test         # Run test suites
```

---

## Deployment

The deployment shape should stay boring and maintainable. Production is modeled as **Next.js** plus **Convex Cloud** (data, real-time, and file storage). The app is not a static site.

**Full guide:** [docs/reference/deployment-options.md](./docs/reference/deployment-options.md) — Vercel vs Azure hosting options, Convex CI/CD, and scale planning (~1,600 students, few hundred online at peak).

The detailed architecture and feature list lives in [docs/architecture/diagram-inventory.md](./docs/architecture/diagram-inventory.md). Draw production as **Next.js → Convex Cloud** (not NestJS/PostgreSQL).

**Typical choices:** Vercel + Convex (simplest ops), or **Azure Container Apps + Convex** if the frontend must stay in the school Azure subscription.

## Documentation

- [SETUP.md](./SETUP.md) — Step-by-step developer environment setup.
- [docs/index.md](./docs/index.md) — Current documentation hub.
- [docs/architecture/overview.md](./docs/architecture/overview.md) — Current Convex-era architecture.
- [docs/backend/convex-overview.md](./docs/backend/convex-overview.md) — Backend function layout and rules.
- [docs/frontend/frontend-overview.md](./docs/frontend/frontend-overview.md) — Frontend structure and conventions.
- [PORTING.md](./PORTING.md) — Historical migration context, not the active operating manual.

## License

Private project for FCS Innovation Academy.
