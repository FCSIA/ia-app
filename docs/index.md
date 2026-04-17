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

### Backend (API)
- [[backend-overview]] — NestJS, Node.js, and how the server works
- [[modules]] — The NestJS module system
- [[controllers]] — HTTP endpoints and routing
- [[services]] — Business logic layer
- [[dtos]] — Data validation and transfer objects
- [[backend-auth]] — JWT authentication and guards
- [[prisma]] — Database ORM and queries

### Database
- [[database-overview]] — PostgreSQL and Prisma explained
- [[schema]] — Every model and field in the database
- [[migrations]] — How schema changes are applied
- [[seed]] — Demo data and test accounts

### Frontend (Web)
- [[frontend-overview]] — Next.js 15, React 19, and the App Router
- [[routing]] — File-based routing and dynamic segments
- [[components]] — React components, hooks, and AppShell
- [[api-layer]] — Axios instance and all API calls
- [[frontend-auth]] — localStorage, tokens, and auth helpers
- [[state-management]] — TanStack Query for data fetching
- [[styling]] — Tailwind CSS and the glassmorphic design system

### Mobile
- [[mobile-overview]] — Expo, React Native, and how it differs from web

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

### Reference
- [[roles-and-permissions]] — All 8 user roles and what they can do
- [[environment]] — Every environment variable explained
- [[commands]] — All dev commands and what they do

---

## 🚀 Quick Start

```bash
# First time setup — see [[getting-started]]
git clone https://github.com/virajdas/ia-app.git && cd ia-app
pnpm install && pnpm db:generate && pnpm db:migrate && pnpm db:seed

# Start
brew services start postgresql@16 && sleep 2 && pnpm db:migrate && pnpm dev

# Stop
lsof -ti:3000,3001 | xargs kill -9 2>/dev/null; brew services stop postgresql@16
```

| URL | What |
|-----|------|
| http://localhost:3000 | Web app |
| http://localhost:3001 | API |
| http://localhost:3001/docs | Swagger API docs |

---

## 🗂️ Project Structure

```
ia-app/
├── apps/
│   ├── api/        → NestJS backend (port 3001)
│   ├── web/        → Next.js web app (port 3000)
│   └── mobile/     → Expo mobile app
├── docs/           → This documentation vault
├── infra/          → Docker / infrastructure config
├── SETUP.md        → New machine setup guide
└── .env.example    → Environment variable template
```
