---
tags: [feature, users, admin]
---

# Users and Admin

[Home](../index.md)

User management is handled through Convex functions and the Admin Panel.

## What It Does

- Lists students and staff for admin workflows.
- Creates and links app users to Better Auth users.
- Imports and exports student rows by CSV.
- Activates, deactivates, bulk-deletes, assigns roles, and resets passwords.
- Stores dashboard layout preferences for each user.

## Source Files

- Backend: `apps/convex/src/users/`
- Auth helpers: `apps/convex/lib/currentUser.ts`
- Web auth helpers: `apps/web/src/lib/auth.ts`
- Admin UI: `apps/web/src/app/admin/`

## Convex Surface

- `api.users.me.me`
- `api.users.me.updateDashboardLayout`
- `api.users.auth.changePassword`
- `api.users.admin.list`
- `api.users.admin.createUser`
- `api.users.admin.importStudents`
- `api.users.admin.exportStudents`
- `api.users.admin.activate`
- `api.users.admin.deactivate`
- `api.users.admin.deleteUsers`
- `api.users.admin.assignRoles`
- `api.users.admin.resetPassword`

## Data Model

The `users` table stores app profile data, role arrays, grade/pathway metadata,
active state, and Better Auth linkage via `authUserId`.

## Permissions

Admin user-management mutations require admin-level roles. Bulk account deletion
is limited to super admins, cannot include the acting account, and removes the
linked Better Auth identity, sessions, profile record, and profile images.
Historical school and collaboration records remain for audit continuity. Normal
users can read their own public profile and change their own password.

## Side Effects

Administrative changes write audit events so staff can review who changed user
state.

## Related

- [Auth and roles](../backend/auth-and-roles.md)
- [Audit log](audit-log.md)
