---
tags: [frontend, auth, convex, better-auth]
---

# Frontend Authentication

← [[index|Home]] / [[frontend-overview]]

---

## Current Model

The Convex port uses **Better Auth on Convex** as the identity/session system.
The browser authenticates through the Next route at `/api/auth/*`, which proxies
to the Convex HTTP auth routes. Convex queries and mutations receive the Better
Auth token through `ConvexBetterAuthProvider`.

```
Login form
  → authClient.signIn.username(...)
  → Better Auth sets the session cookie
  → ConvexBetterAuthProvider fetches Convex auth tokens
  → useCurrentUser() reads api.users.me
```

The old `ia_token` JWT localStorage key is transitional only. It remains so
unported REST screens can still be identified and removed deliberately as their
domains move to Convex. New Convex code must not depend on it.

---

## Files

- `apps/web/src/lib/auth-client.ts` creates the Better Auth client with the
  username and Convex client plugins.
- `apps/web/src/lib/convex.ts` creates the `ConvexReactClient`.
- `apps/web/src/app/api/auth/[...all]/route.ts` exposes the Better Auth proxy
  route for Next.
- `apps/web/src/app/providers.tsx` wraps the app in `ConvexBetterAuthProvider`.
- `apps/web/src/lib/auth.ts` exposes role helpers and `useCurrentUser()`.

---

## Login Flow

`apps/web/src/app/login/page.tsx` signs in with the school `uniqueId` as the
Better Auth username:

```tsx
await authClient.signIn.username({
  username: uniqueId.trim().toUpperCase(),
  password,
});
```

Students and staff do not self-register. Admin/front-office workflows create
accounts and issue temporary passwords. The first successful password change
clears `mustResetPassword`.

---

## Logged-In User

Use `useCurrentUser()` for UI decisions:

```tsx
const user = useCurrentUser();

if (hasRole(user, 'ADMIN', 'SUPER_ADMIN')) {
  // show admin UI
}
```

`useCurrentUser()` reads `api.users.me` from Convex and caches the public user in
`ia_user` only as a temporary compatibility layer for old synchronous UI code.

---

## Required Environment

For local development:

```bash
NEXT_PUBLIC_CONVEX_URL=http://127.0.0.1:3210
NEXT_PUBLIC_CONVEX_SITE_URL=http://127.0.0.1:3211
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Alpha cloud deploys must set the Convex Cloud equivalents. Missing Convex envs
should fail CI/deploy builds; local builds fall back to the local Convex URLs.

---

## Related

- [[backend-auth]] — Better Auth and Convex server-side auth
- [[api-layer]] — Transitional REST client that still attaches `ia_token`
