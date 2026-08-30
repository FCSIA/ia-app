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

Protected route content stays unmounted while Convex authentication is loading
or absent. Sign-out first navigates to the query-free `/logout` route, then
revokes the session and clears browser caches. This ordering prevents live
authenticated queries from rerunning without credentials during logout.

The old `ia_token` localStorage key is not the auth mechanism for new code.
`ia_user` remains as a temporary cached public user for synchronous UI reads.

Browser auth requests use the origin currently serving the web app. This keeps
LAN addresses and development tunnels on the same cookie origin as the page.
The Next.js auth proxy rejects cross-origin browser POSTs before forwarding
them to Convex.

## Files

| File | Purpose |
| --- | --- |
| `apps/web/src/lib/auth-client.ts` | Better Auth browser client |
| `apps/web/src/lib/convex.ts` | `ConvexReactClient` |
| `apps/web/src/app/api/auth/[...all]/route.ts` | Next auth route proxy |
| `apps/web/src/app/providers.tsx` | Convex and theme providers |
| `apps/web/src/app/logout/page.tsx` | Query-free sign-out transition |
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

`bun run setup:convex-local` enables forwarded LAN and tunnel hosts only for the
loopback local deployment. Cloud development or preview deployments remain
allowlisted; add their exact comma-separated web origins to the deployment's
`BETTER_AUTH_TRUSTED_ORIGINS` value.

## Related

- [Auth and roles](../backend/auth-and-roles.md)
- [Data flow](../architecture/data-flow.md)
