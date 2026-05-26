---
tags: [architecture, deployment, convex]
---

# Deployment

[Home](../index.md)

The app deploys as a web frontend plus a Convex backend deployment.

## Local Development

```bash
pnpm convex:dev
pnpm dev
```

Run `pnpm convex:dev` once on a fresh checkout so Convex can select or create a
dev deployment and write `CONVEX_DEPLOYMENT` to `apps/convex/.env.local`.

## Backend Deployment

Convex deploys schema, indexes, functions, HTTP routes, storage integration, and
component configuration.

```bash
pnpm --filter convex-backend deploy
```

Secrets such as `BOOTSTRAP_SECRET` live in the Convex deployment environment,
not only in local `.env` files.

## Frontend Deployment

The Next.js app can run on Vercel, Azure App Service, Azure Container Apps, or a
Node-compatible host. The frontend must receive the public Convex URLs:

```env
NEXT_PUBLIC_CONVEX_URL=https://...
NEXT_PUBLIC_CONVEX_SITE_URL=https://...
NEXT_PUBLIC_SITE_URL=https://...
```

## Build Checks

Run the narrow checks first while developing:

```bash
pnpm --filter convex-backend codegen
pnpm --filter convex-backend typecheck
pnpm --filter web build
```

`pnpm lint` is the intended broad check, but the current handoff notes mention
legacy app lint failures until that app is removed or fixed.

## Related

- [Developer setup](../../SETUP.md)
- [Seed and reset](../backend/seed-and-reset.md)
