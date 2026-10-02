---
tags: [architecture, data-flow, convex]
---

# Data Flow

[Home](../index.md)

The active data path is Convex-native. Pages and components import generated
function references from `~/apps/convex/src/_generated/api` and call them through
`convex/react` hooks.

## Authentication Flow

```text
Login form
  -> authClient.signIn.username(...)
  -> Better Auth session cookie
  -> ConvexBetterAuthProvider
  -> Convex auth token
  -> getCurrentAppUser(ctx)
  -> app user row in users table
```

The compatibility `ia_user` cache in `apps/web/src/lib/auth.ts` is only for
synchronous UI reads during hydration. New data access should use Convex hooks
and current-user functions.

## Read Flow

```tsx
const events = useQuery(api.events.events.list, {});
```

Convex queries are reactive subscriptions. When documents read by the query
change, subscribed components update without manual polling or cache
invalidation.

Use `usePaginatedQuery` for large lists such as notification inboxes and admin
audit logs.

## Write Flow

```tsx
const createEvent = useMutation(api.events.events.create);
await createEvent({ title, startAt, clubId });
```

Mutations validate arguments, derive the current user on the server, check
permissions, write domain documents, and create side-effect rows such as audit
events, notifications, or calendar entries.

## Upload Flow

```text
generateUploadUrl mutation
  -> browser uploads File to Convex storage URL
  -> finalize mutation stores metadata or domain reference
```

See [Storage and uploads](../backend/storage-and-uploads.md) for the concrete
helpers.

## Seed/Reset Flow

Demo reset invokes the internal `bootstrap:resetAndSeed` function from the
Convex CLI or Dashboard. The app does not expose `bun run db:seed`,
`bun run db:reset`, `bun run db:clear`, or a bootstrap secret.

## Related

- [Frontend authentication](../frontend/frontend-auth.md)
- [Convex overview](../backend/convex-overview.md)
- [Seed and reset](../backend/seed-and-reset.md)
