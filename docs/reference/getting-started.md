---
tags: [reference, setup, getting-started]
---

# Getting Started — New Machine Setup

← [[index|Home]]

For the full copy-paste setup guide, see `SETUP.md` in the project root (visible on GitHub).

This page explains the *why* behind each step.

---

## Prerequisites

| Tool | Why |
|------|-----|
| **Homebrew** | Package manager for macOS — installs everything else |
| **Node.js 20+** | JavaScript runtime — required to run the backend and build the frontend |
| **pnpm** | Package manager — faster than npm, required for this monorepo |
| **PostgreSQL 16** | The database — stores all app data |

---

## Step by Step

### 1. Homebrew
The macOS package manager. Lets you install developer tools from the terminal.
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. Node.js
The runtime that executes JavaScript on the server (and is needed for build tools).
```bash
brew install node@20 && brew link node@20 --force
```

### 3. pnpm
The package manager this project uses. Works better than npm for monorepos.
```bash
npm install -g pnpm
```

### 4. PostgreSQL 16
The database. Installed via Homebrew (no Docker needed).
```bash
brew install postgresql@16
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

### 5. Start PostgreSQL
```bash
brew services start postgresql@16
```

### 6. Create Database and User
Sets up the `ia_db` database and `ia_user` account that the app connects as.
```bash
psql postgres -c "CREATE USER ia_user WITH PASSWORD 'ia_password';"
psql postgres -c "CREATE DATABASE ia_db OWNER ia_user;"
psql postgres -c "ALTER USER ia_user CREATEDB;"
```
The `CREATEDB` privilege is needed by Prisma's migration system (shadow database).

### 7. Clone the Repository
```bash
git clone https://github.com/virajdas/ia-app.git && cd ia-app
```

### 8. Create Environment Files
```bash
cp .env.example .env && cp .env.example apps/api/.env
```
See [[environment]] for what each variable does.

### 9. Install Dependencies
```bash
pnpm install
```
Installs all packages for all three apps (api, web, mobile) in one command.

### 10. Generate Prisma Client
```bash
pnpm db:generate
```
Creates TypeScript types from the database schema. Required before the API can start.

### 11. Run Migrations
```bash
pnpm db:migrate
```
Applies the database schema (creates all tables) to the empty database.

After you pull later schema changes, run `pnpm db:migrate` again before `pnpm dev`.

If Prisma reports missing-column errors such as `users.middle_name`, reset the local database and re-seed it:
```bash
pnpm db:reset
```

### 12. Seed Demo Data
```bash
pnpm db:seed
```
Creates test accounts, clubs, announcements, and events. See [[seed]].

### 13. Start
```bash
pnpm dev
```

---

## Verify It's Working

1. Open http://localhost:3000
2. Log in with `STU001` / `STU001`
3. You should see the dashboard with demo data

---

## Related

- [[commands]] — All dev commands
- [[environment]] — Environment variable reference
- [[seed]] — Test accounts and demo data
- [[roles-and-permissions]] — What each account can do
