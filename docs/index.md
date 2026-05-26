---
tags: [home, overview]
---

# IA App — Documentation

Welcome to the IA App developer documentation. This is a school communication platform built as a full-stack monorepo.

---

## 🗺️ Navigation

### Architecture
- [[overview]] — What the app is, how the pieces connect
- [[tech-stack]] — Every technology used and why
- [[data-flow]] — A request traced end-to-end through every layer
- [[diagram-inventory]] — Detailed list of runtime pieces, features, data domains, flows, and Azure changes

### Backend
- [[convex]] — Convex backend app layout, commands, generated types, and seed flow
- [[backend-auth]] — Better Auth, Convex auth, roles, and account lifecycle
- [[backend-overview]] — Legacy NestJS backend reference during the Convex port
- [[modules]] — Legacy NestJS module reference
- [[controllers]] — Legacy HTTP endpoint reference
- [[services]] — Legacy service-layer reference
- [[dtos]] — Legacy DTO reference
- [[prisma]] — Legacy Prisma reference

### Data
- [[schema]] — Convex schema plus legacy Prisma reference while the old API remains
- [[seed]] — Convex demo data and test accounts
- [[database-overview]] — Legacy PostgreSQL and Prisma background
- [[migrations]] — Legacy Prisma migration background

### Frontend (Web)
- [[frontend-overview]] — Next.js 15, React 19, and the App Router
- [[routing]] — File-based routing and dynamic segments
- [[components]] — React components, hooks, and AppShell
- [[api-layer]] — Convex React hooks, generated API types, uploads, and legacy REST policy
- [[frontend-auth]] — Better Auth, Convex tokens, and auth helpers
- [[state-management]] — Convex subscriptions plus remaining local UI state
- [[styling]] — Tailwind CSS and the glassmorphic design system

### Features
- [[announcements]] — School-wide and club announcements with comments
- [[clubs]] — Club management, membership, and invites
- [[events]] — Event creation, approval workflow, and publishing
- [[calendar]] — Calendar entries and event display
- [[schedule]] — Student schedules, friend comparison, and admin day blocks
- [[flex-friday]] — Session scheduling, registration, and assignments
- [[notifications]] — In-app notification delivery and preferences
- [[moderation]] — Keyword filtering and content reports
- [[audit-log]] — Admin activity tracking
- [[wrapped]] — Spotify Wrapped-style school-year activity recap

### Reference
- [[getting-started]] — New machine setup and local dev environment
- [[roles-and-permissions]] — All 8 user roles and what they can do
- [[environment]] — Every environment variable explained
- [[commands]] — All dev commands and what they do

---

## 🚀 Quick Start

```bash
# First time setup — see [[getting-started]]
git clone https://github.com/virajdas/ia-app.git && cd ia-app
cp .env.example .env && cp .env.example apps/api/.env
pnpm install

direnv allow
pnpm db:generate && pnpm db:seed

# Start
pnpm dev

# Stop
# Stop the pnpm dev process (Ctrl+C)
```

| URL | What |
|-----|------|
| http://localhost:3000 | Web app, unless the dev launcher falls back |
| http://127.0.0.1:3210 | Local Convex API, when `convex dev` is running locally |
| http://127.0.0.1:3211 | Local Convex site/HTTP actions, when configured locally |

---

## 🗂️ Project Structure

```
ia-app/
├── apps/
│   ├── api/        → Legacy NestJS backend during the Convex port
│   ├── convex/     → Convex backend app
│   └── web/        → Next.js web app (port 3000)
├── docs/           → This documentation vault
├── infra/          → Docker / infrastructure config
├── SETUP.md        → New machine setup guide
└── .env.example    → Environment variable template
```
