---
tags: [feature, schedule, students, admin]
---

# Schedule

[Home](../index.md)

The schedule workspace gives students a class grid, friend comparison, and live
school-day context. Admins define the bell schedule that powers current block
detection.

## What It Does

- Students build a 5-day schedule from official courses.
- Students choose public/private schedule visibility.
- Students search classmates and send friend requests.
- Accepted friends can compare public schedules.
- Admins create, edit, and delete weekday bell schedule blocks.

## Source Files

- Backend: `apps/convex/src/schedule/`
- Web page: `apps/web/src/app/schedule/page.tsx`
- Schedule components: `apps/web/src/components/schedule/`
- Seed fixtures: `apps/convex/src/seeddata/schedule.ts`

## Convex Surface

- `api.schedule.dashboard.get`
- `api.schedule.dashboard.save`
- `api.schedule.friends.search`
- `api.schedule.friends.sendRequest`
- `api.schedule.friends.acceptRequest`
- `api.schedule.friends.remove`
- `api.schedule.blocks.createBlock`
- `api.schedule.blocks.updateBlock`
- `api.schedule.blocks.deleteBlock`
- `api.schedule.seed.seedFromStaticData`

## Data Model

- `studentSchedules`
- `studentScheduleEntries`
- `studentScheduleFriends`
- `schoolDayBlocks`
- `courses`

Schedule entries are child documents keyed by weekday and period instead of an
unbounded array on the schedule document.

## Permissions

Students manage their own schedule and friend relationships. Admin roles manage
school-day blocks. Friend schedule visibility depends on accepted friendship and
the owner's public/private setting.

## Side Effects

Schedule saves, block changes, and friend actions write audit events. Friend
requests create notification deliveries.

## Seed Data

`pnpm db:seed` and `pnpm db:reset` run the schedule seed in batches after users
and courses exist.

Manual run:

```bash
cd apps/convex
PATH=../../node_modules/.bin:$PATH convex run schedule/seed:seedFromStaticData \
  '{"secret":"<BOOTSTRAP_SECRET>","reset":true,"batchSize":20}'
```

Continue with the returned `nextCursor` until `isDone` is true.

## Related

- [Courses](courses.md)
- [Notifications](notifications.md)
- [Seed and reset](../backend/seed-and-reset.md)
