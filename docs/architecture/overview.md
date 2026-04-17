---
tags: [architecture, overview]
---

# Architecture Overview

← [[index|Home]]

---

## What Is Full Stack?

"Full stack" means the project contains two separate programs that communicate with each other over the network:

| Layer | What it is | Technology |
|-------|-----------|------------|
| **Backend** | Server program. Handles logic, talks to database, has no UI | [[backend-overview\|NestJS]] |
| **Frontend** | Browser program. Shows the UI, calls the backend for data | [[frontend-overview\|Next.js]] |
| **Database** | Stores all data permanently | [[database-overview\|PostgreSQL]] |

```
Browser (Next.js)  ──→  Backend (NestJS API)  ──→  PostgreSQL
```

The backend is the **single source of truth**. The browser never touches the database directly — all data flows through the API.

---

## The Monorepo

A **monorepo** (mono = one) puts all apps in a single git repository so they're easier to manage together.

```
ia-app/                     ← one git repo
├── apps/
│   ├── api/                ← backend
│   └── web/                ← web frontend
├── package.json            ← root configuration
├── pnpm-workspace.yaml     ← declares all apps as one workspace
└── turbo.json              ← task runner config
```

### Why a Monorepo?

- Share code and types between apps (the `packages/shared-types/` folder)
- Run all dev servers with one command (`pnpm dev`)
- Manage all dependencies from one place

### pnpm

**pnpm** is the package manager — it downloads third-party code (called "packages" or "dependencies") that your apps rely on. When you run `pnpm install`, it reads every `package.json` and downloads everything listed.

Think of it like an app store for code libraries.

### Turbo

**Turbo** is a task runner. It reads `turbo.json` and can run the same command (`dev`, `build`, `lint`) across all apps simultaneously, in the right order, with intelligent caching.

```bash
pnpm dev  # Turbo starts api and web dev servers in parallel
```

---

## How the Apps Communicate

All communication happens over **HTTP** — the same protocol browsers use to load web pages.

The frontend makes a **request** to a specific URL on the backend:
```
POST http://localhost:3001/auth/login
{ "uniqueId": "STU001", "password": "STU001" }
```

The backend processes it and sends a **response**:
```json
{ "token": "eyJhbG...", "user": { "id": "...", "firstName": "...", "roles": ["STUDENT"], "role": "STUDENT" } }
```

The frontend stores the token and attaches it to every future request. See [[data-flow]] for a full trace.

---

## Port Map

| Port | Service |
|------|---------|
| 3000 | Next.js web app |
| 3001 | NestJS API |
| 5432 | PostgreSQL database |

---

## Related

- [[tech-stack]] — Every library and why it was chosen
- [[data-flow]] — A request traced through every layer
- [[backend-overview]] — How the NestJS API is structured
- [[frontend-overview]] — How the Next.js app is structured
