# Complete Setup Guide — IA App

Follow every step in order.

---

## 💻 Choose your Platform

- **macOS (Homebrew)**: Follow the Homebrew section.
- **macOS/Linux (optional Nix + direnv)**: Follow the Nix + direnv section if you want the checked-in dev shell.
- **Windows**: [Skip to Windows Setup](#windows-setup)

---

## Nix + direnv Setup

Use this optional route if you already use Nix or want the repo to own its dev toolchain. The repository includes `.envrc` with `use flake`, and `flake.nix` provides Node.js 20, pnpm, PostgreSQL 16, OpenSSL, and pkg-config.

### 1. Install Nix and direnv

Install Nix with flakes enabled, then install direnv and hook it into your shell.

Verify:

```bash
nix --version
direnv --version
```

### 2. Clone the Repository

```bash
git clone https://github.com/virajdas/ia-app.git && cd ia-app
```

### 3. Allow direnv

```bash
direnv allow
```

On load, the flake shell sets `PGDATA=$PWD/.pgdata`, initializes `.pgdata` if needed, starts PostgreSQL, and creates:

- user: `ia_user`
- password: `ia_password`
- database: `ia_db`

The PostgreSQL log is written to `.pgdata/postgres.log`.

Important: the flake checks whether this repo's `.pgdata` server is running. If another PostgreSQL instance is already using `localhost:5432`, the repo-local server will fail to start instead of silently using the other server.

### 4. Create Environment Files

```bash
cp .env.example .env && cp .env.example apps/api/.env
```

The dev shell starts PostgreSQL, but it does not set `DATABASE_URL`; Prisma reads it from these files.

### 5. Install Dependencies

```bash
pnpm install
```

### 6. Generate, Migrate, and Seed

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### 7. Start the App

```bash
pnpm dev
```

- **Web app**: http://localhost:3000
- **API**: http://localhost:3001

### Daily Use

```bash
cd ia-app
pnpm db:migrate
pnpm dev
```

To stop the repo-local database:

```bash
pg_ctl stop -D .pgdata
```

---

## Homebrew Setup

### 1. Install Homebrew
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
After it finishes, if prompted, run the two `eval` lines it prints to add brew to your PATH. Then verify:
```bash
brew --version
```

---

### 2. Install Node.js 20+
```bash
brew install node@20
```
Then link it:
```bash
brew link node@20 --force
```
Verify:
```bash
node --version   # should be v20.x.x or higher
```

---

### 3. Install pnpm
```bash
npm install -g pnpm
```
Verify:
```bash
pnpm --version   # should be 9.x.x or higher
```

---

### 4. Install PostgreSQL 16
```bash
brew install postgresql@16
```
Add it to your PATH (copy the whole block):
```bash
echo 'export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
```
> If you're on an Intel Mac (not Apple Silicon), replace `/opt/homebrew` with `/usr/local`

Verify:
```bash
psql --version   # should say postgresql 16.x
```

---

### 5. Start PostgreSQL
```bash
brew services start postgresql@16
```
Verify it's running:
```bash
brew services list | grep postgresql
```
You should see `postgresql@16  started`

---

### 6. Create the Database and User
```bash
psql postgres -c "CREATE USER ia_user WITH PASSWORD 'ia_password';" && psql postgres -c "CREATE DATABASE ia_db OWNER ia_user;" && psql postgres -c "ALTER USER ia_user CREATEDB;"
```
Verify:
```bash
psql postgresql://ia_user:ia_password@localhost:5432/ia_db -c "\conninfo"
```

---

### 7. Clone the Repository
```bash
git clone https://github.com/virajdas/ia-app.git && cd ia-app
```

---

### 8. Create Environment Files
```bash
cp .env.example .env && cp .env.example apps/api/.env
```

---

### 9. Install Dependencies
```bash
pnpm install
```
> This installs everything for all apps (api, web) in one go.

---

### 10. Generate Prisma Client
```bash
pnpm db:generate
```

---

### 11. Run Database Migrations
```bash
pnpm db:migrate
```

---

### 12. Seed the Database
```bash
pnpm db:seed
```
You should see output confirming users, clubs, and events were created.

---

### 13. Start the App
```bash
pnpm dev
```

- **Web app**: http://localhost:3000
- **API**: http://localhost:3001

---

## Windows Setup

If you are on Windows, use the automated PowerShell script.

### 1. Prerequisites
- **Node.js**: [Download and install](https://nodejs.org/en/download) (v20+)
- **pnpm**: `npm install -g pnpm`

### 2. Setup Database and App
Run this from the project root:
```powershell
pnpm setup:win
```
*This command downloads PostgreSQL, starts the server, installs dependencies, initializes the database, and opens **Prisma Studio** in a new window.*

### 3. Start Developing
```powershell
pnpm dev
```

---

## Test Accounts

All accounts use their ID as the password (e.g. password for `SUPER001` is `SUPER001`)

| ID       | Role        |
|----------|-------------|
| SUPER001 | Super Admin |
| ADMIN001 | Admin       |
| TCH001   | Teacher     |
| STU001   | Student     |
| STU002   | Student     |
| STU003   | Student     |
| STU004   | Student     |

---

## Stop Everything
```bash
lsof -ti:3000,3001 | xargs kill -9 2>/dev/null; brew services stop postgresql@16
```

## Start Again (After First Setup)
```bash
brew services start postgresql@16 && sleep 2 && pnpm db:migrate && pnpm dev
```

If Prisma reports missing-column errors such as `users.middle_name`, your local database is from before the current migration reset. Run:
```bash
pnpm db:reset
```
