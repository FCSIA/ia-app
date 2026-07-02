---
tags: [architecture, deployment, convex]
---

# Deployment

[Home](../index.md)

The app deploys as a web frontend plus a Convex backend deployment.

## Local Development

```bash
pnpm cvx:dev
pnpm dev
```

Run `pnpm cvx:dev` once on a fresh checkout so Convex can select or create a
dev deployment and write `CONVEX_DEPLOYMENT` to `apps/convex/.env.local`.

## Backend Deployment

Convex deploys schema, indexes, functions, HTTP routes, storage integration, and
component configuration.

```bash
pnpm --filter cvx deploy
```

Runtime secrets such as auth credentials live in the Convex deployment
environment, not only in local `.env` files. Demo seed/reset no longer uses a
bootstrap secret.

Browser push needs VAPID keys in the Convex deployment:

```bash
pnpm --filter cvx exec web-push generate-vapid-keys
pnpm --filter cvx exec convex env set VAPID_PUBLIC_KEY "<public-key>"
pnpm --filter cvx exec convex env set VAPID_PRIVATE_KEY "<private-key>"
pnpm --filter cvx exec convex env set VAPID_SUBJECT "mailto:admin@example.com"
```

## Frontend Deployment

The Next.js app can run on Vercel, Azure App Service, Azure Container Apps, or a
Node-compatible host. The frontend must receive the public Convex URLs:

```env
NEXT_PUBLIC_CONVEX_URL=https://...
NEXT_PUBLIC_CONVEX_SITE_URL=https://...
NEXT_PUBLIC_SITE_URL=https://...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
```

## Build Checks

Run the narrow checks first while developing:

```bash
pnpm --filter cvx codegen
pnpm --filter cvx typecheck
pnpm --filter web build
```

`pnpm lint` is the intended broad check, but the current handoff notes mention
legacy app lint failures until that app is removed or fixed.

## Related

- [Developer setup](../../SETUP.md)
- [Seed and reset](../backend/seed-and-reset.md)
