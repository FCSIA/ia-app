---
tags: [reference, commands, dev]
---

# Dev Commands

← [[index|Home]]

---

## Daily Use

### Start (after first-time setup)
```bash
# Nix + direnv
cd ia-app
pnpm db:migrate
pnpm dev

# macOS/Linux Homebrew
brew services start postgresql@16 && sleep 2 && pnpm db:migrate && pnpm dev

# Windows
pnpm infra:up:win && pnpm dev
```

### Stop
```bash
# Nix + direnv PostgreSQL
pg_ctl stop -D .pgdata

# macOS/Linux Homebrew
lsof -ti:3000,3001 | xargs kill -9 2>/dev/null; brew services stop postgresql@16

# Windows
# Stop the pnpm dev process (Ctrl+C)
.\pgsql\bin\pg_ctl.exe -D .\pgsql\data stop
```

---

## Development

| Command           | What it does                            |
| ----------------- | --------------------------------------- |
| `pnpm dev`        | Start API (3001) + Web (3000) via Turbo, falling back to the next open ports |
| `pnpm build`      | Build all apps for production           |
| `pnpm lint`       | Run ESLint across all apps              |

---

## Infrastructure

| Command | What it does |
|---------|-------------|
| `direnv allow` | Trust `.envrc`, enter the Nix flake shell, and auto-start repo-local PostgreSQL |
| `pg_ctl stop -D .pgdata` | Stop the repo-local PostgreSQL server started by the Nix shell |
| `pnpm infra:up` | Start PostgreSQL via Homebrew (macOS) |
| `pnpm infra:up:win` | Start PostgreSQL via local binaries (Windows) |
| `pnpm infra:down` | Stop PostgreSQL via Homebrew (macOS) |
| `pnpm setup:win` | Full automated setup (Windows only) |

---

### Dev ports

The dev launchers prefer web `3000` and API `3001`. If either port is busy, they pick the next available port and print a loud banner with the actual URLs.

```bash
# Override only the API starting port
API_PORT=3003 pnpm --filter api dev

# Override only the web starting port
WEB_PORT=3004 pnpm --filter web dev

# CLI-style port override also works for each app
pnpm --filter api dev -- --port 3003
pnpm --filter web dev -- --port 3004
```

When `pnpm dev` starts both apps, the API writes its selected port to `.dev/api-port.json`; the web launcher reads that file and configures `NEXT_PUBLIC_API_URL` / the `/api` proxy target to match.

---

## Database

| Command | What it does |
|---------|-------------|
| `pnpm db:migrate` | Apply pending migrations to the database |
| `pnpm db:reset` | Reset the local database, re-apply migrations, and re-seed demo data |
| `pnpm db:generate` | Regenerate Prisma TypeScript client from schema |
| `pnpm db:seed` | Populate database with demo data |

### Full database reset (⚠️ deletes all data)
```bash
pnpm db:reset
```

If Prisma reports missing-column errors such as `users.middle_name`, use `pnpm db:reset`. That indicates the local database predates the current migration history.

### Connect to database directly
```bash
psql postgresql://ia_user:ia_password@localhost:5432/ia_db
```

### Nix + direnv notes

The repo's `.envrc` contains `use flake`, so direnv loads `flake.nix` automatically after `direnv allow`.

The flake dev shell provides Node.js 20, pnpm, PostgreSQL 16, OpenSSL, and pkg-config. It exports `PGDATA=$PWD/.pgdata`, initializes that directory on first load, starts PostgreSQL, and creates the `ia_user` / `ia_db` pair used by `.env.example`.

It intentionally does not run app-level setup. You still run:

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

One caveat: the repo-local server still uses `localhost:5432`. If another PostgreSQL server is already listening there, the flake fails fast and points you at `.pgdata/postgres.log`.

---

## Useful psql Commands

Once connected with `psql`:

```sql
\dt              -- list all tables
\d "User"        -- describe User table structure
\q               -- quit

-- View all users
SELECT "uniqueId", "firstName", "lastName", roles FROM "User";

-- View clubs
SELECT id, name FROM "Club";

-- Reset a password (bcrypt hash of 'STU001')
UPDATE "User" SET "passwordHash" = '$2b$12$...' WHERE "uniqueId" = 'STU001';
```

---

## Package Management

| Command | What it does |
|---------|-------------|
| `pnpm install` | Install all dependencies for all apps |
| `pnpm --filter api add <package>` | Add package to the API only |
| `pnpm --filter web add <package>` | Add package to the web app only |

The `--filter` flag tells pnpm which workspace to target.

---

## Ports at a Glance

| Port | Service |
|------|---------|
| 3000 | Next.js web app, unless busy |
| 3001 | NestJS API, unless busy |
| 3001/docs | Swagger API documentation, unless API falls back |
| 5432 | PostgreSQL |

---

## Related

- [[getting-started]] — Full first-time setup
- [[environment]] — Environment variables
- [[database-overview]] — Database concepts
