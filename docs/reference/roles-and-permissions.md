---
tags: [reference, roles, permissions, auth]
---

# Roles and Permissions

[Home](../index.md)

Users can hold multiple roles simultaneously. They are stored as a `roles` array
on the Convex `users` table.

## The 8 Roles

| Role             | Typical user         | Description                                                            |
| ---------------- | -------------------- | ---------------------------------------------------------------------- |
| `STUDENT`        | Student              | Base role. Can read content, register for flex sessions, post comments |
| `STUDENT_LEADER` | Club leader          | Elevated student. Can invite club members and post club announcements  |
| `STUDENT_ADMIN`  | Student council      | Higher-level student admin capabilities                                |
| `TEACHER`        | Teacher              | Can create flex sessions and events                                    |
| `SPONSOR`        | Club sponsor         | Can manage sponsored clubs and approve club workflows                  |
| `SUPPORT_STAFF`  | IT / office staff    | Read-oriented admin access for users, reports, and audit log           |
| `ADMIN`          | School administrator | Full admin access except super-admin-only actions                      |
| `SUPER_ADMIN`    | System owner         | All permissions including CSV import and user role management          |

## Permission Matrix

### Announcements

| Permission           | STUDENT | TEACHER  | SPONSOR  | ADMIN | SUPER_ADMIN |
| -------------------- | ------- | -------- | -------- | ----- | ----------- |
| View school-wide     | Yes     | Yes      | Yes      | Yes   | Yes         |
| View club as member  | Yes     | Yes      | Yes      | Yes   | Yes         |
| Create               | No      | Yes      | Yes      | Yes   | Yes         |
| Create admin-general | No      | No       | No       | Yes   | Yes         |
| Archive              | No      | Own only | Own only | Yes   | Yes         |
| Comment              | Yes     | Yes      | Yes      | Yes   | Yes         |
| Delete any comment   | No      | No       | No       | Yes   | Yes         |

### Clubs

| Permission        | STUDENT     | TEACHER | SPONSOR | ADMIN | SUPER_ADMIN |
| ----------------- | ----------- | ------- | ------- | ----- | ----------- |
| View all clubs    | Yes         | Yes     | Yes     | Yes   | Yes         |
| Create club       | No          | No      | No      | Yes   | Yes         |
| Invite members    | Leader only | No      | Yes     | Yes   | Yes         |
| Remove members    | No          | No      | Yes     | Yes   | Yes         |
| Promote to leader | No          | No      | Yes     | Yes   | Yes         |

Club sponsors, club leaders, admins, and super admins can configure a club's
nested structure and assign existing club members within it. A unit-local
`LEADER` assignment and title describe responsibility inside that unit; they do
not grant club-wide management permissions.

### Events

| Permission          | STUDENT | TEACHER  | SPONSOR  | ADMIN | SUPER_ADMIN |
| ------------------- | ------- | -------- | -------- | ----- | ----------- |
| View published      | Yes     | Yes      | Yes      | Yes   | Yes         |
| Create              | No      | Yes      | Yes      | Yes   | Yes         |
| Approve club events | No      | No       | Yes      | Yes   | Yes         |
| Publish             | No      | No       | No       | Yes   | Yes         |
| Cancel              | No      | Own only | Own only | Yes   | Yes         |

### Flex Friday

| Permission                    | STUDENT | TEACHER      | ADMIN | SUPER_ADMIN |
| ----------------------------- | ------- | ------------ | ----- | ----------- |
| View sessions                 | Yes     | Yes          | Yes   | Yes         |
| Register for `STUDENT_CHOICE` | Yes     | No           | No    | No          |
| Create sessions               | No      | Yes          | Yes   | Yes         |
| Assign students               | No      | Own sessions | Yes   | Yes         |
| Create Flex Friday dates      | No      | No           | Yes   | Yes         |

### Schedule

| Permission                           | STUDENT | STUDENT_LEADER | STUDENT_ADMIN | ADMIN | SUPER_ADMIN |
| ------------------------------------ | ------- | -------------- | ------------- | ----- | ----------- |
| Open `/schedule`                     | Yes     | Yes            | Yes           | Yes   | Yes         |
| Save personal schedule               | Yes     | Yes            | Yes           | No    | No          |
| Set personal schedule public/private | Yes     | Yes            | Yes           | No    | No          |
| Search and pin friends               | Yes     | Yes            | Yes           | No    | No          |
| View a friend's public schedule      | Yes     | Yes            | Yes           | No    | No          |
| Manage school day blocks             | No      | No             | No            | Yes   | Yes         |

### Admin Panel

| Permission                | SUPPORT_STAFF | ADMIN | SUPER_ADMIN |
| ------------------------- | ------------- | ----- | ----------- |
| View users                | Yes           | Yes   | Yes         |
| Deactivate/activate users | No            | Yes   | Yes         |
| Assign roles              | No            | No    | Yes         |
| Import CSV                | No            | No    | Yes         |
| View reports              | Yes           | Yes   | Yes         |
| Resolve reports           | Yes           | Yes   | Yes         |
| Manage keywords           | No            | Yes   | Yes         |
| View audit log            | Yes           | Yes   | Yes         |

## Enforcement

Convex functions enforce permissions server-side. UI checks are only for
presentation. Common helper locations:

- `apps/convex/lib/currentUser.ts`
- `apps/convex/src/lib/roles.ts`
- `apps/web/src/lib/auth.ts`

## Seed Account Roles

| uniqueId          | Roles                  |
| ----------------- | ---------------------- |
| `SUPER001`        | `SUPER_ADMIN`, `ADMIN` |
| `ADMIN001`        | `ADMIN`                |
| `TCH001`          | `TEACHER`, `SPONSOR`   |
| `STU001`-`STU010` | `STUDENT`              |

Seeded accounts use random temporary passwords retrieved once through
`bootstrap:claimSeedCredentials` after the run completes.

## Related

- [Auth and roles](../backend/auth-and-roles.md)
- [Users and admin](../features/users-admin.md)
- [Seed and reset](../backend/seed-and-reset.md)
