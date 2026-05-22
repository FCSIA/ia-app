---
tags: [feature, audit, admin]
---

# Audit Log

← [[index|Home]]

---

## Overview

The audit log is an immutable record of every significant action taken in the system. It gives admins full visibility into who did what and when.

**Files:**
- Convex: `apps/convex/src/audit.ts`, `apps/convex/src/lib/audit.ts`
- Web: `apps/web/src/app/admin/` (Audit Log tab)
- Database: [[schema#AuditEvent]]

---

## Audit Event Table

Convex stores audit rows in `auditEvents`:

- `actorId` — optional `users` id; missing means system/bootstrap action
- `action` — event code, currently lower-case dot notation for Convex writes
- `entityType` — affected domain/table kind
- `entityId` — affected document id when available
- `meta` — structured context
- `createdAt` — numeric timestamp

---

## Example Actions Logged

| Action | Entity Type | Context |
|--------|-------------|---------|
| `user.deactivated` | `user` | Account deactivation |
| `user.roles_assigned` | `user` | Manual role assignment |
| `user.password_reset` | `user` | Front-office/admin password reset |
| `SCHEDULE_UPDATED` | `StudentSchedule` | Every time a student saves their classes |
| `SCHEDULE_FRIEND_REQUESTED` | `User` | Friend request sent to another user |
| `CLUB_CREATED` | `Club` | Manual or bulk club creation |
| `CLUB_INVITE_SENT` | `ClubInvite` | Direct invitation issued |
| `CLUB_JOIN_REQUEST_APPROVED`| `Club` | Leader/Sponsor approving a request |
| `KEYWORD_ADDED` | `KeywordRule` | New moderation rule added |
| `REPORT_RESOLVED` | `Report` | Closing a moderation case |
| `EVENT_PUBLISHED` | `Event` | Making an event visible on the calendar |


---

## How Audit Events Are Created

Convex mutations call `logAuditEvent`:

```ts
await logAuditEvent(ctx, {
  actorId: actor._id,
  action: 'user.deactivated',
  entityType: 'user',
  entityId: target._id,
});
```

---

## Viewing the Audit Log

Only admins can view the audit log — it's in the Admin Panel under the "Audit Log" tab. Entries are displayed newest-first with:
- Timestamp (formatted as `Mar 5 14:23:01`)
- Actor name (who performed the action)
- Action code (in monospace, colored accent)
- Entity type + first 8 chars of the entity ID

---

## API Endpoints

The frontend reads audit rows with Convex functions:

- `api.audit.list`
- `api.audit.listPage`
- `api.audit.getOne`

The admin table uses Convex cursor pagination for newest-first browsing. Some
filters still apply after each page is hydrated because actor names and freeform
metadata are not indexed fields yet. Before production scale, move
high-cardinality audit search to explicit search/index fields.

---

## Permissions

| Action | Who can |
|--------|---------|
| View audit log | ADMIN, SUPER_ADMIN, SUPPORT_STAFF |

---

## Related

- [[moderation]] — Moderation actions logged here
- [[roles-and-permissions]] — Admin roles
