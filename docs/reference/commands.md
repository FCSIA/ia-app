---
tags: [commands, development]
---

# Commands

[Home](../index.md)

## App

| Command                 | What it does                                              |
| ----------------------- | --------------------------------------------------------- |
| `pnpm dev`              | Start the web app and Convex dev server through Turborepo |
| `pnpm convex:dev`       | Start only the Convex dev server                          |
| `pnpm --filter web dev` | Start only the Next.js web app                            |
| `pnpm lint`             | Lint all workspaces                                       |
| `pnpm build`            | Build all workspaces                                      |
| `pnpm test`             | Run test suites                                           |

## Convex

| Command                       | What it does                       |
| ----------------------------- | ---------------------------------- |
| `pnpm db:generate`            | Regenerate Convex generated files  |
| `pnpm db:studio`              | Start Convex dev/dashboard tooling |
| `pnpm --filter cvx typecheck` | Typecheck Convex functions         |
| `pnpm --filter cvx deploy`    | Deploy Convex backend changes      |

## Demo Data

There are no local `pnpm db:seed`, `pnpm db:reset`, or `pnpm db:clear`
commands. To destructively recreate demo data, open the Convex Dashboard and run
the internal function:

```text
bootstrap:resetAndSeed
```

Seed/reset does not use `BOOTSTRAP_SECRET`.
The function schedules small internal batches. Run the internal query
`bootstrap:seedStatus` to watch progress.

## Package Management

| Command                           | What it does                            |
| --------------------------------- | --------------------------------------- |
| `pnpm install`                    | Install dependencies for all workspaces |
| `pnpm --filter web add <package>` | Add a package to the web app            |
| `pnpm --filter cvx add <package>` | Add a package to the Convex backend     |
