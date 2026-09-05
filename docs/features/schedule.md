---
tags: [feature, schedule, students, admin]
---

# Schedule

[Home](../index.md)

The schedule workspace gives students a canonical class grid, friend
comparison, and date-aware school-day context. Admins manage reusable regular
and special-day plans without rewriting student course choices.

## What It Does

- Students manage classes from an actual school date instead of a Monday–Friday selector strip, with a manual class-name option when a class is not in the catalog.
- Students can upload an Infinite Campus Schedule Term screenshot or photo. The app temporarily stages it in authenticated Convex storage, sends its bytes to Google Cloud Vision for OCR, then deletes the staged image whether OCR succeeds or fails. The review table requires every class to have a unique, explicitly confirmed canonical period before it can apply to every school weekday.
- Every student selects exactly one lunch assignment: Period 4 or Period 5. A selected lunch period cannot also contain a class on any weekday.
- Students can inspect the resolved schedule for a date, including reordered or shortened periods, custom blocks, omitted periods, and special-day labels.
- Students choose public/private schedule visibility.
- Students search classmates and send friend requests.
- Students can create seven-day, revocable friend links. Request links send a
  normal request; explicitly selected auto-accept links create the friendship
  immediately when another active student redeems them.
- Accepted friends can compare public schedules.
- Students can organize accepted friends into private comparison groups, see
  exact shared-course subsets plus shared lunch periods, and compare one
  friend's public schedule beside their own.
- Admins create reusable regular, special, and no-school templates, reorder canonical periods, and change block times.
- Students choose a saved 12-hour or 24-hour display format from Profile settings; AM/PM is the default for every account.
- Every in-range Monday–Thursday inherits the required default regular template unless an administrator assigns another template or creates a custom date plan.
- Fridays remain explicitly unassigned until an administrator assigns a template. Resetting a Friday returns it to unassigned; resetting Monday–Thursday returns it to the default template.
- Date assignments stay linked to their template, so later template edits update every linked date. `Unlink and customize` snapshots the current blocks onto that date and severs the link.
- No-school templates are a first-class plan type with zero schedule blocks. They are not represented by fake periods or an audience label.

## Academic Year Setup

The schedule calendar is deployment data. A newly initialized production database requires the first `ADMIN` or `SUPER_ADMIN` who opens day-plan management to configure:

- the academic-year first and last dates;
- the required default regular template.

The dates are intentionally not compiled into the application because they change every year. Until setup is complete, day-plan management renders only a compact setup form built from the shared date-picker, button, badge, and tooltip primitives; the calendar, date inspector, and normal template tabs are not shown. The picker permits future-year navigation so an academic year can cross a calendar-year boundary. Dates cannot be assigned, and student day resolution reports that school-calendar setup is required. Administrators can update the boundaries later. The backend accepts at most a 400-day span.

Calendar setup does not block students from editing or saving their canonical
Period 1–8 class choices. Until setup is complete, the editor falls back to the
canonical period grid without school-day times; resolved timing and date-plan
details remain unavailable until an administrator finishes setup.

Within the configured range, dates resolve as follows:

| Date                      | No explicit assignment    | Explicit assignment                     |
| ------------------------- | ------------------------- | --------------------------------------- |
| Monday–Thursday           | Required default template | Linked template or unlinked custom plan |
| Friday                    | Unassigned                | Linked template or unlinked custom plan |
| Saturday–Sunday           | Not a school date         | Assignments are rejected                |
| Outside the academic year | Not a school date         | Assignments are rejected                |

After setup, the admin workspace keeps a full month calendar visible. Compact status dots and a visible legend identify inherited defaults, unassigned Fridays, linked/custom assignments, and no-school days without putting status sentences inside day cells. Shared Fluid tooltips provide the exact date state and explain inheritance and linkage.

## Source Files

- Backend: `apps/convex/src/schedule/`
- Web page: `apps/web/src/app/schedule/page.tsx`
- Schedule components: `apps/web/src/components/schedule/`
- OCR parser: `apps/web/src/lib/schedule-ocr.ts`
- Google Vision adapter: `apps/convex/src/schedule/importOcr.ts`
- Seed fixtures: `apps/convex/seed-data/schedule.ts`

## Convex Surface

