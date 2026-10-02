---
tags: [feature, audit, admin]
---

# Audit Log

[Home](../index.md)

The audit log records significant system actions for admin review.

## What It Does

- Stores actor, action, entity, metadata, and timestamp for important writes.
- Shows newest-first audit rows in the Admin Panel.
- Supports cursor pagination and a detail view for individual rows.

## Source Files

- Backend: `apps/convex/src/audit/`
- Shared logger: `apps/convex/src/audit/_lib.ts`
- Web admin hooks/components: `apps/web/src/app/admin/_hooks/use-admin-audit.ts`
  and `apps/web/src/app/admin/_components/audit/`

## Convex Surface

- `api.audit.events.list`
- `api.audit.events.listPage`
- `api.audit.events.get`

## Data Model

`auditEvents` stores:

- `actorId`
- `action`
- `entityType`
- `entityId`
- `meta`
- `createdAt`

## Permissions

Admin-facing audit reads are restricted to elevated roles in the Convex query
layer. Normal users do not read audit rows.

## Side Effects

Domain mutations call `logAuditEvent(ctx, ...)` after meaningful writes such as
user changes, schedule saves, friend requests, announcement changes,
moderation updates, event approvals, Flex Friday changes, and channel-message
posts, edits, deletes, pins, and reaction adds/removals. Whiteboard creates,
edits, renames, archives, and restores are audited too; see
[Whiteboards](whiteboards.md).

## Known Limits

Some admin filters still happen after page hydration because actor names and
free-form metadata are not all indexed. Add dedicated indexed/search fields
before large production audit search.

## Related

- [Users and admin](users-admin.md)
- [Moderation](moderation.md)
- [Indexes and search](../database/indexes-and-search.md)
