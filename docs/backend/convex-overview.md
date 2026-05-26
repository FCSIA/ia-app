---
tags: [backend, convex]
---

# Convex Backend Overview

[Home](../index.md)

The active backend lives in `apps/convex/src`. It replaces the old controller
and service layer with Convex queries, mutations, HTTP routes, and component
configuration.

## Before Editing

Read `apps/convex/src/_generated/ai/guidelines.md` before changing Convex code.
Those generated rules override older assumptions about Convex APIs.

## File Layout

| Path | Purpose |
| --- | --- |
| `schema.ts` | All app tables, validators, indexes, and search indexes |
| `validators.ts` | Shared validators and inferred TS types |
| `auth.ts`, `auth.config.ts`, `betterAuth/` | Better Auth component integration |
| `http.ts` | Convex HTTP routes, currently auth routes |
| `<domain>/*.ts` | Public queries/mutations for a product domain |
| `<domain>/_lib.ts` | Domain helpers that are not public API |
| `_generated/` | Generated function references and data model types |

## Public Surface

The web app imports generated function references:

```tsx
import { useQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';

const clubs = useQuery(api.clubs.management.getAll);
```

Public functions are registered with `query`, `mutation`, or `action`.
Sensitive helpers should stay private in normal TypeScript helpers or be
registered as `internalQuery`, `internalMutation`, or `internalAction` when
another Convex function needs to call them.

## Coding Rules

- Every Convex function needs argument validators.
- Use `Id<"table">` and `Doc<"table">` from generated data model types.
- Derive current user with `getCurrentAppUser(ctx)`; never trust a client-passed
  `userId` for authorization.
- Use Convex IDs in domain data and web routes.
- Use indexes for hot reads. Avoid `.filter()` on large tables.
- Keep side effects in mutations or actions, not queries.
- Log meaningful admin/domain writes to `auditEvents`.

## Current Domains

- `users`: current user, auth, admin user management, CSV import/export.
- `announcements`: feed reads, comments, read/bookmark/archive actions.
- `clubs`: directory, details, membership, invites, join codes, channels, tags.
- `events`: events, approvals, calendar entries.
- `flexFriday`: Fridays, sessions, workshops, registration, attendance, credits.
- `schedule`: student schedule, friends, school-day blocks, seed data.
- `notifications`: inbox and preferences.
- `moderation`: keyword rules and user reports.
- `uploads`: Convex file upload URL and finalization helpers.
- `wrapped`: yearly student summary snapshots.

## Related

- [Auth and roles](auth-and-roles.md)
- [Schema map](../database/schema-map.md)
- [Data flow](../architecture/data-flow.md)