- `api.schedule.dashboard.get`
- `api.schedule.dashboard.save`
- `api.schedule.friends.search`
- `api.schedule.friends.sendRequest`
- `api.schedule.friends.acceptRequest`
- `api.schedule.friends.remove`
- `api.schedule.shareLinks.listMine`
- `api.schedule.shareLinks.create`
- `api.schedule.shareLinks.revoke`
- `api.schedule.shareLinks.preview`
- `api.schedule.shareLinks.redeem`
- `api.schedule.groups.listMine`
- `api.schedule.groups.listEligibleFriends`
- `api.schedule.groups.get`
- `api.schedule.groups.create`
- `api.schedule.groups.rename`
- `api.schedule.groups.addMember`
- `api.schedule.groups.removeMember`
- `api.schedule.groups.remove`
- `api.schedule.dayPlans.getAdminWorkspace`
- `api.schedule.dayPlans.saveTemplate`
- `api.schedule.dayPlans.setRegularTemplate`
- `api.schedule.dayPlans.configureAcademicYear`
- `api.schedule.dayPlans.applyTemplateToDate`
- `api.schedule.dayPlans.unlinkDateTemplate`
- `api.schedule.dayPlans.saveDateOverride`
- `api.schedule.dayPlans.resetDateOverride`
- `api.schedule.dayPlans.deleteTemplate`
- `internal.schedule.migrations.getLunchMigrationReport`
- `api.schedule.blocks.createBlock`
- `api.schedule.blocks.updateBlock`
- `api.schedule.blocks.deleteBlock`
- `internal.schedule.seed.seedFromStaticData`
- `api.schedule.importOcr.scanImage`

## Data Model

- `studentSchedules`
- `studentScheduleEntries`
- `studentScheduleFriends`
- `studentFriendShareLinks`
- `studentScheduleGroups`
- `studentScheduleGroupMembers`
- `schoolDayBlocks`
- `schoolDayTemplates`
- `schoolDayTemplateBlocks`
- `schoolScheduleSettings`
- `schoolDayDateOverrides`
- `schoolDayDateBlocks`
- `courses`

Schedule entries are child documents keyed by weekday and period instead of an
unbounded array on the schedule document. A student's class choice for a
canonical period is mirrored across every school weekday, so special-day blocks
reference the same class regardless of the date selected. Reordering Period 3
changes when a student's saved Period 3 course meets; it never copies or moves
the course document.

`schoolScheduleSettings` stores the academic-year boundaries and required
regular template. A `LINKED` date override resolves blocks and its display name
from `sourceTemplateId` at read time. A `CUSTOM` override owns
`schoolDayDateBlocks`; unlinking performs the one explicit template-to-date
snapshot. Legacy overrides without a mode continue to resolve as custom
snapshots. Template and settings fields are widened as optional so existing
deployments remain valid until administrators complete setup.

`studentSchedules.lunchPeriod` is a single `PERIOD_4 | PERIOD_5` discriminant,
not two booleans. It remains optional during the first deployment so legacy
rows can be backfilled safely. Readers infer only unambiguous legacy schedules;
rows with classes in both lunch candidates remain visibly unresolved.

## Permissions

Students manage their own schedule and friend relationships. `ADMIN` and
`SUPER_ADMIN` roles manage academic-year settings, day templates, and date
assignments. Friend schedule visibility depends on accepted friendship and
the owner's public/private setting. Comparison groups are owner-private: members
do not gain access to one another, and every group read rechecks active-student,
accepted-friendship, and current schedule-visibility state.

## Schedule Image Import

Schedule OCR accepts PNG, JPEG, and WebP images up to 10 MB. It is limited to
eight scans per student per hour. Images are not retained after the OCR action;
the feature stores neither image bytes nor OCR text in application tables.
Google Cloud Vision receives the image solely to perform OCR. Deployment owners
must configure the `GOOGLE_VISION_SERVICE_ACCOUNT_JSON` secret with a
least-privilege service account that has Cloud Vision access. The import UI must
not be enabled in a deployment until its Google Cloud data-processing terms have
been approved.

Friend links are bearer capabilities. The server generates a 256-bit URL-safe
secret, stores only its SHA-256 digest, expires it after seven days, bounds use
and redemption attempts, and supports owner revocation. Request-mode redemption
never auto-accepts an existing reverse request; only an explicitly created
auto-accept link may accept a pending relationship.

## Side Effects

Schedule saves, block changes, and friend actions write audit events. Friend
requests create notification deliveries. A material update to a resulting
public schedule enqueues bounded, cursor-paginated friend notifications; private
schedule content and course details are not included in notification copy.

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

The internal `bootstrap:resetAndSeed` action runs the schedule seed in batches
after users and courses exist. Invoke the orchestrator from the Convex CLI or
Dashboard; the individual schedule seed function is not a local CLI entrypoint.

## Related

- [Courses](courses.md)
- [Notifications](notifications.md)
- [Seed and reset](../backend/seed-and-reset.md)
