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
- Stores dashboard layout preferences for each user.
- Lets each user set or clear an optional preferred display name in Profile & Settings on web and native.

## Source Files

- Backend: `apps/convex/src/users/`
- Auth helpers: `apps/convex/lib/currentUser.ts`
- Web auth helpers: `apps/web/src/lib/auth.ts`
- Admin UI: `apps/web/src/app/admin/`

## Convex Surface

- `api.users.me.me`
- `api.users.me.updateDashboardLayout`
- `api.users.me.updatePreferredName`
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

`preferredName` is optional and represents the complete display name. The shared
`apps/shared/user-name.ts` helpers select it when present, otherwise the regular
first and last name. Greetings preserve the regular first-name fallback.
Profile names, chat authors (including existing and optimistic messages), mentions,
club directories, schedules, calendars, announcements, events, Flex Friday,
moderation, audit actors, and Wrapped use this rule on both clients.

Saving trims and collapses whitespace, limits names to 80 characters, rejects
control characters, and updates the user search index in the same transaction.
Blank input removes the preference. Both names remain searchable in global,
friend, admin, invitation, mention, and club directory searches. Regular roster
names and account identifiers remain available for CSV administration and login.
Notification text uses the display name when the notification is created;
previously delivered text is historical content.

## Permissions

Admin user-management mutations require admin-level roles. Bulk account deletion
is limited to super admins, cannot include the acting account, and removes the
linked Better Auth identity, sessions, profile record, and profile images.
Historical school and collaboration records remain for audit continuity. Normal
users can read their own public profile and change their own password.
They can also change their own preferred name; the mutation derives the account
from the authenticated identity and accepts no target user ID.

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
- [Preferred-name test checklist](preferred-names-testing.md)
