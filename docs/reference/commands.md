---
tags: [reference, commands, dev]
---

# Dev Commands

← [[index|Home]]

---

## Daily Use

### Start (after first-time setup)
```bash
brew services start postgresql@16 && sleep 2 && pnpm dev
```

### Stop
```bash
lsof -ti:3000,3001 | xargs kill -9 2>/dev/null; brew services stop postgresql@16
```

---

## Development

| Command | What it does |
|---------|-------------|
| `pnpm dev` | Start API (3001) + Web (3000) via Turbo |
| `pnpm dev:all` | Start API + Web + Mobile |
| `pnpm dev:mobile` | Start only the Expo mobile dev server |
| `pnpm build` | Build all apps for production |
| `pnpm lint` | Run ESLint across all apps |

---

## Infrastructure

| Command | What it does |
|---------|-------------|
| `pnpm infra:up` | Start PostgreSQL via Homebrew |
| `pnpm infra:down` | Stop PostgreSQL via Homebrew |

---

## Database

| Command | What it does |
|---------|-------------|
| `pnpm db:migrate` | Apply pending migrations to the database |
| `pnpm db:generate` | Regenerate Prisma TypeScript client from schema |
| `pnpm db:seed` | Populate database with demo data |

### Full database reset (⚠️ deletes all data)
```bash
pnpm --filter api exec prisma migrate reset && pnpm db:seed
```

### Connect to database directly
```bash
psql postgresql://ia_user:ia_password@localhost:5432/ia_db
```

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
| `pnpm --filter mobile add <package>` | Add package to mobile only |

The `--filter` flag tells pnpm which workspace to target.

---

## Ports at a Glance

| Port | Service |
|------|---------|
| 3000 | Next.js web app |
| 3001 | NestJS API |
| 3001/docs | Swagger API documentation |
| 5432 | PostgreSQL |

---

## Related

- [[getting-started]] — Full first-time setup
- [[environment]] — Environment variables
- [[database-overview]] — Database concepts
