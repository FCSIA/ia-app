# Current Execution State

## Active Focus

- **Branch**: `codex/convex-port` (includes `6845f48` clubs/events/flex backend + ongoing frontend/db work)
- **Goal**: Finish Convex port -- Wrapped done; migrate remaining web domains off REST; Convex-only `db:*`.

## Current Truth

### Backend on Convex

| Domain | Status |
|--------|--------|
| Users, audit, courses, schedule, notifications | **Done** |
| Clubs, events, Flex Friday | **Done for current web flows** |
| Wrapped | **Done** -- `wrapped/snapshots.ts`, `wrappedSnapshots` table |
| Announcements | **Done for current web flows** (`feed`, `engagement`, `comments`) |
| Moderation, uploads | **Done for current web flows** |

### Frontend on Convex

| Area | Status |
|------|--------|
| Auth, profile, admin users/audit, notifications, courses, schedule | **Convex** (API paths: `get`, `list`, `search`, `sendRequest`, etc.); login lockout via `@convex-dev/rate-limiter` |
| Wrapped page + admin wrapped tab | **Convex** |
| Clubs (directory, workspace, channels, dialogs, widgets) | **Convex** -- `useClubId()` / `useRouteChannelId()`; types from `api.clubs.*`; `_id` not REST `id` |
| Clubs CSV bulk invite | **Convex** (`parse-invite-csv` + `api.clubs.invitations.bulkInvite`) |
| Events, calendar, flex-friday UI | **Convex** (`api.events.*`, `api.flexFriday.*`) |
| Announcements, moderation, uploads | **Convex** |
| Admin student CSV import/export | **Convex** (`api.users.admin.importStudents`, `api.users.admin.exportStudents`) |

### Dev data reset

- No local seed/reset/clear CLI commands.
- Run dashboard-only internal Convex function `bootstrap:resetAndSeed` to
  destructively recreate demo data.
- No `BOOTSTRAP_SECRET`; seed/reset functions are internal rather than public
  secret-gated functions.

### Verification (latest)

- Audit hardening pass completed for Convex hot paths, club/event/moderation
  auth, upload validation, Flex Friday capacity validation, frontend attachment
  rendering, and pnpm/Turbo task configuration.
- `corepack pnpm@10.29.3 test` -- pass (`cvx` Vitest, 14 tests).
- `corepack pnpm@10.29.3 lint` -- pass.
- `corepack pnpm@10.29.3 build` -- pass.
- Convex `tsc -p apps/convex/src/tsconfig.json` -- pass.
- `git diff --check` -- pass.
- Convex codegen is blocked in this local environment: `convex codegen` needs
  `CONVEX_DEPLOYMENT`, while the repo script `convex dev --once --typecheck
  disable --codegen enable` fails while starting the local Convex backend binary
  with `TypeError: Cannot read properties of undefined (reading 'toString')`.

## Next Work

1. Deploy Convex changes so the `rateLimiter` component is live in the target
   deployment before production student/staff data.
2. Run Convex codegen from an environment with `CONVEX_DEPLOYMENT` configured,
   or after the local Convex backend binary issue is resolved.
3. Tracked legacy `apps/api` and `packages/contracts` source is already absent;
   only ignored local build/dependency artifacts remain in those directories.
4. Keep docs synchronized as remaining legacy artifacts are cleaned up;
   `PORTING.md` is historical, while `docs/` is the active operating manual.

## Handoff Commands

```bash
corepack pnpm@10.29.3 test
corepack pnpm@10.29.3 lint
corepack pnpm@10.29.3 build
cd apps/convex && ../../node_modules/.bin/tsc -p src/tsconfig.json
# Codegen, when Convex deployment/local backend is available:
corepack pnpm@10.29.3 --filter cvx codegen
# Demo data reset: run internal Convex function bootstrap:resetAndSeed in the dashboard.
```

## Stash

`agent-wip-convex-port` -- largely superseded by fixes on branch; safe to drop after review (`git stash drop`).
