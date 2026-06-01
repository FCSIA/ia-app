---
tags: [backend, auth, roles, convex]
---

# Auth and Roles

[Home](../index.md)

Authentication uses Better Auth on Convex. The app user profile is stored in the
`users` table and linked to the Better Auth user through `authUserId`.

## Auth Files

| Path | Purpose |
| --- | --- |
| `apps/convex/src/auth.ts` | Creates the Better Auth component instance |
| `apps/convex/src/auth.config.ts` | Convex auth provider config |
| `apps/convex/src/http.ts` | Registers Better Auth HTTP routes |
| `apps/convex/src/betterAuth/` | Local Better Auth component schema/config |
| `apps/web/src/lib/auth-client.ts` | Browser auth client |
| `apps/web/src/app/api/auth/[...all]/route.ts` | Next route proxy for auth |
| `apps/web/src/app/providers.tsx` | `ConvexBetterAuthProvider` wrapper |

## Current User Pattern

Backend functions use `getCurrentAppUser(ctx)` from
`apps/convex/src/lib/currentUser.ts`.

That helper:

- asks the Better Auth component for the authenticated auth user,
- looks up the linked app user by `authUserId`,
- rejects inactive accounts,
- returns the full `users` document for authorization checks.

Do not accept `userId` from the browser to decide who is acting.

## App Roles

Roles are validated in `apps/convex/src/validators.ts`:

- `STUDENT`
- `STUDENT_LEADER`
- `STUDENT_ADMIN`
- `TEACHER`
- `SPONSOR`
- `SUPPORT_STAFF`
- `ADMIN`
- `SUPER_ADMIN`

Role checks are intentionally domain-specific. For example, admin user
management is limited to admin roles, while club management also considers club
membership, leader status, and sponsor records.

## Web Auth State

Use `useCurrentUser()` from `apps/web/src/lib/auth.ts` for UI gating. It reads
`api.users.me.me` through Convex and caches a public user in `ia_user` only as a
temporary hydration compatibility layer.

The old `ia_token` localStorage key is not the active auth mechanism for new
data flows.

## Related

- [Frontend authentication](../frontend/frontend-auth.md)
- [Users and admin](../features/users-admin.md)
- [Convex overview](convex-overview.md)
