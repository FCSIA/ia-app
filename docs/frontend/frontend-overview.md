---
tags: [frontend, nextjs, react]
---

# Frontend Overview

[Home](../index.md)

The frontend is the Next.js app in `apps/web`. It runs on port 3000 in local
development and talks to Convex through generated function references.

## Stack

- Next.js 16 App Router
- React 19
- Tailwind CSS v4
- shadcn/ui, shadcn/typeset, and local Fluid-style primitives
- `@shadcn/react` behavior primitives for chat scrolling
- Plate for rich chat authoring and structured mentions
- `react-markdown` with `remark-gfm` for read-only message rendering
- Convex React hooks, through the `@/lib/convex-react` wrapper
- Better Auth through `ConvexBetterAuthProvider`

## Directory Map

```text
apps/web/src/
  app/                  Next.js routes, layouts, error/loading pages
  components/           shared UI, layout, feature components
  hooks/                local web hooks
  lib/                  auth, Convex client, upload, search, parsing helpers
```

Generated Convex imports use the repo-root alias:

```tsx
import { api } from '~/apps/convex/src/_generated/api';
```

## Providers

`apps/web/src/app/providers.tsx` wraps the app with:

- `ConvexBetterAuthProvider`
- `ConvexQueryCacheProvider`
- `ThemeProvider`
- `react-hot-toast` toaster

`apps/web/src/app/layout.tsx` sets metadata, the Work Sans font, app manifest,
viewport values, and the shadcn toast renderer.

## React Basics Worth Knowing

A component is a function that returns UI:

```tsx
function WelcomeCard({ firstName }: { firstName: string }) {
  return <h2>Hello, {firstName}</h2>;
}
```

Props are values passed from parent to child:

```tsx
<WelcomeCard firstName={user.firstName} />
```

`children` is the content placed between a component's tags:

```tsx
<AppShell>
  <DashboardPage />
</AppShell>
```

## Composition Rule

Prefer composition over long prop chains. If a parent only passes data through
several layers, move the shared UI boundary or pass `children`/slots instead.
This keeps pages easier for future students to reason about.

## Convex Data

Import `useQuery` from `@/lib/convex-react`, not from `convex/react`. The
wrapper re-exports everything `convex/react` exports and replaces `useQuery`
with one that keeps its subscription open for a few minutes after the component
unmounts.

Convex drops a query's cached value as soon as its last subscriber goes away, so
a plain `useQuery` re-fetches from scratch on every route mount — which is why
each tab used to open on a skeleton even when nothing had changed. Holding the
subscription means a returning route reads the value out of the client store on
its first frame while the socket keeps it fresh.

`ConvexWarmup`, mounted once inside the authenticated boundary, does the same
thing up front for the small, argument-stable queries the main tabs need, so a
tab is warm even on its first visit. That list lives in
`apps/web/src/components/layout/convex-warmup.tsx`. Keep it short: anything
expensive, paginated, or keyed by a value the user picks belongs to the route
that needs it, where the keep-alive cache already covers repeat visits. When a
warmed query takes arguments the page also computes, derive both from one
helper — different arguments are different subscriptions, and the tab would open
cold again.

## Client Components

Next.js server components are the default. Use `'use client'` when a file needs:

- React state or effects,
- Convex React hooks,
- browser APIs,
- event handlers.

Most interactive pages in this app are client components because they subscribe
to Convex and respond to user actions.

## Related

- [Components and hooks](components.md)
- [Frontend authentication](frontend-auth.md)
- [Routing](routing.md)
- [Styling](styling.md)
