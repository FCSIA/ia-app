---
tags: [frontend, nextjs, react]
---

# Frontend Overview — Next.js

← [[index|Home]]

---

## What Is the Frontend?

The frontend is the program that runs in the browser. It:
- Shows the user interface (buttons, text, forms, lists)
- Responds to user actions (clicks, typing, form submissions)
- Fetches data from the backend API
- Has no direct access to the database

It runs on **port 3000**: `http://localhost:3000`

---

## React

**React** is a JavaScript library for building user interfaces. The key idea: instead of manually updating the HTML when data changes, you describe *what the UI should look like* based on the current state, and React figures out the minimal changes needed to update the browser.

### Components

Everything in React is a **component** — a function that returns what should be displayed:

```tsx
function WelcomeCard({ firstName }: { firstName: string }) {
  return (
    <div className="card">
      <h2>Hello, {firstName}!</h2>
      <p>Welcome back.</p>
    </div>
  );
}
```

JSX is the HTML-like syntax inside the function. The curly braces `{}` let you embed JavaScript expressions. Components are composable — you use them like HTML tags:

```tsx
<WelcomeCard firstName="John" />
```

### Props

Data passed into a component from its parent. In the example above, `firstName` is a prop.

```tsx
// Parent passes props:
<WelcomeCard firstName={user.firstName} isAdmin={true} />

// Child receives them:
function WelcomeCard({ firstName, isAdmin }: { firstName: string; isAdmin: boolean }) {
  // ...
}
```

### children

A special prop that represents whatever you put between opening/closing tags:

```tsx
<AppShell>
  <div>This is the page content</div>  ← this is children
</AppShell>
```

```tsx
function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <Sidebar />
      <main>{children}</main>  ← renders whatever was passed in
    </div>
  );
}
```

---

## Next.js

**Next.js** is a framework on top of React that adds:

- **File-based routing** — `app/clubs/page.tsx` = the `/clubs` page
- **Server-side rendering** — pages can render on the server before the browser receives them
- **App Router** — the modern routing system used in this project
- **PWA support** — the web app can be installed like a native app

### PWA (Progressive Web App)

The web app has a `public/manifest.json` and service worker (`sw.js`) that allows users to install it on their home screen and use some features offline. The icons are in `public/icons/`.

---

## Folder Structure

```
apps/web/src/
├── app/                    ← Next.js App Router pages
│   ├── layout.tsx          ← root layout (wraps every page)
│   ├── page.tsx            ← / (redirects to /dashboard)
│   ├── login/page.tsx      ← /login
│   ├── dashboard/page.tsx  ← /dashboard
│   ├── announcements/
│   │   ├── page.tsx        ← /announcements (list)
│   │   └── [id]/page.tsx   ← /announcements/:id (detail)
│   ├── clubs/
│   │   ├── page.tsx
│   │   └── [id]/page.tsx
│   ├── events/page.tsx
│   ├── calendar/page.tsx
│   ├── flex-friday/page.tsx
│   ├── notifications/page.tsx
│   ├── admin/page.tsx
│   ├── profile/page.tsx
│   ├── globals.css         ← global styles + utility classes
│   └── providers.tsx       ← Convex, Better Auth, and app providers
│
├── components/
│   └── layout/
│       └── AppShell.tsx    ← sidebar + layout wrapper
│
└── lib/
    ├── auth-client.ts      ← Better Auth client
    ├── convex.ts           ← Convex React client
    └── auth.ts             ← current-user and role helpers
```

---

## 'use client' vs Server Components

Next.js 15 has two types of components:

| Type | Default | Can use hooks? | Can use browser APIs? |
|------|---------|----------------|----------------------|
| Server Component | ✅ | ❌ | ❌ |
| Client Component (`'use client'`) | ❌ | ✅ | ✅ |

All pages in this app start with `'use client'` because they:
- Use `useState` to track local state (open/closed, selected tab, etc.)
- Use `useQuery` to fetch data dynamically
- Respond to user events (clicks, form submissions)

The `BackgroundBlobs` component in `layout.tsx` is a Server Component because it's purely visual with no interactivity.

---

## The Root Layout

`app/layout.tsx` wraps every single page. It:
- Sets the HTML `lang` and dark background
- Renders the `BackgroundBlobs` (decorative blur orbs)
- Wraps everything in `providers.tsx` (which sets up TanStack Query)
- Applies global styles

```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-[#0c0a09]">
      <body>
        <BackgroundBlobs />
        <div className="relative z-10">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
```

---

## Related

- [[routing]] — File-based routing and dynamic segments
- [[components]] — React components, hooks, and AppShell
- [[api-layer]] — How the frontend calls the backend
- [[state-management]] — TanStack Query
- [[styling]] — Tailwind CSS and the glassmorphic design
- [[frontend-auth]] — Token storage and auth helpers
