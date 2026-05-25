---
tags: [backend, auth, convex, better-auth, security]
---

# Authentication & Authorization

← [[index|Home]] / [[backend-overview]]

---

## Current Model

The Convex port uses **Better Auth backed by Convex** for authentication and the
app `users` table for school-specific authorization.

Authentication answers "who is signed in?" Better Auth owns the credential,
session, and password APIs.

Authorization answers "what can this person do?" Convex functions load the
linked app user and check its app roles.

---

## Server Files

- `apps/convex/src/auth.ts` configures Better Auth, the username plugin, the admin
  plugin, and the Convex auth plugin.
- `apps/convex/src/http.ts` registers the Better Auth HTTP routes.
- `apps/convex/src/auth.config.ts` exposes Better Auth JWT discovery to Convex.
- `apps/convex/src/users/` owns app-user lookup, admin-created users, password changes,
  front-office password resets, activation, deactivation, role assignment, and
  user listing.
- `apps/convex/src/lib/currentUser.ts` derives the current app user from the Better Auth
  auth user. Convex functions must use this instead of accepting a caller
  supplied user id for authorization.
- `apps/convex/src/audit/lib.ts` records audit events for sensitive user-management
  actions.

---

## Account Rules

- Public signup is disabled.
- `uniqueId` is the Better Auth username.
- Admin/import workflows create users and generate temporary passwords.
- Users created with generated passwords get `mustResetPassword: true`.
- Front-office/support staff may reset student passwords only.
- Only super admins may create or modify privileged admin accounts.
- No legacy Postgres id compatibility is preserved for the Convex port.

---

## Authorization Pattern

Every protected Convex function should derive identity server-side:

```ts
const actor = await getCurrentAppUser(ctx);
requireAnyRole(actor, ['ADMIN', 'SUPER_ADMIN']);
```

Do not accept `userId` arguments as proof of the caller. Arguments may identify
the target of an operation, but the actor must always come from Better Auth via
Convex.

---

## User Listing

Admin user listing uses Convex indexes/search instead of SQL offset pagination.
The frontend uses cursor pagination from `api.users.admin.list`. The `users` table
stores role-group booleans and `searchText` to keep common admin filters indexed.

---

## Audit Logging

Sensitive user-management mutations write `auditEvents` rows:

- `user.created`
- `user.bootstrap_super_admin`
- `user.password_changed`
- `user.password_reset`
- `user.activated`
- `user.deactivated`
- `user.roles_assigned`

The app policy is "keep everything; log everything." Future domains should add
audit events when porting writes that currently have operational or moderation
impact.

---

## Transitional Note

The old Nest/Postgres JWT backend still exists for domains not yet ported. It is
not the target auth model. As each domain moves to Convex, remove its DTOs,
controllers, REST client methods, and localStorage JWT dependency instead of
preserving compatibility.

---

## Related

- [[frontend-auth]] — Next/React Better Auth wiring
- [[roles-and-permissions]] — App roles and permissions
- [[data-flow]] — End-to-end request flow
