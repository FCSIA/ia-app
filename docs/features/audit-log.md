---
tags: [feature, audit, admin]
---

# Audit Log

← [[index|Home]]

---

## Overview

The audit log is an immutable record of every significant action taken in the system. It gives admins full visibility into who did what and when.

**Files:**
- Backend: `apps/api/src/audit/`
- Web: `apps/web/src/app/admin/` (Audit Log tab)
- Database: [[schema#AuditEvent]]

---

## AuditEvent Model

```prisma
model AuditEvent {
  id         String   @id @default(cuid())
  actorId    String?  // who did it (null = system action)
  action     String   // what happened
  entityType String   // e.g. "User", "Club", "Announcement"
  entityId   String?  // affected record's ID
  meta       Json?    // extra context (e.g. { role: "ADMIN" })
  createdAt  DateTime @default(now())
}
```

---

## Example Actions Logged

| Action | Entity Type | Context |
|--------|-------------|---------|
| `USER_DEACTIVATED` | `User` | Account soft-deletion |
| `USER_ROLES_UPDATED` | `User` | Manual role assignment |
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

The `AuditService` is injected into services that perform significant actions:

```typescript
// In users.service.ts:
async deactivate(id: string, actor: User) {
  await this.prisma.user.update({ where: { id }, data: { isActive: false } });
  await this.auditService.log({
    actorId: actor.id,
    action: 'USER_DEACTIVATED',
    entityType: 'User',
    entityId: id,
  });
}
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

| Method | Path | Description |
|--------|------|-------------|
| GET | `/audit` | Recent audit events (paginated) |

---

## Permissions

| Action | Who can |
|--------|---------|
| View audit log | ADMIN, SUPER_ADMIN, SUPPORT_STAFF |

---

## Related

- [[moderation]] — Moderation actions logged here
- [[roles-and-permissions]] — Admin roles
