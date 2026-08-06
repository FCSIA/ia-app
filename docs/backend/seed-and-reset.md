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

The function is destructive. It clears demo auth/app data and schedules the
reset asynchronously; a successful dashboard call means the run started, not
that it completed.

`resetAndSeed` accepts an optional seed profile. With no argument (or
`{"profile":"development"}`), it uses the development profile: 50 students
and 119 staff. Use `{"profile":"full"}` only when the full 1,500-student,
119-staff dataset is needed.

`seedStatus` reads one indexed `seedRuns` progress record. It reports `IDLE`,
`RUNNING`, `COMPLETE`, or `FAILED`, along with the run id, profile, phase,
cursor, start/update time, completion time, and any error. Wait for `COMPLETE`
or investigate `FAILED`; the completion and error fields are the authoritative
run outcome.

## Seed Flow

`bootstrap:resetAndSeed` orchestrates:

1. Better Auth component cleanup.
2. Core users from `apps/convex/src/seed.ts` using the selected profile.
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

## Expected Profile Counts

- Development (default): 50 students and 119 staff
- Full: 1,500 students and 119 staff

The full profile targets these fixture counts:

- 103 courses
- 26 clubs
- 12 active announcements, 15 total seeded announcements
- 1,500 schedules
- 180 accepted schedule friendships
- 3 moderation keyword rules

## Related

- [Developer setup](../../SETUP.md)
- [Schema map](../database/schema-map.md)
