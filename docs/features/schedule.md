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
- Students choose public/private schedule visibility.
- Students search classmates and send friend requests.
- Students can create seven-day, revocable friend links. Request links send a
  normal request; explicitly selected auto-accept links create the friendship
  immediately when another active student redeems them.
- Accepted friends can compare public schedules.
- Students can organize accepted friends into private comparison groups, see
  exact shared-class subsets, and compare one friend's public schedule beside
  their own.
- Admins create, edit, and delete weekday bell schedule blocks.

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
- `api.schedule.blocks.createBlock`
- `api.schedule.blocks.updateBlock`
- `api.schedule.blocks.deleteBlock`
- `internal.schedule.seed.seedFromStaticData`

## Data Model

- `studentSchedules`
- `studentScheduleEntries`
- `studentScheduleFriends`
- `studentFriendShareLinks`
- `studentScheduleGroups`
- `studentScheduleGroupMembers`
- `schoolDayBlocks`
- `courses`

Schedule entries are child documents keyed by weekday and period instead of an
unbounded array on the schedule document.

## Permissions

Students manage their own schedule and friend relationships. Admin roles manage
school-day blocks. Friend schedule visibility depends on accepted friendship and
the owner's public/private setting. Comparison groups are owner-private: members
do not gain access to one another, and every group read rechecks active-student,
accepted-friendship, and current schedule-visibility state.

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

## Seed Data

The dashboard-only `bootstrap:resetAndSeed` action runs the schedule seed in
batches after users and courses exist. The schedule seed function is internal and
is not a local CLI entrypoint.

## Related

- [Courses](courses.md)
- [Notifications](notifications.md)
- [Seed and reset](../backend/seed-and-reset.md)
