---
tags: [feature, wrapped, analytics]
---

# Wrapped

[Home](../index.md)

Wrapped creates end-of-year student summary snapshots from Convex data.

## What It Does

- Generates and stores one yearly summary for every active student, including
  students with no recorded activity.
- Reads activity across schedule, clubs, channels, reactions, mentions, and Flex
  Friday attendance.
- Stores generated summaries in `wrappedSnapshots`.
- Shows students their summary during the May availability window.

## Source Files

- Backend: `apps/convex/src/wrapped/snapshots.ts`
- Web page: `apps/web/src/app/wrapped/page.tsx`
- Admin tab hook: `apps/web/src/app/admin/_hooks/use-admin-wrapped.ts`
- Availability helper: `apps/web/src/lib/wrapped.ts`

## Convex Surface

- `api.wrapped.snapshots.availability`
- `api.wrapped.snapshots.getMine`
- `api.wrapped.snapshots.snapshotStatus`
- `api.wrapped.snapshots.generateSnapshots`

## Data Model

`wrappedSnapshots` stores the user, school-year start, summary payload, creation
time, and generation metadata. Snapshot generation runs in durable batches, so
an admin-triggered run cannot stop after a first page of students. A nightly
cron refreshes the current school year's records; the final stored snapshot is
therefore available for every eligible student before the May viewing window.

## Permissions

Students read their own snapshot. Admins generate snapshots and inspect
generation status from the Admin Panel.

## Known Limits

Snapshot generation processes ten users per transaction and schedules the next
batch. This keeps each transaction bounded while allowing the run to cover the
entire student population.

## Related

- [Schedule](schedule.md)
- [Clubs](clubs.md)
- [Flex Friday](flex-friday.md)
