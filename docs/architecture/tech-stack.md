---
tags: [architecture, tech-stack]
---

# Tech Stack

← [[index|Home]] / [[overview]]

---

## Backend

| Technology          | Role                             | Why                                         |
| ------------------- | -------------------------------- | ------------------------------------------- |
| **Node.js**         | JavaScript runtime on the server | Lets JS run outside the browser             |
| **TypeScript**      | Typed superset of JavaScript     | Catches bugs at write-time, not runtime     |
| **Convex**          | Backend, database, functions, storage | Reactive TypeScript backend with generated API types |
| **Better Auth**     | Authentication and sessions      | Username/password auth integrated with Convex |
| **TypeScript**      | Backend language                 | Shared language across backend and web      |
| **NestJS 10**       | Legacy backend reference         | Retained temporarily during the Convex port |
| **Prisma 6**        | Legacy ORM reference             | Retained temporarily while old API code exists |
| **PostgreSQL 16**   | Legacy local database            | Not the default product data path after Convex cutover |

---

## Frontend (Web)

| Technology | Role | Why |
|-----------|------|-----|
| **Next.js 15** | React framework | File routing, SSR, PWA support |
| **React 19** | UI library | Component-based, reactive UI |
| **TypeScript** | Types | Same as backend — safety |
| **Convex React** | Data subscriptions and mutations | Generated typed hooks for backend reads/writes |
| **TanStack Query** | Legacy REST cache / local async helper | Remove as REST domains disappear |
| **Tailwind CSS v4** | Styling | Utility-first CSS classes with CSS-variable driven theming |
| **shadcn/ui (new-york)** | Component primitives | High-quality Radix-based building blocks customized in our orange theme |
| **date-fns** | Date formatting | Lightweight date utilities |
| **react-hot-toast + `useToast`** | Notifications | Current toast system used by the web app |
| **lucide-react** | Icons | Clean, consistent icon set |

---

## Infrastructure & Tooling

| Technology | Role |
|-----------|------|
| **pnpm** | Package manager (faster than npm/yarn) |
| **Turbo** | Monorepo task runner with caching |
| **Nix + direnv** | Optional macOS/Linux dev shell; provides a consistent Node/pnpm/dev toolchain |
| **Convex CLI** | Local/cloud backend development, codegen, and deploys |
| **Prisma Migrate** | Legacy database migration system while old API code remains |

---

## Language: TypeScript

The entire codebase — backend and web — is written in **TypeScript**. TypeScript is JavaScript with a type system layered on top.

```typescript
// JavaScript — no types, error only at runtime
function greet(user) {
  return user.firstName + " " + user.lastName;
}

// TypeScript — error caught immediately if shape is wrong
function greet(user: { firstName: string; lastName: string }): string {
  return `${user.firstName} ${user.lastName}`;
}
```

Benefits in this codebase:
- Convex generates API and document types from backend functions/schema.
- Product enums use validators and TypeScript unions so invalid values fail at the function boundary.
- Frontend components can derive prop types with `FunctionReturnType<typeof api.domain.function>`.

---

## Current UI Notes

- `apps/web/components.json` is configured for shadcn's `new-york` style
- Tailwind is running in v4 mode from `src/app/globals.css` using `@import "tailwindcss"` and inline theme variables
- current shadcn docs prefer **Sonner** for new toast work, but this project still uses the existing `react-hot-toast` + `useToast` flow until a full migration happens

---

## Related

- [[overview]] — How all these pieces fit together
- [[convex]] — Deep dive on the active Convex backend
- [[frontend-overview]] — Deep dive on Next.js
- [[database-overview]] — Legacy PostgreSQL + Prisma background
