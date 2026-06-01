# Current Execution State

## Active Focus

- **Branch**: `main`
- **Goal**: Post-Convex port feature development and stability.

## Current Truth

### Architecture: Next.js 16 + Convex

| Domain | Status |
|--------|--------|
| **Backend** | **Convex Only**. Legacy NestJS (`apps/api`) and Prisma deleted. |
| **Frontend** | **Next.js 16 (Node Runtime)**. Legacy `middleware.ts` replaced by `proxy.ts`. |
| **Auth** | **Better Auth**. Integrated with Convex. Managed at network layer via `proxy.ts`. |

### Feature Coverage on Convex

All core domains (Users, Clubs, Events, Announcements, Schedule, Wrapped, Notifications, Moderation, Audit) are now 100% on Convex.

### Dev data reset

- No local seed/reset/clear CLI commands.
- Run dashboard-only internal Convex function `bootstrap:resetAndSeed` to destructively recreate demo data.

### Verification (latest)

- `pnpm codegen` — pass
- `pnpm lint` — pass (Legacy `apps/api` errors removed by deletion)
- `pnpm build` — pass (`ƒ Proxy (Middleware)` active)

## Next Work

1. Update any remaining stale documentation references to the old backend.
2. Monitor Vercel deployments for any routing issues related to the Next.js 16 `proxy.ts` shift.
3. Enhance `proxy.ts` to handle more granular route-level permissions if needed.

## Handoff Commands

```bash
direnv exec . pnpm codegen
direnv exec . pnpm lint
direnv exec . pnpm build
# Migration Guide: agent-notes/MIGRATION_GUIDE.md
```
