---
tags: [reference, roles, permissions, auth]
---

# Roles & Permissions

← [[index|Home]]

---

## The 8 Roles

Users can hold **multiple roles simultaneously**. Stored as an array on the `User` model.

| Role | Typical user | Description |
|------|-------------|-------------|
| `STUDENT` | Student | Base role. Can read content, register for flex sessions, post comments |
| `STUDENT_LEADER` | Club leader | Elevated student — can invite club members, post club announcements |
| `STUDENT_ADMIN` | Student council | Higher-level student admin capabilities |
| `TEACHER` | Teacher | Can create flex sessions, create events |
| `SPONSOR` | Club sponsor (teacher) | Can manage a club's members, approve club events |
| `SUPPORT_STAFF` | IT / office staff | Read-only admin access (view users, reports, audit log) |
| `ADMIN` | School administrator | Full admin access except super-admin only actions |
| `SUPER_ADMIN` | System owner | All permissions including CSV import, user role management |

---

## Permission Matrix

### Announcements

| Permission | STUDENT | TEACHER | SPONSOR | ADMIN | SUPER_ADMIN |
|-----------|---------|---------|---------|-------|-------------|
| View school-wide | ✅ | ✅ | ✅ | ✅ | ✅ |
| View club (as member) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create | ❌ | ✅ | ✅ | ✅ | ✅ |
| Create admin-general | ❌ | ❌ | ❌ | ✅ | ✅ |
| Archive | ❌ | Own only | Own only | ✅ | ✅ |
| Comment | ✅ | ✅ | ✅ | ✅ | ✅ |
| Delete any comment | ❌ | ❌ | ❌ | ✅ | ✅ |

### Clubs

| Permission | STUDENT | TEACHER | SPONSOR | ADMIN | SUPER_ADMIN |
|-----------|---------|---------|---------|-------|-------------|
| View all clubs | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create club | ❌ | ❌ | ❌ | ✅ | ✅ |
| Invite members | Leader only | ❌ | ✅ | ✅ | ✅ |
| Remove members | ❌ | ❌ | ✅ | ✅ | ✅ |
| Promote to leader | ❌ | ❌ | ✅ | ✅ | ✅ |

### Events

| Permission | STUDENT | TEACHER | SPONSOR | ADMIN | SUPER_ADMIN |
|-----------|---------|---------|---------|-------|-------------|
| View published | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create | ❌ | ✅ | ✅ | ✅ | ✅ |
| Approve club events | ❌ | ❌ | ✅ | ✅ | ✅ |
| Publish | ❌ | ❌ | ❌ | ✅ | ✅ |
| Cancel | ❌ | Own only | Own only | ✅ | ✅ |

### Flex Friday

| Permission | STUDENT | TEACHER | ADMIN | SUPER_ADMIN |
|-----------|---------|---------|-------|-------------|
| View sessions | ✅ | ✅ | ✅ | ✅ |
| Register for STUDENT_CHOICE | ✅ | ❌ | ❌ | ❌ |
| Create sessions | ❌ | ✅ | ✅ | ✅ |
| Assign students | ❌ | Own sessions | ✅ | ✅ |
| Create Flex Friday dates | ❌ | ❌ | ✅ | ✅ |

### Admin Panel

| Permission | SUPPORT_STAFF | ADMIN | SUPER_ADMIN |
|-----------|--------------|-------|-------------|
| View users | ✅ | ✅ | ✅ |
| Deactivate/Activate users | ❌ | ✅ | ✅ |
| Assign roles | ❌ | ❌ | ✅ |
| Import CSV | ❌ | ❌ | ✅ |
| View reports | ✅ | ✅ | ✅ |
| Resolve reports | ✅ | ✅ | ✅ |
| Manage keywords | ❌ | ✅ | ✅ |
| View audit log | ✅ | ✅ | ✅ |

---

## How Roles Are Checked

### Backend (NestJS Guard)

```typescript
@Delete(':id')
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
deleteUser(@Param('id') id: string) { ... }
```

The `RolesGuard` checks `user.roles.some(r => requiredRoles.includes(r))`. See [[backend-auth]].

### Frontend (UI conditional rendering)

```typescript
import { hasRole } from '@/lib/auth';
const user = getUser();

// Show admin nav link only to admins
{hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF') && (
  <NavLink href="/admin">Admin Panel</NavLink>
)}
```

Note: hiding UI elements is for UX only. The real enforcement is always on the backend.

---

## Seed Account Roles

| uniqueId | Roles |
|----------|-------|
| `SUPER001` | `[SUPER_ADMIN, ADMIN]` |
| `ADMIN001` | `[ADMIN]` |
| `TCH001` | `[TEACHER, SPONSOR]` |
| `STU001`–`STU004` | `[STUDENT]` |

See [[seed]] for full details.

---

## Related

- [[backend-auth]] — How roles are enforced by guards
- [[frontend-auth]] — `hasRole()` helper for UI decisions
- [[seed]] — Demo accounts
