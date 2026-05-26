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
| Auth, profile, admin users/audit, notifications, courses, schedule | **Convex** (API paths: `get`, `list`, `search`, `sendRequest`, etc.) |
| Wrapped page + admin wrapped tab | **Convex** |
| Clubs (directory, workspace, channels, dialogs, widgets) | **Convex** — `useClubId()` / `useRouteChannelId()`; types from `api.clubs.*`; `_id` not REST `id` |
| Clubs CSV bulk invite | **Convex** (`parse-invite-csv` + `api.clubs.invitations.bulkInvite`) |
| Events, calendar, flex-friday UI | **Convex** (`api.events.*`, `api.flexFriday.*`) |
| Announcements, moderation, uploads | **Convex** |
| Admin student CSV import/export | **Convex** (`api.users.admin.importStudents`, `api.users.admin.exportStudents`) |

### Dev data commands (`package.json`)

- `pnpm db:reset` → `node scripts/convex-db.mjs reset` (bootstrap + batched schedule seed)
- `pnpm db:seed` → `node scripts/convex-db.mjs seed`
- `pnpm db:generate` → `pnpm --filter convex-backend codegen`
- `pnpm db:studio` → `pnpm convex:dev`
- Requires `BOOTSTRAP_SECRET` on the Convex deployment
- Public entry: `bootstrap:resetAndSeed` → `internal.seed.run`

### Verification (latest)

- `pnpm --filter convex-backend codegen` + `typecheck` — pass
- `pnpm --filter web build` — pass
- Web `tsc --noEmit` — pass
- `pnpm lint` — blocked by legacy `apps/api` `no-explicit-any`/unused-var
  failures; Convex/web checks above pass.
- Docs cleanup pass completed: active docs now route through `docs/index.md`,
  cover Convex-era architecture/backend/database/frontend/features, and have a
  clean stale-reference grep for old backend terms outside historical
  `PORTING.md`.

## Next Work

1. Decide whether the legacy `apps/api` app and `packages/contracts` should be
   deleted now or retained temporarily for reference.
2. Keep docs synchronized as remaining legacy code is deleted; `PORTING.md` is
   historical, while `docs/` is now the active operating manual.
3. Fix or remove legacy `apps/api` lint failures before making `pnpm lint` a
   blocking check again.

## Handoff Commands

```bash
direnv exec . pnpm --filter convex-backend codegen
direnv exec . pnpm --filter convex-backend typecheck
direnv exec . pnpm lint
direnv exec . pnpm --filter web build
BOOTSTRAP_SECRET=dev-secret pnpm db:reset   # example; use your deployment secret
```

## Stash

`agent-wip-convex-port` — largely superseded by fixes on branch; safe to drop after review (`git stash drop`).
