---
tags: [feature, schedule, students, admin]
---

# Schedule

[Home](../index.md)

The schedule workspace gives students a class grid, friend comparison, and live
school-day context. Admins define the bell schedule that powers current block
detection.

## What It Does

- Students build a 5-day schedule from official courses, with a manual class-name option when a class is not in the catalog.
- Students can upload a screenshot of Infinite Campus Schedule Term view. Browser-local OCR proposes period/course matches for review, then applies the reviewed classes Monday through Thursday before the normal save step.
- Students choose public/private schedule visibility.
- Students search classmates and send friend requests.
- Accepted friends can compare public schedules.
- Admins create, edit, and delete weekday bell schedule blocks.

## Source Files

- Backend: `apps/convex/src/schedule/`
- Web page: `apps/web/src/app/schedule/page.tsx`
- Schedule components: `apps/web/src/components/schedule/`
- OCR parser: `apps/web/src/lib/schedule-ocr.ts`
- Seed fixtures: `apps/convex/seed-data/schedule.ts`

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
- `internal.schedule.seed.seedFromStaticData`

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

The dashboard-only `bootstrap:resetAndSeed` action runs the schedule seed in
batches after users and courses exist. The schedule seed function is internal and
is not a local CLI entrypoint.

## Related

- [Courses](courses.md)
- [Notifications](notifications.md)
- [Seed and reset](../backend/seed-and-reset.md)
