---
tags: [reference, environment, configuration]
---

# Environment Variables

[Home](../index.md)

The current app uses Convex for backend data and Better Auth for authentication.
Old Prisma/PostgreSQL API environment variables are not part of active local
development.

## Local Files

| File                     | Purpose                                                      |
| ------------------------ | ------------------------------------------------------------ |
| `.env`                   | Local root defaults                                          |
| `.env.example`           | Template for local defaults                                  |
| `apps/convex/.env.local` | Convex-selected deployment URLs written by `pnpm convex:dev` |

## Convex Variables

`pnpm convex:dev` writes the selected deployment:

```env
CONVEX_DEPLOYMENT=dev:...
CONVEX_URL=https://...
CONVEX_SITE_URL=https://...
```

The web app also needs public Convex URLs when deployed:

```env
NEXT_PUBLIC_CONVEX_URL=https://...
NEXT_PUBLIC_CONVEX_SITE_URL=https://...
```

## Secrets

Runtime secrets such as Better Auth credentials belong in the Convex deployment
environment. Demo seed/reset does not use `BOOTSTRAP_SECRET`; reset is available
only as the internal dashboard function `bootstrap:resetAndSeed`.

## Web Push

Browser push notifications require VAPID keys. The public key is needed by the
web client and Convex; the private key belongs only in the Convex deployment
environment.

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@example.com
```

Generate keys with:

```bash
direnv exec . pnpm --filter cvx exec web-push generate-vapid-keys
```
