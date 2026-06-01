---
tags: [feature, wrapped, analytics]
---

# Wrapped

[Home](../index.md)

Wrapped creates end-of-year student summary snapshots from Convex data.

## What It Does

- Generates per-student yearly summaries for a configured school year.
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
time, and generation metadata.

## Permissions

Students read their own snapshot. Admins generate snapshots and inspect
generation status from the Admin Panel.

## Known Limits

Snapshot generation currently runs as a mutation over bounded seeded/demo data.
Before production-scale year-end generation, move long-running work to a batched
or durable workflow.

## Related

- [Schedule](schedule.md)
- [Clubs](clubs.md)
- [Flex Friday](flex-friday.md)
