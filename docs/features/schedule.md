---
tags: [feature, schedule, students, admin]
---

# Schedule

[Home](../index.md)

The schedule workspace gives students a canonical class grid, friend
comparison, and date-aware school-day context. Admins manage reusable regular
and special-day plans without rewriting student course choices.

## What It Does

- Students build a 5-day schedule from official courses, with a manual class-name option when a class is not in the catalog.
- Every student selects exactly one lunch assignment: Period 4 or Period 5. A selected lunch period cannot also contain a class on any weekday.
- Students can inspect the resolved schedule for a date, including reordered or shortened periods, custom blocks, omitted periods, and special-day labels.
- Students choose public/private schedule visibility.
- Students search classmates and send friend requests.
- Accepted friends can compare public schedules.
- Admins create reusable regular or special templates, reorder canonical periods, change block times, and snapshot a template onto a specific date.
- Resetting a date override returns it to the current regular template. Editing a template later does not retroactively change dates already copied from it.

## Source Files

- Backend: `apps/convex/src/schedule/`
- Web page: `apps/web/src/app/schedule/page.tsx`
- Schedule components: `apps/web/src/components/schedule/`
- Seed fixtures: `apps/convex/seed-data/schedule.ts`

## Convex Surface

- `api.schedule.dashboard.get`
- `api.schedule.dashboard.save`
- `api.schedule.friends.search`
- `api.schedule.friends.sendRequest`
- `api.schedule.friends.acceptRequest`
- `api.schedule.friends.remove`
- `api.schedule.dayPlans.getAdminWorkspace`
- `api.schedule.dayPlans.saveTemplate`
- `api.schedule.dayPlans.setRegularTemplate`
- `api.schedule.dayPlans.applyTemplateToDate`
- `api.schedule.dayPlans.saveDateOverride`
- `api.schedule.dayPlans.resetDateOverride`
- `api.schedule.dayPlans.deleteTemplate`
- `internal.schedule.migrations.getLunchMigrationReport`
- `api.schedule.blocks.createBlock`
- `api.schedule.blocks.updateBlock`
- `api.schedule.blocks.deleteBlock`
- `internal.schedule.seed.seedFromStaticData`

## Data Model

- `studentSchedules`
- `studentScheduleEntries`
- `studentScheduleFriends`
- `schoolDayBlocks`
- `schoolDayTemplates`
- `schoolDayTemplateBlocks`
- `schoolScheduleSettings`
- `schoolDayDateOverrides`
- `schoolDayDateBlocks`
- `courses`

Schedule entries are child documents keyed by weekday and period instead of an
unbounded array on the schedule document. Special-day blocks reference those
same canonical periods. Reordering Period 3 changes when a student's saved
Period 3 course meets; it never copies or moves the course document.

`studentSchedules.lunchPeriod` is a single `PERIOD_4 | PERIOD_5` discriminant,
not two booleans. It remains optional during the first deployment so legacy
rows can be backfilled safely. Readers infer only unambiguous legacy schedules;
rows with classes in both lunch candidates remain visibly unresolved.

## Permissions

Students manage their own schedule and friend relationships. Admin roles manage
day templates and date overrides. Friend schedule visibility depends on
accepted friendship and the owner's public/private setting.

## Side Effects

Schedule saves, block changes, and friend actions write audit events. Friend
requests create notification deliveries.

## Lunch Migration Runbook

This PR is the widen-and-migrate deployment. Do not make `lunchPeriod` required
in the schema until the backfill has completed and every ambiguous schedule has
been resolved by a student or administrator.

After deploying the widened schema and dual-read/write code, inspect the bounded
report and dry-run the first migration batch:

```bash
pnpm --filter cvx exec convex run schedule/migrations:getLunchMigrationReport
pnpm --filter cvx exec convex run schedule/migrations:backfillLunchPeriod '{"dryRun":true}'
```

Run the resumable migration and watch component status:

```bash
pnpm --filter cvx exec convex run schedule/migrations:backfillLunchPeriod
pnpm --filter cvx exec convex run --component migrations lib:getStatus --watch
```

Use `--prod` for the production deployment. Re-run the report after completion;
its unresolved IDs require an explicit Period 4/5 decision and must not be
silently defaulted or have courses deleted. Narrow the schema in a later PR only
after no legacy row remains without `lunchPeriod`.

## Seed Data

The dashboard-only `bootstrap:resetAndSeed` action runs the schedule seed in
batches after users and courses exist. The schedule seed function is internal and
is not a local CLI entrypoint.

## Related

- [Courses](courses.md)
- [Notifications](notifications.md)
- [Seed and reset](../backend/seed-and-reset.md)
