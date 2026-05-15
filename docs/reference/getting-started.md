---
tags: [reference, setup, getting-started]
---

# Getting Started — New Machine Setup

← [[index|Home]]

For the full copy-paste setup guide, see `SETUP.md` in the project root (visible on GitHub).

This page explains the *why* behind each step.

---

## Prerequisites

### Optional: Nix + direnv

The repo includes a Nix flake and `.envrc`. This is optional, but useful if you already use Nix or want a checked-in development shell. Entering the repo loads the exact development toolchain and starts a repo-local PostgreSQL server.

| Tool | Why |
|------|-----|
| **Nix with flakes enabled** | Provides the pinned dev shell from `flake.lock` |
| **direnv** | Automatically enters the Nix dev shell when you `cd` into the repo |

What the flake provides:

| Tool | Source |
|------|--------|
| **Node.js 20** | `nodejs_20` from Nix |
| **pnpm** | Nix package, currently matching the repo's `packageManager` |
| **PostgreSQL 16** | Repo-local server using `.pgdata` |
| **openssl + pkg-config** | Native dependency build support |

### Manual team setup

Use this route if you do not use Nix.

| Tool | Why |
|------|-----|
| **Homebrew** | Package manager for macOS — installs everything else |
| **Node.js 20+** | JavaScript runtime — required for backend and frontend |
| **pnpm** | Package manager — required for monorepo efficiency |
| **PostgreSQL 16** | The database — stores all app data |
| **PowerShell** | Windows shell — required for the automated setup script |

---

## Step by Step

### Nix + direnv route

1. Install Nix and direnv, then enable direnv in your shell.
2. Clone and enter the repo:
    ```bash
    git clone https://github.com/virajdas/ia-app.git && cd ia-app
    ```
3. Allow direnv for this repo:
    ```bash
    direnv allow
    ```

When direnv loads `.envrc`, it runs `use flake`. The flake shell:

- exports `PGDATA=$PWD/.pgdata`
- initializes `.pgdata` with `initdb` if it does not exist
- starts this repo's `.pgdata` PostgreSQL server if that data directory is not already running
- creates `ia_user` with password `ia_password`
- creates `ia_db` owned by `ia_user`
- grants `ia_user` `CREATEDB` for Prisma shadow databases

You still need the app environment files:

```bash
cp .env.example .env
cp .env.example apps/api/.env
```

Then install dependencies and prepare the database:

```bash
pnpm install
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

After the first setup, daily startup is usually:

```bash
cd ia-app
pnpm db:migrate
pnpm dev
```

Important details:

- The Nix shell starts PostgreSQL, but it does not run Prisma migrations or seed data.
- The flake does not export `DATABASE_URL`; Prisma reads it from `.env` / `apps/api/.env`.
- The startup check is tied to this repo's `.pgdata` directory. If another PostgreSQL server is already using `localhost:5432`, the repo-local server fails to start instead of silently using the other server.
- The repo-local database files live in `.pgdata` and logs are in `.pgdata/postgres.log`.

### Homebrew route

#### 1. Homebrew
The macOS package manager. Lets you install developer tools from the terminal.
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

#### 2. Node.js
The runtime that executes JavaScript on the server (and is needed for build tools).
```bash
brew install node@20 && brew link node@20 --force
```

#### 3. pnpm
The package manager this project uses. Works better than npm for monorepos.
```bash
npm install -g pnpm
```

#### 4. PostgreSQL 16
The database. Installed via Homebrew (no Docker needed).
```bash
brew install postgresql@16
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```

#### 5. Start PostgreSQL
- **macOS**: `brew services start postgresql@16`
- **Windows**: `pnpm infra:up:win` (or run `.\setup_pg.ps1`)

#### 6. Create Database and User
- **macOS**: Use the commands below:
    ```bash
    psql postgres -c "CREATE USER ia_user WITH PASSWORD 'ia_password';"
    psql postgres -c "CREATE DATABASE ia_db OWNER ia_user;"
    psql postgres -c "ALTER USER ia_user CREATEDB;"
    ```
- **Windows**: This is handled automatically by `pnpm setup:win`.
The `CREATEDB` privilege is needed by Prisma's migration system (shadow database).

#### 7. Clone the Repository
```bash
git clone https://github.com/virajdas/ia-app.git && cd ia-app
```

#### 8. Create Environment Files
```bash
cp .env.example .env && cp .env.example apps/api/.env
```
See [[environment]] for what each variable does.

#### 9. Install Dependencies
```bash
pnpm install
```
Installs all packages for all apps (api, web) in one command.

#### 10. Generate Prisma Client
```bash
pnpm db:generate
```
Creates TypeScript types from the database schema. Required before the API can start.

#### 11. Run Migrations
```bash
pnpm db:migrate
```
Applies the database schema (creates all tables) to the empty database.

After you pull later schema changes, run `pnpm db:migrate` again before `pnpm dev`.

If Prisma reports missing-column errors such as `users.middle_name`, reset the local database and re-seed it:
```bash
pnpm db:reset
```

#### 12. Seed Demo Data
```bash
pnpm db:seed
```
Creates test accounts, clubs, announcements, and events. See [[seed]].

#### 13. Start
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
