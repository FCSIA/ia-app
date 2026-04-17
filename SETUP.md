# Complete Setup Guide — IA App

Follow every step in order on a brand new Mac. Copy and paste each block exactly.

---

## 1. Install Homebrew
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
After it finishes, if prompted, run the two `eval` lines it prints to add brew to your PATH. Then verify:
```bash
brew --version
```

---

## 2. Install Node.js 20+
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

## 3. Install pnpm
```bash
npm install -g pnpm
```
Verify:
```bash
pnpm --version   # should be 9.x.x or higher
```

---

## 4. Install PostgreSQL 16
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

## 5. Start PostgreSQL
```bash
brew services start postgresql@16
```
Verify it's running:
```bash
brew services list | grep postgresql
```
You should see `postgresql@16  started`

---

## 6. Create the Database and User
```bash
psql postgres -c "CREATE USER ia_user WITH PASSWORD 'ia_password';" && psql postgres -c "CREATE DATABASE ia_db OWNER ia_user;" && psql postgres -c "ALTER USER ia_user CREATEDB;"
```
Verify:
```bash
psql postgresql://ia_user:ia_password@localhost:5432/ia_db -c "\conninfo"
```

---

## 7. Clone the Repository
```bash
git clone https://github.com/virajdas/ia-app.git && cd ia-app
```

---

## 8. Create Environment Files
```bash
cp .env.example .env && cp .env.example apps/api/.env
```

---

## 9. Install Dependencies
```bash
pnpm install
```
> This installs everything for all apps (api, web, mobile) in one go.

---

## 10. Generate Prisma Client
```bash
pnpm db:generate
```

---

## 11. Run Database Migrations
```bash
pnpm db:migrate
```

---

## 12. Seed the Database
```bash
pnpm db:seed
```
You should see output confirming users, clubs, and events were created.

---

## 13. Start the App
```bash
pnpm dev
```

- **Web app**: http://localhost:3000
- **API**: http://localhost:3001

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
brew services start postgresql@16 && sleep 2 && pnpm dev
```
