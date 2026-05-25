# Current Execution State

## Active Focus

- **Agent**: Codex
- **Focus**: Convex backend port implementation.
- **Status**: In progress on `codex/convex-port`.

## Current Truth

- The Convex port has moved from planning into implementation on the draft PR branch.
- Convex is configured as the `apps/convex` workspace app, with functions in `apps/convex/src/` via `apps/convex/convex.json`, a local Better Auth component, generated Convex AI guidance, generated Convex types, and an anonymous local Convex deployment for development.
- Better Auth is the selected auth provider. Public signup is disabled; `uniqueId` login is modeled through the username plugin; app roles stay in the app `users` table.
- Convex public functions are organized into domain-specific folders (`audit/`, `courses/`, `notifications/`, `schedule/`, `users/`) for long-term maintainability.
- Initial Convex users/auth slice exists in `apps/convex/src/users/`: current-user lookup, password change, admin-created users, first-superadmin bootstrap, temporary-password reset, admin user listing, activation/deactivation, and role assignment.
- Next.js is wired to Better Auth + Convex via `apps/web/src/app/api/auth/[...all]/route.ts`, `apps/web/src/lib/auth-client.ts`, `apps/web/src/lib/convex.ts`, and `ConvexBetterAuthProvider`.
- Admin user management now reads/writes through Convex cursor pagination. Remaining app domains still use the transitional REST client until they are ported.
- Convex audit logging exists in `apps/convex/src/audit/lib.ts` and the `auditEvents` table for sensitive user-management mutations.
- Profile password changes, dashboard layout persistence, admin audit reads, and club channel current-user reads no longer depend on the old REST auth endpoints.
- Notification inbox, unread counts, notification preferences, channel notification settings, and command-palette unread notification reads now use Convex `notifications` functions.
- Course catalog reads now use Convex `courses` functions for `/courses`, `/courses/[slug]`, command-palette course search, and the schedule editor course picker.
- Schedule dashboard reads/writes now use Convex `schedule` functions for personal schedules, friend search/requests, and admin bell-schedule blocks.
- Growable Convex list screens use cursor pagination where currently ported: notification inbox (`notifications.inbox.listPage`), course catalog browsing (`courses.catalog.listPage`), admin users, and admin audit browsing (`audit.events.listPage`). Bounded preview/control reads still use `.take(n)`.
- Convex-owned course fixtures live in `apps/convex/seed-data/courses.ts`. Run `api.courses.seed.seedFromStaticData` with `COURSE_SEED_SECRET` or `BOOTSTRAP_SECRET` to populate the Convex course catalog.
- Convex-owned schedule fixtures live in `apps/convex/seed-data/schedule.ts`. Run `api.schedule.seed.seedFromStaticData` with `SCHEDULE_SEED_SECRET` or `BOOTSTRAP_SECRET`; it is cursor-based, so repeat with `nextCursor` until `isDone`.
- Current Postgres data remains disposable. No legacy ID/backfill compatibility is being preserved for the Convex port.

## Next Verification

- Continue running Convex checks with `CONVEX_AGENT_MODE=anonymous direnv exec . pnpm --filter convex-backend codegen` and `direnv exec . pnpm --filter convex-backend typecheck`.
- Keep running `direnv exec . pnpm --filter web build` after frontend changes. It currently passes with pre-existing lint warnings.

## Handoff Notes

- Read `apps/convex/src/_generated/ai/guidelines.md` before editing Convex code.
- Better Auth local schema is generated from `apps/convex/src/betterAuth/auth.ts`; regenerate with `direnv exec . pnpm --filter convex-backend auth:generate` after plugin/config changes that affect schema.
- `BOOTSTRAP_SECRET` must be set in the Convex deployment before `users.auth.bootstrapFirstSuperAdmin` can create the first admin.
