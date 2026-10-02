---
tags: [architecture, deployment, convex]
---

# Deployment

[Home](../index.md)

The app deploys as a web frontend plus a Convex backend deployment.

## Local Development

```bash
bun run cvx:dev
bun run dev
```

Run `bun run cvx:dev` once on a fresh checkout so Convex can select or create a
dev deployment and write `CONVEX_DEPLOYMENT` to `apps/convex/.env.local`.

## Backend Deployment

Convex deploys schema, indexes, functions, HTTP routes, storage integration, and
component configuration.

```bash
bun run --filter cvx deploy
```

Runtime secrets such as auth credentials live in the Convex deployment
environment, not only in local `.env` files. Demo seed/reset no longer uses a
bootstrap secret.

Browser push needs VAPID keys in the Convex deployment:

```bash
bun run --cwd apps/convex web-push generate-vapid-keys
bun run --cwd apps/convex convex env set VAPID_PUBLIC_KEY "<public-key>"
bun run --cwd apps/convex convex env set VAPID_PRIVATE_KEY "<private-key>"
bun run --cwd apps/convex convex env set VAPID_SUBJECT "mailto:admin@example.com"
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

The production application origin is `https://app.fcsia.com`. Requests to the
former Vercel hostname, `https://ia-app-alpha.vercel.app`, are redirected before
authentication to the statically rendered `/moved` migration notice.
That notice links to the production origin and to the unlisted
`/pwa-setup` platform guide for replacing an old Home Screen app.

## Build Checks

Run the narrow checks first while developing:

```bash
bun run --filter cvx codegen
bun run --filter cvx typecheck
bun run --filter web build
```

`bun run lint` is the intended broad check, but the current handoff notes mention
legacy app lint failures until that app is removed or fixed.

## Related

- [Developer setup](../reference/getting-started.md)
- [Seed and reset](../backend/seed-and-reset.md)
