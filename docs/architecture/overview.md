---
tags: [architecture, convex]
---

# Architecture Overview

[Home](../index.md)

The app is a Next.js web app backed by Convex. The browser talks to Convex
through generated function references and reactive hooks; the old REST/API
shape is not the active app data path.

## Runtime Topology

```text
Browser
  -> Next.js app in apps/web
  -> Better Auth route proxy at /api/auth/*
  -> Convex React hooks and generated api references
  -> Convex functions, database, auth component, and storage
```

The web app owns UI, routing, client state, and upload form handling. Convex owns
app data, authorization checks, side effects such as audit rows and
notifications, seed/reset, and file storage metadata.

## Main Directories

| Directory | Purpose |
| --- | --- |
| `apps/web/src/app` | Next.js App Router pages and route handlers |
| `apps/web/src/components` | Shared UI, layout, feature components |
| `apps/web/src/lib` | Web clients, helpers, parsing, search, upload helpers |
| `apps/convex/src` | Convex schema, queries, mutations, HTTP routes, auth |
| `apps/convex/src/_generated` | Generated API/data model types |
| `scripts/convex-db.mjs` | Local seed/reset orchestration |

## Current Backend Model

Convex functions are grouped by product domain:

- `users`, `audit`, `notifications`
- `announcements`, `clubs`, `events`, `calendar`
- `courses`, `schedule`, `flexFriday`, `wrapped`
- `moderation`, `uploads`

Each domain exposes public queries/mutations where the web app needs them.
Private helpers stay in `_lib.ts` files or internal functions.

## Important Conventions

- Read `apps/convex/src/_generated/ai/guidelines.md` before touching Convex code.
- Use generated Convex types instead of handwritten transport DTOs.
- Derive authorization server-side from the current Better Auth user.
- Store relationships as Convex IDs, not legacy IDs.
- Add indexes for hot query paths before relying on large in-memory filtering.
- Keep active docs free of stale old-backend instructions.

## Related

- [Data flow](data-flow.md)
- [Convex overview](../backend/convex-overview.md)
- [Schema map](../database/schema-map.md)
