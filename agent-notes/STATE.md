# Current Execution State

## Active Focus

- **Agent**: Codex
- **Focus**: Convex backend port implementation.
- **Status**: In progress on `codex/convex-port`.

## Current Truth

- The Convex port has moved from planning into implementation on the draft PR branch.
- Convex is configured as the `apps/convex` workspace app, with functions in `apps/convex/convex/`, a local Better Auth component, generated Convex AI guidance, generated Convex types, and an anonymous local Convex deployment for development.
- Better Auth is the selected auth provider. Public signup is disabled; `uniqueId` login is modeled through the username plugin; app roles stay in the app `users` table.
- Initial Convex users/auth slice exists in `apps/convex/convex/auth.ts`, `apps/convex/convex/http.ts`, and `apps/convex/convex/users.ts`: current-user lookup, password change, admin-created users, first-superadmin bootstrap, temporary-password reset, admin user listing, activation/deactivation, and role assignment.
- Next.js is wired to Better Auth + Convex via `apps/web/src/app/api/auth/[...all]/route.ts`, `apps/web/src/lib/auth-client.ts`, `apps/web/src/lib/convex.ts`, and `ConvexBetterAuthProvider`.
- Admin user management now reads/writes through Convex cursor pagination. Remaining app domains still use the transitional REST client until they are ported.
- Convex audit logging exists in `apps/convex/convex/lib/audit.ts` and the `auditEvents` table for sensitive user-management mutations.
- Profile password changes, dashboard layout persistence, admin audit reads, and club channel current-user reads no longer depend on the old REST auth endpoints.
- Notification inbox, unread counts, notification preferences, channel notification settings, and command-palette unread notification reads now use Convex `notifications` functions.
- Current Postgres data remains disposable. No legacy ID/backfill compatibility is being preserved for the Convex port.

## Next Verification

- Continue running Convex checks with `CONVEX_AGENT_MODE=anonymous direnv exec . pnpm --filter convex-backend codegen` and `direnv exec . pnpm --filter convex-backend typecheck`.
- Keep running `direnv exec . pnpm --filter web build` after frontend changes. It currently passes with pre-existing lint warnings.

## Handoff Notes

- Read `apps/convex/convex/_generated/ai/guidelines.md` before editing Convex code.
- Better Auth local schema is generated from `apps/convex/convex/betterAuth/auth.ts`; regenerate with `direnv exec . pnpm --filter convex-backend auth:generate` after plugin/config changes that affect schema.
- `BOOTSTRAP_SECRET` must be set in the Convex deployment before `users.bootstrapFirstSuperAdmin` can create the first admin.
