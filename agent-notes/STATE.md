# Current Execution State

## Active Focus

- **Agent**: Codex
- **Focus**: Convex backend port implementation.
- **Status**: In progress on `codex/convex-port`.

## Current Truth

- The Convex port has moved from planning into implementation on the draft PR branch.
- Convex is configured in `convex/` with a local Better Auth component, generated Convex AI guidance, generated Convex types, and an anonymous local Convex deployment for development.
- Better Auth is the selected auth provider. Public signup is disabled; `uniqueId` login is modeled through the username plugin; app roles stay in the app `users` table.
- Initial Convex users/auth slice exists in `convex/auth.ts`, `convex/http.ts`, and `convex/users.ts`: current-user lookup, password change, admin-created users, first-superadmin bootstrap, and temporary-password reset.
- Current Postgres data remains disposable. No legacy ID/backfill compatibility is being preserved for the Convex port.

## Next Verification

- Continue running Convex checks with `CONVEX_AGENT_MODE=anonymous direnv exec . pnpm exec convex dev --once --typecheck enable --codegen enable`.
- As frontend migration begins, add the Next.js Better Auth/Convex provider and route-handler wiring, then run `pnpm lint` and `pnpm build`.

## Handoff Notes

- Read `convex/_generated/ai/guidelines.md` before editing Convex code.
- Better Auth local schema is generated from `convex/betterAuth/auth.ts`; regenerate with `direnv exec . pnpm exec auth generate -y` from `convex/betterAuth` after plugin/config changes that affect schema.
- `BOOTSTRAP_SECRET` must be set in the Convex deployment before `users.bootstrapFirstSuperAdmin` can create the first admin.
