---
tags: [frontend, react, components, hooks]
---

# Components & Hooks

← [[index|Home]] / [[frontend-overview]]

---

## React Hooks

Hooks are functions that let you add features to functional components. They always start with `use`.

### useState — Local State

```tsx
const [comment, setComment] = useState('');
const [tab, setTab] = useState<'members' | 'announcements'>('announcements');
const [showModal, setShowModal] = useState(false);
```

`useState` returns `[currentValue, setterFunction]`. Calling the setter triggers a re-render with the new value.

The TypeScript type annotation `useState<'members' | 'announcements'>` means `tab` can only ever be one of those two exact strings.

### useEffect — Side Effects

```tsx
useEffect(() => {
  // Runs after render
  if (user && !hasRole(user, 'ADMIN')) {
    router.replace('/dashboard');
  }
}, [user, router]); // dependency array — re-runs when these change
```

`useEffect` runs after the component renders. The dependency array controls when it re-runs:
- `[]` — runs once on mount
- `[user, router]` — re-runs when `user` or `router` changes
- No array — runs after every render (rarely used)

### useQuery and useMutation

From TanStack Query — see [[state-management]].

### useRouter

From Next.js — see [[routing]].

---

## AppShell — The Layout Component

`src/components/layout/AppShell.tsx` is the most important component. It wraps every authenticated page and renders the navigation sidebar.

### Structure

```tsx
export function AppShell({ children }: { children: React.ReactNode }) {
  const user = getUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar — fixed on desktop, toggled on mobile */}
      <Sidebar user={user} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Mobile header with hamburger menu */}
      <MobileHeader onMenuClick={() => setSidebarOpen(true)} />

      {/* Page content */}
      <main className="flex-1 p-4 md:p-8 page-enter">
        {children}
      </main>
    </div>
  );
}
```

### Sidebar Contents

```tsx
function Sidebar({ user }: { user: any }) {
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unread-count'],
    queryFn: () => notificationsApi.getUnreadCount().then(r => r.data.count),
    refetchInterval: 30_000, // poll every 30 seconds
  });

  return (
    <aside style={{ /* glass styling */ }}>
      {/* Logo */}
      <div className="logo">IA</div>

      {/* Main navigation */}
      <nav>
        <NavLink href="/dashboard" icon={<Home />}>Dashboard</NavLink>
        <NavLink href="/announcements" icon={<Megaphone />}>Announcements</NavLink>
        <NavLink href="/clubs" icon={<Users />}>Clubs</NavLink>
        <NavLink href="/events" icon={<Calendar />}>Events</NavLink>
        <NavLink href="/calendar" icon={<CalendarDays />}>Calendar</NavLink>
        <NavLink href="/flex-friday" icon={<Zap />}>Flex Friday</NavLink>
      </nav>

      {/* Admin section — conditional */}
      {hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF') && (
        <NavLink href="/admin" icon={<Shield />}>Admin Panel</NavLink>
      )}

      {/* Bottom: notifications + profile + sign out */}
      <NavLink href="/notifications" icon={<Bell />}>
        Notifications
        {unreadCount > 0 && (
          <span className="badge animate-pulse">{unreadCount}</span>
        )}
      </NavLink>
    </aside>
  );
}
```

### NavLink

A wrapper around Next.js `Link` that applies active styling:

```tsx
function NavLink({ href, icon, children }: NavLinkProps) {
  const pathname = usePathname(); // current URL
  const isActive = pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      className={`nav-item ${isActive ? 'bg-white/[0.08] border-l-2 border-accent-500 text-white' : 'text-white/50'}`}
    >
      {icon}
      {children}
    </Link>
  );
}
```

`usePathname()` is a Next.js hook that returns the current URL path.

---

## Page Component Pattern

Every page follows this structure:

```tsx
'use client';

import { AppShell } from '@/components/layout/AppShell';
import { useQuery } from '@tanstack/react-query';
import { clubsApi } from '@/lib/api';

export default function ClubsPage() {
  // 1. Fetch data
  const { data: clubs = [], isLoading } = useQuery({
    queryKey: ['clubs'],
    queryFn: () => clubsApi.getAll().then(r => r.data),
  });

  // 2. Handle loading state
  if (isLoading) return <AppShell><div>Loading...</div></AppShell>;

  // 3. Render with AppShell
  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold text-white">Clubs</h1>
        {clubs.map(club => (
          <div key={club.id} className="card">
            {club.name}
          </div>
        ))}
      </div>
    </AppShell>
  );
}
```

The `@/` prefix is a path alias configured in `tsconfig.json` — it maps to `src/`, so `@/lib/api` = `src/lib/api.ts`.

---

## Conditional Rendering

```tsx
// Simple boolean
{isAdmin && <AdminPanel />}

// Ternary (if/else)
{isLoading ? <Spinner /> : <Content />}

// Nullish / empty state
{clubs.length === 0 ? (
  <div>No clubs yet</div>
) : (
  clubs.map(c => <ClubCard key={c.id} club={c} />)
)}
```

---

## Lists with .map()

React renders lists with the `.map()` array method. Every item needs a unique `key` prop so React can efficiently update individual items:

```tsx
{announcements.map((ann) => (
  <div key={ann.id} className="card">   {/* key = unique id */}
    <h3>{ann.title}</h3>
    <p>{ann.body}</p>
  </div>
))}
```

---

## Forms and Controlled Inputs

Inputs whose value is controlled by React state (rather than the DOM):

```tsx
const [title, setTitle] = useState('');

<input
  value={title}                             // controlled by state
  onChange={(e) => setTitle(e.target.value)} // update state on change
  className="input"
  placeholder="Title"
/>
```

---

## Modals

Modals are rendered conditionally and use a fixed-position overlay:

```tsx
{showReport && (
  <div className="fixed inset-0 z-50 flex items-center justify-center"
    style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(8px)' }}>
    <div className="card w-full max-w-md">
      {/* modal content */}
      <button onClick={() => setShowReport(false)}>Close</button>
    </div>
  </div>
)}
```

---

## Related

- [[frontend-overview]] — React and Next.js overview
- [[state-management]] — useQuery and useMutation
- [[styling]] — Tailwind classes used in components
- [[routing]] — usePathname, Link, useRouter
