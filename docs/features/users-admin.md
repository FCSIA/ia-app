---
tags: [feature, users, admin]
---

# Users and Admin

[Home](../index.md)

User management is handled through Convex functions and the Admin Panel.

## What It Does

- Lists students and staff for admin workflows.
- Creates and links app users to Better Auth users.
- Imports and exports student rows by CSV, bulk-updates student grade and pathway fields by CSV, and imports administrator accounts by CSV.
- Activates, deactivates, bulk-deletes, assigns roles, and resets passwords.
- Stores dashboard widget order and optional desktop column positions for each user.

The Admin Panel title appears in the app header. On narrow screens, section
tabs and user-table columns scroll horizontally within their own areas. Filters
and selection controls wrap to the available width; pagination stays outside
the scrolling records so it remains reachable.

## Profile settings

`/profile` uses one identity/navigation card beside unframed account, notification,
appearance, moderation, and release-note sections. The selected navigation label
provides context; panels avoid repeating it as a decorative title or subtitle.
Useful inner groups and quiet separators remain. The identity block has no
divider above its navigation. The document reserves a stable scrollbar gutter
so changing panel height does not move the centered layout horizontally.

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
- `api.users.admin.updateStudents`
- `api.users.admin.importAdministrators`
- `api.users.admin.exportStudents`
- `api.users.admin.activate`
- `api.users.admin.deactivate`
- `api.users.admin.deleteUsers`
- `api.users.admin.assignRoles`
- `api.users.admin.resetPassword`

## Data Model

The `users` table stores app profile data, role arrays, grade/pathway metadata,
active state, and Better Auth linkage via `authUserId`.

Dashboard preferences keep `dashboardLayout` as the mobile reading order and
`dashboardColumns` as two optional desktop columns. Legacy flat preferences retain
their alternating split. Fresh defaults balance once after widget heights settle;
manual moves remain in their chosen columns. In the two-column edit view,
**Balance layout** enables when rearranging can meaningfully shorten the page,
with a brief animation and Undo. Done persists both preferences to the signed-in
user only, and keeps the editor open if saving fails. Older clients that save
only a flat order clear stale desktop positions.

## Permissions

Admin user-management mutations require admin-level roles. Bulk account deletion
is limited to super admins, cannot include the acting account, and removes the
linked Better Auth identity, sessions, profile record, and profile images.
Historical school and collaboration records remain for audit continuity. Normal
users can read their own public profile and change their own password.

Administrator CSV import is restricted to `SUPER_ADMIN`. It accepts up to 200
rows with `first_name,last_name,administrator_id,email`, creates only `ADMIN`
accounts, requires a supplied email, skips existing IDs rather than overwriting
them, returns temporary credentials only to the initiating browser, and records
the batch count in the audit log. It cannot create `SUPER_ADMIN` accounts.

## Side Effects

Administrative changes write audit events so staff can review who changed user
state.

## Related

- [Auth and roles](../backend/auth-and-roles.md)
- [Audit log](audit-log.md)
