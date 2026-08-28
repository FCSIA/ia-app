---
tags: [frontend, nextjs, routing]
---

# Routing

[Home](../index.md) / [Frontend overview](frontend-overview.md)

The app uses Next.js App Router. Routes are defined by folders and `page.tsx`
files under `apps/web/src/app`.

## File-Based Routing

```text
app/page.tsx                         -> /
app/login/page.tsx                   -> /login
app/clubs/page.tsx                   -> /clubs
app/clubs/[clubId]/page.tsx          -> /clubs/:clubId
app/events/[id]/page.tsx             -> /events/:id
```

Dynamic route folders use square brackets. In Next.js 15, route params can be a
Promise in page components, so use the local pattern already present in nearby
pages.

## Navigation

Use `Link` for normal navigation:

```tsx
<Link href="/clubs">Clubs</Link>
```

Use `useRouter` for imperative navigation after actions:

```tsx
const router = useRouter();
router.replace('/login');
```

`AppShell` owns the primary authenticated navigation and global command palette.

## Route Protection

Protected pages use current-user checks for UI redirects and Convex functions
for real authorization. Never rely on a frontend redirect as the only security
boundary.

Typical pattern:

```tsx
const user = useCurrentUser();

if (user && !hasRole(user, 'ADMIN', 'SUPER_ADMIN')) {
  router.replace('/dashboard');
}
```

The backend must still reject unauthorized queries or mutations.

## Current Routes

| Route | Purpose |
| --- | --- |
| `/` | Redirect entry |
| `/login` | Username/password login |
| `/dashboard` | Personalized dashboard |
| `/announcements` | Announcement feed |
| `/announcements/:id` | Announcement detail and comments |
| `/clubs` | Club directory and invites |
| `/clubs/:clubId` | Club overview and normal desktop/browser entry point |
| `/clubs/:clubId/navigation` | Club entry navigation for installed mobile PWAs |
| `/clubs/:clubId/channels/:channelId` | Club channel messages |
| `/clubs/:clubId/people` | Club members, invites, join codes |
| `/courses` | Course catalog |
| `/courses/:slug` | Course detail |
| `/events` | Event list and approvals |
| `/events/:id` | Event detail |
| `/calendar` | Calendar grid and personal entries |
| `/flex-friday` | Flex Friday sessions and registration |
| `/flex-friday/pass` | Student Flex Friday pass |
| `/notifications` | Inbox and notification preferences |
| `/profile` | Profile and password settings |
| `/admin` | Admin panel |
| `/schedule` | Student schedule and admin blocks |
| `/wrapped` | Yearly student summary |

## Related

- [Components and hooks](components.md)
- [Frontend authentication](frontend-auth.md)
