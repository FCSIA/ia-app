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
| **NestJS 10**       | Backend framework                | Structure, dependency injection, decorators |
| **Prisma 6**        | Database ORM                     | Type-safe database queries in TypeScript    |
| **PostgreSQL 16**   | Relational database              | Robust, open source, excellent with Prisma  |
| **Passport.js**     | Authentication middleware        | JWT strategy integration                    |
| **bcrypt**          | Password hashing                 | Secure one-way password storage             |
| **class-validator** | DTO validation                   | Decorator-based request validation          |
| **Swagger**         | API documentation                | Auto-generated docs at `/docs`              |

---

## Frontend (Web)

| Technology | Role | Why |
|-----------|------|-----|
| **Next.js 15** | React framework | File routing, SSR, PWA support |
| **React 19** | UI library | Component-based, reactive UI |
| **TypeScript** | Types | Same as backend — safety |
| **TanStack Query** | Data fetching/caching | Handles loading states, caching, refetching |
| **Axios** | HTTP client | Makes API calls with interceptors |
| **Tailwind CSS v4** | Styling | Utility-first CSS classes with CSS-variable driven theming |
| **shadcn/ui (new-york)** | Component primitives | High-quality Radix-based building blocks customized in our orange theme |
| **date-fns** | Date formatting | Lightweight date utilities |
| **react-hot-toast + `useToast`** | Notifications | Current toast system used by the web app |
| **lucide-react** | Icons | Clean, consistent icon set |

---

## Mobile

| Technology | Role | Why |
|-----------|------|-----|
| **Expo SDK 54** | React Native toolkit | Simplifies native builds |
| **React Native** | Native UI framework | Write JS, get native iOS/Android views |
| **Expo Router v6** | File-based routing | Same pattern as Next.js |
| **expo-secure-store** | Encrypted storage | Secure token storage on device |

---

## Infrastructure & Tooling

| Technology | Role |
|-----------|------|
| **pnpm** | Package manager (faster than npm/yarn) |
| **Turbo** | Monorepo task runner with caching |
| **PostgreSQL via Homebrew** | Local database (no Docker needed) |
| **Prisma Migrate** | Database migration system |

---

## Language: TypeScript

The entire codebase — backend, web, and mobile — is written in **TypeScript**. TypeScript is JavaScript with a type system layered on top.

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
- The same `Role` enum is used everywhere — impossible to misspell
- Prisma generates TypeScript types from the schema — database models are always accurate
- API responses have known shapes — no guessing what fields exist

---

## Current UI Notes

- `apps/web/components.json` is configured for shadcn's `new-york` style
- Tailwind is running in v4 mode from `src/app/globals.css` using `@import "tailwindcss"` and inline theme variables
- current shadcn docs prefer **Sonner** for new toast work, but this project still uses the existing `react-hot-toast` + `useToast` flow until a full migration happens

---

## Related

- [[overview]] — How all these pieces fit together
- [[backend-overview]] — Deep dive on NestJS
- [[frontend-overview]] — Deep dive on Next.js
- [[database-overview]] — Deep dive on PostgreSQL + Prisma
