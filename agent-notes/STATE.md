# Current Execution State

## Active Focus

- **Branch**: `codex/convex-port` (includes `6845f48` clubs/events/flex backend + ongoing frontend/db work)
- **Goal**: Finish Convex port — Wrapped done; migrate remaining web domains off REST; Convex-only `db:*`.

## Current Truth

### Backend on Convex

| Domain | Status |
|--------|--------|
| Users, audit, courses, schedule, notifications | **Done** |
| Clubs, events, Flex Friday | **Done for current web flows** |
| Wrapped | **Done** — `wrapped/snapshots.ts`, `wrappedSnapshots` table |
| Announcements | **Done for current web flows** (`feed`, `engagement`, `comments`) |
| Moderation, uploads | **Done for current web flows** |

### Frontend on Convex

| Area | Status |
|------|--------|
| Auth, profile, admin users/audit, notifications, courses, schedule | **Convex** (API paths: `get`, `list`, `search`, `sendRequest`, etc.); login lockout via `@convex-dev/rate-limiter` |
| Wrapped page + admin wrapped tab | **Convex** |
| Clubs (directory, workspace, channels, dialogs, widgets) | **Convex** — `useClubId()` / `useRouteChannelId()`; types from `api.clubs.*`; `_id` not REST `id` |
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

- `pnpm --filter cvx codegen` + `typecheck` — pass
- `pnpm --filter web build` — pass
- Web `tsc --noEmit` — pass
- `pnpm lint` — blocked by legacy `apps/api` `no-explicit-any`/unused-var
  failures; Convex/web checks above pass.
- Docs cleanup pass completed: active docs now route through `docs/index.md`,
  cover Convex-era architecture/backend/database/frontend/features, and have a
  clean stale-reference grep for old backend terms outside historical
  `PORTING.md`.

## Next Work

1. Deploy Convex changes so the `rateLimiter` component is live in the target
   deployment before production student/staff data.
2. Decide whether the legacy `apps/api` app and `packages/contracts` should be
   deleted now or retained temporarily for reference.
3. Keep docs synchronized as remaining legacy code is deleted; `PORTING.md` is
   historical, while `docs/` is now the active operating manual.
4. Fix or remove legacy `apps/api` lint failures before making `pnpm lint` a
   blocking check again.

## Handoff Commands

```bash
direnv exec . pnpm --filter cvx codegen
direnv exec . pnpm --filter cvx typecheck
direnv exec . pnpm lint
direnv exec . pnpm --filter web build
# Demo data reset: run internal Convex function bootstrap:resetAndSeed in the dashboard.
```

## Stash

`agent-wip-convex-port` — largely superseded by fixes on branch; safe to drop after review (`git stash drop`).
