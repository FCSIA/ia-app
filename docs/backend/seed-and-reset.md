---
tags: [backend, seed, convex]
---

# Seed and Reset

[Home](../index.md)

Demo data is managed inside Convex. There are no local `pnpm db:seed`,
`pnpm db:reset`, or `pnpm db:clear` commands, and seeding does not use a
bootstrap secret.

Seeding is not automatic on a new deployment. A fresh deployment has schema and
functions only until an operator runs the reset action below.

## Dashboard Reset

Open the Convex Dashboard for the selected deployment and run the internal
function:

```text
bootstrap:resetAndSeed
```

The function is destructive. It clears demo auth/app data and recreates the full
demo environment. The dashboard call only schedules asynchronous reset work; it
does not mean the reset has completed. Use the internal query
`bootstrap:seedStatus` sparingly to watch progress, and verify the final
deployment data before relying on it.

`seedStatus` reads user totals from the `appStats` counter table instead of
loading every user document. The counter is updated when users are created or
deleted and rebuilt after the demo user seed completes. It is a progress signal,
not an atomic completion record: counts can be stale or look plausible while a
later seed phase has not run or has failed.

The current `seedStatus` implementation is reactive and also scans seeded
announcements, schedules, friendships, keyword rules, and notification
preferences. Each reset mutation can re-run a live status subscription, making
it disproportionately database-I/O expensive. Do not leave `seedStatus`
subscribed in the dashboard, a client, or a polling loop during a reset. Check
it manually only when needed, and treat its counts as diagnostic rather than a
completion signal until the status implementation is redesigned.

## Seed Flow

`bootstrap:resetAndSeed` orchestrates:

1. Better Auth component cleanup.
2. Core users from `apps/convex/src/seed.ts`.
3. Courses from `apps/convex/seed-data/courses.ts`.
4. Clubs from `apps/convex/seed-data/clubs.ts`.
5. Announcements, moderation keywords, and notification preferences.
6. Student schedules, school-day blocks, and accepted friend pairs.

Schedule and user writes still run in small internal batches to stay under
Convex transaction limits.

Do not call individual per-domain seed functions as a routine repair shortcut.
They can leave related domains, cleanup, counters, and later seed phases out of
sync. Use the full reset on an isolated demo deployment; use a targeted seed
only for a deliberate, documented repair where its preconditions and follow-up
verification are understood.

## Schema Changes And Existing Demo Data

An existing deployment can contain documents written by another worktree or an
older seed. When a schema change would reject those documents, do not deploy the
narrower schema first. Use widen → migrate → narrow: temporarily accept both
shapes, backfill or remove the old data, verify it, then remove the old shape.

For disposable demo data, the safer alternative is to select a new isolated
local or named cloud deployment before deploying the branch and run a full reset
there. See [Convex Local And Production Runtime](convex-local-production.md).

## Expected Counts

- 1,500 students
- 119 staff
- 103 courses
- 26 clubs
- 12 active announcements, 15 total seeded announcements
- 1,500 schedules
- 180 accepted schedule friendships
- 3 moderation keyword rules

## Related

- [Developer setup](../../SETUP.md)
- [Schema map](../database/schema-map.md)
