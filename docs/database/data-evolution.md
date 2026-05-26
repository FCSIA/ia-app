---
tags: [database, migrations, convex]
---

# Data Evolution

[Home](../index.md)

The initial port favors clean Convex-native data over preserving old local demo
database IDs. Future schema changes should be planned as Convex-to-Convex data
evolution work.

## Widen, Migrate, Narrow

For breaking data changes:

1. Widen the schema to accept old and new shapes.
2. Deploy readers/writers that can handle both.
3. Backfill existing documents in bounded batches.
4. Narrow validators after old shapes are gone.

Do not run one giant mutation over a large table. Batch work and schedule
continuation when needed.

## Backfill Candidates

- notification counters,
- audit search fields,
- wrapped summary snapshots,
- denormalized club/channel counts,
- storage metadata cleanup,
- future school-year rollover data.

## Tooling Direction

Use Convex-native batched mutations first. If the app needs durable, repeatable
data jobs, evaluate `@convex-dev/migrations`, Workpool, or Workflow in the
specific domain plan.

## Related

- [Seed and reset](../backend/seed-and-reset.md)
- [Schema map](schema-map.md)
