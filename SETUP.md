# IA School App - Setup Guide

> [!NOTE]
> Active web flows use Convex. Old local backend services are not required for
> current local development.

---

## 1. Prerequisites

Ensure you have the following tools installed on your development machine[^1]:

- **Node.js**: v24
- **pnpm**: v10.29.3, matching `packageManager` in `package.json`

---

## 2. First-Time Setup Workflow

Follow these steps to bootstrap your local environment after cloning the repository.

1. Clone the repository
2. Configure environment variables: `cp .env.example .env`
3. Install dependencies: `pnpm install`
4. Configure your Convex dev deployment:
   ```bash
   pnpm convex:dev
   ```
   Run this once interactively so Convex can select or create a dev deployment and write `CONVEX_DEPLOYMENT` to `apps/convex/.env.local`.
5. Start the development server: `pnpm dev`. This command starts:

- The Next.js frontend at `http://localhost:3000`
- The Convex dev server in the background, which auto-provisions schema and functions.

6. Configure browser push keys if you want closed-tab push delivery:
   ```bash
   pnpm --filter cvx exec web-push generate-vapid-keys
   ```
   Copy the generated public key into `apps/web/.env.local` as
   `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, then set the matching Convex deployment
   values:
   ```bash
   pnpm --filter cvx exec convex env set VAPID_PUBLIC_KEY "<public-key>"
   pnpm --filter cvx exec convex env set VAPID_PRIVATE_KEY "<private-key>"
   pnpm --filter cvx exec convex env set VAPID_SUBJECT "mailto:admin@example.com"
   ```
   Use `direnv exec . pnpm ...` for the same commands if your shell depends on
   the repo's Nix/direnv environment.
7. To populate demo accounts, clubs, courses, and schedules, open the Convex Dashboard and run the internal function `bootstrap:resetAndSeed`, then check `bootstrap:seedStatus` for progress.

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

If you need to wipe all demo data and re-seed from scratch, open the Convex
Dashboard and run the internal function `bootstrap:resetAndSeed`, then check
`bootstrap:seedStatus` for progress. There is no local `pnpm db:reset` command
and no seed secret.

### Missing Convex Deployment Error

If you receive the error:
`Convex is not configured for this checkout.`

Run:

```bash
pnpm convex:dev
```

Convex writes the selected dev deployment to `apps/convex/.env.local`. The seed/reset commands cannot run until that deployment exists.

### VAPID Keys Are Missing

If browser push says VAPID keys are missing, generate one key pair and set it in
both places:

```bash
pnpm --filter cvx exec web-push generate-vapid-keys
```

- `apps/web/.env.local`: `NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public-key>`
- Convex env: `VAPID_PUBLIC_KEY=<public-key>`
- Convex env: `VAPID_PRIVATE_KEY=<private-key>`
- Convex env: `VAPID_SUBJECT=mailto:admin@example.com`

Set Convex env values from the repo root:

```bash
pnpm --filter cvx exec convex env set VAPID_PUBLIC_KEY "<public-key>"
pnpm --filter cvx exec convex env set VAPID_PRIVATE_KEY "<private-key>"
pnpm --filter cvx exec convex env set VAPID_SUBJECT "mailto:admin@example.com"
```

### Stale Client or Build Issues

If Turborepo has stale caches or dependencies have drifted, clean and rebuild:

```bash
pnpm build
```

---

## 7. Relevant Resources

- [docs/index.md](./docs/index.md) — Current documentation hub.
- [docs/architecture/overview.md](./docs/architecture/overview.md) — Current architecture.
- [PORTING.md](./PORTING.md) — Historical migration notes from the Convex port.
- [AGENTS.md](./AGENTS.md) — Mandatory guide and rules of engagement for coding agents.

[^1]: For Nix & direnv-based setups, Node.js and pnpm will be loaded automatically when you enter the directory. Running `direnv allow` handles everything.
