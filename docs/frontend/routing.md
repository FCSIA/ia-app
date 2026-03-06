---
tags: [frontend, nextjs, routing]
---

# Routing — Next.js App Router

← [[index|Home]] / [[frontend-overview]]

---

## File-Based Routing

In Next.js, the file system is the router. Create a file, get a route — no configuration needed.

```
app/
├── page.tsx              →  /
├── login/
│   └── page.tsx          →  /login
├── dashboard/
│   └── page.tsx          →  /dashboard
├── clubs/
│   ├── page.tsx          →  /clubs
│   └── [id]/
│       └── page.tsx      →  /clubs/:id   (dynamic)
└── announcements/
    ├── page.tsx          →  /announcements
    └── [id]/
        └── page.tsx      →  /announcements/:id
```

Every route must be a file named exactly `page.tsx` inside a folder.

---

## Dynamic Segments

`[id]` in a folder name is a **dynamic segment** — it matches any value in that position:

```
/clubs/abc-123-def    →  [id] = "abc-123-def"
/clubs/xyz-789        →  [id] = "xyz-789"
```

Accessing the value in the component:

```tsx
// app/clubs/[id]/page.tsx
export default function ClubDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params); // React 19 — unwraps the Promise
  // use id to fetch data
}
```

`params` is a Promise in Next.js 15 (React 19). `use()` is a new React API that resolves it synchronously during rendering.

---

## layout.tsx

Any `layout.tsx` file wraps its sibling pages and all nested routes:

```
app/
├── layout.tsx        ← wraps EVERYTHING (root layout)
└── clubs/
    └── page.tsx      ← wrapped by root layout
```

The root layout wraps every page with providers, the dark background, and background blobs.

---

## Navigation Between Pages

### Link component (preferred)
```tsx
import Link from 'next/link';

<Link href="/clubs">
  Go to Clubs
</Link>
```

Next.js `Link` pre-fetches the destination page in the background, making navigation instant.

### useRouter (programmatic navigation)
```tsx
import { useRouter } from 'next/navigation';

const router = useRouter();

// After a form submission:
router.push('/dashboard');

// Replace current history entry (can't go back):
router.replace('/login');
```

Used in the AppShell after logout (`router.push('/login')`) and in the admin page to redirect non-admins.

---

## Route Protection

There's no middleware-level route protection in this app. Instead, each protected page checks on mount:

```tsx
// app/admin/page.tsx
useEffect(() => {
  if (user && !hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF')) {
    router.replace('/dashboard');
  }
}, [user, router]);
```

And the API enforces it server-side with guards — even if someone bypasses the redirect, the data requests will return `403 Forbidden`.

---

## All Routes

| Route | Component | Who can access |
|-------|-----------|----------------|
| `/` | page.tsx | All — redirects to /dashboard |
| `/login` | login/page.tsx | Public (unauthenticated) |
| `/dashboard` | dashboard/page.tsx | All authenticated |
| `/announcements` | announcements/page.tsx | All authenticated |
| `/announcements/:id` | announcements/[id]/page.tsx | All authenticated |
| `/clubs` | clubs/page.tsx | All authenticated |
| `/clubs/:id` | clubs/[id]/page.tsx | Club members + admins |
| `/events` | events/page.tsx | All authenticated |
| `/calendar` | calendar/page.tsx | All authenticated |
| `/flex-friday` | flex-friday/page.tsx | All authenticated |
| `/notifications` | notifications/page.tsx | All authenticated |
| `/profile` | profile/page.tsx | All authenticated |
| `/admin` | admin/page.tsx | ADMIN, SUPER_ADMIN, SUPPORT_STAFF |

---

## Related

- [[frontend-overview]] — Next.js overview
- [[components]] — What's inside each page
- [[frontend-auth]] — How auth state is checked on each route
