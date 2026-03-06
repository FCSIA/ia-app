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
  id         String   @id @default(uuid())
  actorId    String?  // who did it (null = system action)
  action     String   // what happened
  entityType String   // what kind of thing was affected
  entityId   String?  // the specific record's ID
  meta       Json?    // any extra context
  createdAt  DateTime @default(now())

  actor User? @relation(...)
}
```

---

## Example Actions Logged

| action | entityType | When |
|--------|-----------|------|
| `USER_DEACTIVATED` | `User` | Admin deactivates a user account |
| `USER_ACTIVATED` | `User` | Admin reactivates a user |
| `ROLES_UPDATED` | `User` | Admin changes a user's roles |
| `REPORT_RESOLVED` | `Report` | Moderation report resolved |
| `REPORT_DISMISSED` | `Report` | Moderation report dismissed |
| `KEYWORD_ADDED` | `KeywordRule` | New keyword rule added |
| `KEYWORD_REMOVED` | `KeywordRule` | Keyword rule deleted |
| `EVENT_PUBLISHED` | `Event` | Event published to calendar |
| `MEMBER_REMOVED` | `ClubMember` | Member removed from club |

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
