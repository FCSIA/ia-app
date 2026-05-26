# IA School App - Setup Guide

> [!NOTE]
> The application has been fully migrated to Convex. Legacy dependencies like local PostgreSQL, Redis, NestJS, and Prisma are no longer required for local development.

---

## 1. Prerequisites

Ensure you have the following tools installed on your development machine[^1]:
- **Node.js**: v24
- **pnpm**: v9

---

## 2. First-Time Setup Workflow

Follow these steps to bootstrap your local environment after cloning the repository.

1. Clone the repository
2. Configure environment variables: `cp .env.example .env`
3. Install dependencies: `pnpm install`
4. Start the development server: `pnpm dev`. This command starts:
  - The Next.js frontend at `http://localhost:3000`
  - The Convex dev server in the background, which auto-provisions schema and functions.
5. Run the seeding script to populate your database with demo accounts, clubs, courses, and schedules: `pnpm db:seed`

---

## 3. Daily Development Workflow

Once the first-time setup is complete, your daily workflow is extremely lightweight.

### Start Developing
Simply run:
```bash
pnpm dev
```
This will automatically launch the Next.js app and the Convex background compiler.

### Inspect the Database
To view live documents, indexes, and Convex logs:
```bash
pnpm db:studio
```
This opens the Convex Dev Console in your web browser.

---

## 4. Platform-Specific Notes

Because the app is fully serverless/reactive on Convex, local database setups are highly simplified. The following outlines an optional method for environment management.

### Nix + direnv (macOS / Linux)
If you prefer a fully managed development environment:
1. Ensure [Nix](https://nixos.org/download.html) and [direnv](https://direnv.net/) are installed.
2. Run `direnv allow` in the project root.
3. This automatically installs the correct versions of Node.js and pnpm, and loads environment variables.

---

## 5. Test Accounts

All demo accounts use their user ID as both the username and the password; e.g. `STU001`, `TCH001`, `ADMIN001`, `SUPER001`

---

## 6. Troubleshooting & Common Tasks

### Reset the Database
If you need to wipe all data and re-seed from scratch:
```bash
pnpm db:reset
```
*Requires `BOOTSTRAP_SECRET` to match the value configured in your `.env`.*

### Missing Secret Error
If you receive the error:
`Set BOOTSTRAP_SECRET (or COURSE_SEED_SECRET) before running db commands.`
Double-check that your project-root `.env` exists and contains:
```env
BOOTSTRAP_SECRET="42"
```

### Stale Client or Build Issues
If Turborepo has stale caches or dependencies have drifted, clean and rebuild:
```bash
pnpm build
```

---

## 7. Relevant Resources

- [PORTING.md](./PORTING.md) — Technical deep-dive on the Convex architecture decisions and migration mappings.
- [AGENTS.md](./AGENTS.md) — Mandatory guide and rules of engagement for coding agents.

[^1]: For Nix & direnv-based setups, Node.js and pnpm will be loaded automatically when you enter the directory. Running `direnv allow` handles everything.
