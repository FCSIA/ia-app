---
tags: [backend, convex]
---

# Convex Backend

← [[index|Home]] / [[backend-overview]]

---

## Folder Layout

Convex is a workspace app under `apps/convex/`.

```
apps/convex/
├── convex.json         ← Convex project config
├── package.json        ← Convex app scripts and dependencies
├── seed-data/          ← static demo fixtures owned by the Convex app
└── src/                ← Convex functions, schema, components, generated types
```

The functions folder is `src/`, not the default `convex/`. This is intentional:
`apps/convex/convex.json` sets `"functions": "src/"`, which keeps the monorepo
layout readable without nesting `apps/convex/convex/`.

Generated API types live in `apps/convex/src/_generated/`. Web imports use the
repo-root `~` alias, for example:

```ts
import { api } from '~/apps/convex/src/_generated/api';
```

Do not add a Convex-specific path alias. The root alias is the shared monorepo
escape hatch for generated files and other cross-app imports.

---

## Commands

Run Convex commands through the workspace package:

```bash
CONVEX_AGENT_MODE=anonymous direnv exec . pnpm --filter convex-backend codegen
direnv exec . pnpm --filter convex-backend typecheck
direnv exec . pnpm --filter convex-backend auth:generate
```

`codegen` runs Convex code generation with Convex's built-in typecheck disabled
because this repo uses hoisted `node_modules`. The explicit `typecheck` script
then runs `tsc -p apps/convex/src/tsconfig.json`.

---

## Seed Data

Convex-owned fixtures should live under `apps/convex/seed-data/`. Seed/reset
functions live under `apps/convex/src/` and import those fixtures.

Legacy Prisma seed files stay under `apps/api/prisma/seed-data/` until the
legacy API is removed. Do not make the Convex schema preserve old Prisma IDs
just to reuse those files.

Current seed functions:

```bash
cd apps/convex
PATH=../../node_modules/.bin:$PATH convex run courses/seed:seedFromStaticData \
  '{"secret":"<COURSE_SEED_SECRET_OR_BOOTSTRAP_SECRET>","reset":true}'

PATH=../../node_modules/.bin:$PATH convex run schedule/seed:seedFromStaticData \
  '{"secret":"<SCHEDULE_SEED_SECRET_OR_BOOTSTRAP_SECRET>","reset":true,"batchSize":20}'
```

The course seed mutation accepts `COURSE_SEED_SECRET` first and falls back to
`BOOTSTRAP_SECRET`. The schedule seed mutation accepts `SCHEDULE_SEED_SECRET`
first and falls back to `BOOTSTRAP_SECRET`.

`schedule/seed:seedFromStaticData` is cursor-based because a full fixture creates a
schedule and 40 schedule-entry documents for each student. Re-run it with the
returned `nextCursor` until `isDone` is `true`:

```bash
PATH=../../node_modules/.bin:$PATH convex run schedule/seed:seedFromStaticData \
  '{"secret":"<SCHEDULE_SEED_SECRET_OR_BOOTSTRAP_SECRET>","cursor":"20","batchSize":20}'
```

If `reset:true` returns deleted rows with `isDone:false`, call it again with
`reset:true` until the deleted counts are zero and seeding begins. Keep this
reset-friendly posture while all data is fake.

---

## Related

- [[backend-auth]] — Better Auth + Convex auth model
- [[courses]] — Course catalog now has Convex read functions
- [[notifications]] — Convex notification reads and preferences
