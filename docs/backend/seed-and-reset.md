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
demo environment. The dashboard call returns after scheduling the reset work.
Use the internal query `bootstrap:seedStatus` to watch progress until the
expected counts are reached.

`seedStatus` reads user totals from the `appStats` counter table instead of
loading every user document. The counter is updated when users are created or
deleted and rebuilt after the demo user seed completes.

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
