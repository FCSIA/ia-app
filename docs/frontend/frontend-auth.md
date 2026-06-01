---
tags: [frontend, auth, convex, better-auth]
---

# Frontend Authentication

[Home](../index.md) / [Frontend overview](frontend-overview.md)

The web app uses Better Auth on Convex. Authentication is cookie/session based,
and Convex receives auth through `ConvexBetterAuthProvider`.

## Flow

```text
Login page
  -> authClient.signIn.username(...)
  -> Better Auth sets a session cookie
  -> ConvexBetterAuthProvider fetches Convex auth tokens
  -> useCurrentUser() reads api.users.me.me
```

The old `ia_token` localStorage key is not the auth mechanism for new code.
`ia_user` remains as a temporary cached public user for synchronous UI reads.

## Files

| File | Purpose |
| --- | --- |
| `apps/web/src/lib/auth-client.ts` | Better Auth browser client |
| `apps/web/src/lib/convex.ts` | `ConvexReactClient` |
| `apps/web/src/app/api/auth/[...all]/route.ts` | Next auth route proxy |
| `apps/web/src/app/providers.tsx` | Convex and theme providers |
| `apps/web/src/lib/auth.ts` | `useCurrentUser`, role helpers, compatibility cache |

## Login

The login page signs in with the school unique ID as the Better Auth username:

```tsx
await authClient.signIn.username({
  username: uniqueId.trim().toUpperCase(),
  password,
});
```

Students and staff do not self-register. Admin workflows create accounts and
issue/reset passwords.

## Current User

Use `useCurrentUser()` for UI gating:

```tsx
const user = useCurrentUser();

if (hasRole(user, 'ADMIN', 'SUPER_ADMIN')) {
  // show admin-only UI
}
```

Backend functions still enforce permissions. Frontend checks are for navigation
and user experience, not security.

## Environment

Local defaults work outside CI, but deployments should set:

```env
NEXT_PUBLIC_CONVEX_URL=https://...
NEXT_PUBLIC_CONVEX_SITE_URL=https://...
NEXT_PUBLIC_SITE_URL=https://...
```

## Related

- [Auth and roles](../backend/auth-and-roles.md)
- [Data flow](../architecture/data-flow.md)
