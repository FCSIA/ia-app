---
tags: [frontend, api, convex]
---

# API Layer — Convex

← [[index|Home]] / [[frontend-overview]]

---

## Current Model

The web app now calls Convex functions directly through generated function
references from `apps/convex/src/_generated/api`.

Use Convex React hooks for app data:

```tsx
import { useQuery, useMutation, usePaginatedQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';

const courses = useQuery(api.courses.catalog.list, { limit: 40 }) ?? [];
const save = useMutation(api.schedule.dashboard.save);
```

Do not add new Axios wrappers, REST DTOs, or package-contract response types for
ported domains. Use generated Convex return types:

```ts
import type { FunctionReturnType } from 'convex/server';
import { api } from '~/apps/convex/src/_generated/api';

type Course = FunctionReturnType<typeof api.courses.catalog.list>[number];
```

---

## Function Layout

Convex function references mirror files under `apps/convex/src/`:

- `api.users.admin.*`
- `api.users.me.*`
- `api.courses.catalog.*`
- `api.schedule.dashboard.*`
- `api.notifications.inbox.*`
- `api.announcements.feed.*`
- `api.clubs.channels.*`
- `api.events.events.*`
- `api.flexFriday.*`
- `api.moderation.*`
- `api.uploads.files.*`
- `api.wrapped.snapshots.*`

Growable screens should use `usePaginatedQuery` with Convex functions that
accept `paginationOptsValidator`.

---

## Uploads

Browser uploads use Convex storage:

1. Call `api.uploads.files.generateUploadUrl`.
2. `POST` the file to the returned upload URL.
3. Call the relevant finalize mutation, such as
   `api.uploads.files.finalizeChatAttachment` or
   `api.uploads.files.finalizeClubImage`.

The helper lives at `apps/web/src/lib/convex-upload.ts`.

---

## Legacy REST Status

`apps/web/src/lib/api.ts` has been removed. The default app path should not add
new REST calls. If a future external client needs HTTP access, add a deliberate
Convex HTTP action with explicit auth and docs rather than reviving the old
Axios layer.

---

## Related

- [[state-management]] — client state patterns
- [[frontend-auth]] — Better Auth + Convex provider
- [[data-flow]] — request lifecycle
