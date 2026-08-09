# IA School App

A full-stack school communication and management platform for FCS Innovation Academy.

## For Coding Agents

Read [AGENTS.md](./AGENTS.md) before making changes. Keep agent workflow and handoff notes out of this README.

## What It Includes

- Authentication with Better Auth on Convex and role-based access
- Native Expo mobile app with secure sessions, shared Convex data, and native push
- Announcements, comments, moderation, and notification preferences
- Clubs, channels, invites, membership, and leader/sponsor workflows
- Events, calendar entries, Flex Friday sessions, and student schedules
- Admin user management, audit logging, and demo seed data

## Tech Stack

| Layer              | Technology                                                  |
| ------------------ | ----------------------------------------------------------- |
| Web                | Next.js 16, React 19, Tailwind CSS, shadcn/ui               |
| Mobile             | Expo SDK 57, React Native, Expo Router, NativeWind          |
| Backend & Database | Convex (Reactive Functions, Database, Search, File Storage) |
| Design             | Shared `@ia/design-tokens` package                          |
| Tooling            | pnpm workspaces, Turborepo, EAS                             |

## Project Structure

```text
ia-app/
├── apps/web/              # Next.js 16 web app
├── apps/mobile/           # Expo native mobile app
├── apps/convex/           # Convex backend (schema, functions, auth, storage)
├── packages/design-tokens/ # Shared color, radius, type, and badge tokens
├── docs/                  # Current product, architecture, backend, frontend docs
├── AGENTS.md              # Agent workflow rules
└── PORTING.md             # Historical backend-to-Convex migration context
```

## Quick Start

For a full setup walkthrough, use [Getting Started](docs/reference/getting-started.md).

Requires Node.js 20.19 or newer and pnpm 10.29.3.

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

Start the native mobile app with Expo:

```bash
pnpm dev:mobile
```

The mobile app has repo-local store assets and production-shaped Expo config.
School-owned EAS, Apple, Google, and universal-link values are documented in
[apps/mobile/STORE_READY.md](./apps/mobile/STORE_READY.md).

Open Convex dashboard:

```bash
pnpm --filter cvx exec convex dash
pnpm --filter cvx exec convex dashboard
```

> [!IMPORTANT]
> Do not run `pnpx convex dev`, `npx convex dev`, or other Convex commands from the repository root. This monorepo's Convex app lives in `apps/convex`, so root-level Convex commands can initialize and push an empty `convex/` app. Use `pnpm --filter cvx ...` from the root instead.

On a new checkout, initialize its local Convex backend and auth environment:

```bash
pnpm setup:convex-local
pnpm dev
```

The setup command generates `BETTER_AUTH_SECRET` and defaults `SITE_URL` only
when they are missing, repairs the local URL pair, and syncs the selected URLs
to the web and mobile apps. Rerunning it preserves existing deployment values.

Browser push also needs VAPID keys. Generate one key pair, put the public key in
`apps/web/.env.local`, and set the matching Convex deployment values:

```bash
pnpm --filter cvx exec web-push generate-vapid-keys
pnpm --filter cvx exec convex env set VAPID_PUBLIC_KEY "<public-key>"
pnpm --filter cvx exec convex env set VAPID_PRIVATE_KEY "<private-key>"
pnpm --filter cvx exec convex env set VAPID_SUBJECT "mailto:admin@example.com"
```

Then seed the small demo profile from the CLI:

```bash
pnpm --filter cvx exec convex run --deployment local \
  bootstrap:resetAndSeed '{"profile":"development"}'
pnpm --filter cvx exec convex run --deployment local \
  bootstrap:seedStatus '{}' --watch
```

It seeds 50 students and 119 staff. Pass `{"profile":"full"}` only for the
1,500-student full profile. The Convex Dashboard provides the same internal
functions as an alternative.

`pnpm dev` starts the web and Convex watchers against the selected local
deployment. See [Convex Local And Production Runtime](./docs/backend/convex-local-production.md)
before using a cloud deployment.

Demo seed/reset can also be run from the Convex Dashboard via internal function `bootstrap:resetAndSeed`.

| Service          | URL                                                    |
| ---------------- | ------------------------------------------------------ |
| Web App          | http://localhost:3000                                  |
| Convex Dashboard | https://dashboard.convex.dev (or run `pnpm db:studio`) |

Demo accounts receive random, one-time temporary passwords. After a seed run
completes, use `bootstrap:claimSeedCredentials` with its run id and store the
output securely. See [docs/reference/getting-started.md](./docs/reference/getting-started.md#5-test-accounts).

## Common Commands

```bash
pnpm dev          # Start web app and Convex dev server in parallel
pnpm dev:mobile   # Start the Expo mobile app
pnpm --filter cvx exec convex dashboard  # Open local/dev Convex Dashboard console
pnpm lint         # Lint all workspaces
pnpm build        # Build all workspaces for production
pnpm test         # Run test suites
```

---

## Deployment

The deployment shape should stay boring and maintainable. Production is modeled as **Next.js** plus **Convex Cloud** (data, real-time, and file storage). The app is not a static site.

**Full guide:** [docs/reference/deployment-options.md](./docs/reference/deployment-options.md) — Vercel vs Azure hosting options, Convex CI/CD, and scale planning (~1,600 students, few hundred online at peak).

The detailed architecture and feature list starts in [docs/architecture/overview.md](./docs/architecture/overview.md). Draw production as **Next.js → Convex Cloud** (not NestJS/PostgreSQL).

**Typical choices:** Vercel + Convex (simplest ops), or **Azure Container Apps + Convex** if the frontend must stay in the school Azure subscription.

## Documentation

- [CONTRIBUTING.md](./CONTRIBUTING.md) - Safe student contribution workflow and pull-request checks.
- [SECURITY.md](./SECURITY.md) - Private vulnerability reporting and testing boundaries.
- [docs/reference/getting-started.md](./docs/reference/getting-started.md) — Step-by-step developer environment setup.
- [docs/index.md](./docs/index.md) — Current documentation hub.
- [docs/architecture/overview.md](./docs/architecture/overview.md) — Current Convex-era architecture.
- [docs/backend/convex-overview.md](./docs/backend/convex-overview.md) — Backend function layout and rules.
- [docs/frontend/frontend-overview.md](./docs/frontend/frontend-overview.md) — Frontend structure and conventions.
- [apps/mobile/README.md](./apps/mobile/README.md) - Native mobile setup and verification.
- [apps/mobile/STORE_READY.md](./apps/mobile/STORE_READY.md) - External store/EAS/device steps for release.
- [PORTING.md](./PORTING.md) — Historical migration context, not the active operating manual.

## License

Private project for FCS Innovation Academy.
