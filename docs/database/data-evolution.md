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

## Running Backfills

Migrations live beside the domain they belong to (`src/announcements/migrations.ts`,
`src/clubs/migrations.ts`, `src/flexFriday/migrations.ts`,
`src/schedule/migrations.ts`) and run from the CLI:

```bash
direnv exec . pnpm --filter cvx exec convex run announcements/migrations:backfillCommentCount
```

```bash
direnv exec . pnpm --filter cvx exec convex run clubs/migrations:backfillClubCounts
```

```bash
direnv exec . pnpm --filter cvx exec convex run flexFriday/migrations:backfillFlexSessionCount
```

`convex.json` lives in `apps/convex`, so a root-level `npx convex run` cannot
find the project, and `direnv exec .` is what supplies this repository's Node
version and deployment selection.

Readers fall back to the old shape until a backfill finishes, so a deploy is
never blocked on one. `announcements.commentCount` counts comments the slow way
when the field is missing, `clubs.memberCount` / `clubs.channelCount` read every
membership and channel row, and `flexFridays.sessionCount` reads every session
row; running the backfills is what retires those scans.

Denormalized counters only stay honest if every writer moves them. Route the
writes through the domain's own helper — `adjustCommentCount` for announcements,
`adjustClubCounts` and `recountClub` for clubs, `adjustFlexSessionCount` for Flex
Fridays — rather than patching the field at a call site, and call it before the
insert or delete it accounts for, so the one-time fallback count describes the
state the delta applies to.

## Backfill Candidates

- notification counters,
- audit search fields,
- wrapped summary snapshots,
- storage metadata cleanup,
- future school-year rollover data.

## Tooling Direction

Use Convex-native batched mutations first. If the app needs durable, repeatable
data jobs, evaluate `@convex-dev/migrations`, Workpool, or Workflow in the
specific domain plan.

## Related

- [Seed and reset](../backend/seed-and-reset.md)
- [Schema map](schema-map.md)
