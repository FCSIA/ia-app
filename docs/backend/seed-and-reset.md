---
tags: [backend, seed, convex]
---

# Seed and Reset

[Home](../index.md)

Local demo data is seeded through Convex mutations orchestrated by
`scripts/convex-db.mjs`.

## Commands

```bash
pnpm db:seed
pnpm db:reset
pnpm db:generate
pnpm db:studio
```

`pnpm db:generate` runs Convex codegen. `pnpm db:studio` starts the Convex dev
dashboard/compiler.

## Required Secret

Seed/reset commands require `BOOTSTRAP_SECRET` in two places:

- local environment, so the script can pass it,
- Convex deployment environment, so the mutation can verify it.

Set it on the selected dev deployment:

```bash
cd apps/convex
convex env set BOOTSTRAP_SECRET 42
cd ../..
```

## Seed Flow

`pnpm db:seed` runs:

1. `bootstrap:resetAndSeed` with `reset: false`
2. `courses/seed:run`
3. `schedule/seed:seedFromStaticData` in batches

`pnpm db:reset` runs the same flow with destructive reset behavior before
re-seeding.

## Seed Sources

- `apps/convex/src/seed.ts` seeds core staff, students, courses, and base
  schedule data.
- `apps/convex/src/seeddata/courses.ts` stores course fixtures.
- `apps/convex/src/seeddata/schedule.ts` stores schedule fixtures.
- `apps/convex/src/schedule/seed.ts` writes batched schedule documents.

## Related

- [Developer setup](../../SETUP.md)
- [Schema map](../database/schema-map.md)
