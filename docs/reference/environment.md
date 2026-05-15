---
tags:
  - reference
  - environment
  - configuration
---

# Environment Variables

← [[index|Home]]

---

## What Is an Environment Variable?

An environment variable is a configuration value stored outside your code. This allows the same code to run with different settings in different places (your laptop vs. a production server) and keeps secrets (passwords, API keys) out of git.

Variables are defined in `.env` files and accessed in code as `process.env.VARIABLE_NAME`.

---

## Files

| File | Purpose | In git? |
|------|---------|---------|
| `.env` | Root config (PostgreSQL, JWT secret) | ❌ (gitignored) |
| `.env.example` | Template showing required variables | ✅ |
| `apps/api/.env` | API-specific config | ❌ (gitignored) |

On a new machine, copy the examples:
```bash
cp .env.example .env
cp .env.example apps/api/.env
```

---

## All Variables

### Database
```bash
DATABASE_URL="postgresql://ia_user:ia_password@localhost:5432/ia_db"
```
The full PostgreSQL connection string. Format: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE`

Used by: Prisma (API)

---

### Redis (currently unused)
```bash
REDIS_URL="redis://localhost:6379"
```
Configured but Redis is not currently implemented in the API. Left for future use (e.g., rate limiting, caching).

---

### JWT
```bash
JWT_SECRET="change-me-to-a-long-random-secret-in-production"
JWT_EXPIRES_IN="7d"
```

- `JWT_SECRET` — The secret key used to **sign** and **verify** tokens. Anyone with this value can forge valid tokens. **Change this before deploying.**
- `JWT_EXPIRES_IN` — How long tokens last. `"7d"` = 7 days.

Used by: NestJS auth module

---

### API Server
```bash
API_PORT=3001
API_HOST=localhost
```
Port and host the NestJS API listens on. In development, `pnpm --filter api dev` treats this as the preferred starting port and falls back to the next available port if it is busy.

---

### Web App URL (exposed to browser)
```bash
NEXT_PUBLIC_API_URL="http://localhost:3001"
WEB_PORT=3000
```
The URL the Next.js web app uses to call the API. The `NEXT_PUBLIC_` prefix is required by Next.js to expose a variable to the browser — without it, the variable is server-only.

In development, `pnpm --filter web dev` treats `WEB_PORT` as the preferred starting port and falls back if busy. When run through `pnpm dev`, the web app reads the API dev port selected by the API launcher and sets `NEXT_PUBLIC_API_URL` automatically.

Used by: Axios in `apps/web/src/lib/api.ts`

---

### App Mode
```bash
NODE_ENV=development
```
`development` vs `production`. Controls things like:
- NestJS error message verbosity
- Next.js build optimizations

---

## Generating a Secure JWT Secret

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Paste the output as your `JWT_SECRET` before deploying.

---

## Related

- [[getting-started]] — How to set up env files on a new machine
- [[backend-auth]] — How JWT_SECRET is used
- [[database-overview]] — DATABASE_URL explained
