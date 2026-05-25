# Current Execution State

## Active Focus

- **Branch**: `codex/convex-port` (includes `6845f48` clubs/events/flex backend + ongoing frontend/db work)
- **Goal**: Finish Convex port — Wrapped done; migrate remaining web domains off REST; Convex-only `db:*`.

## Current Truth

### Backend on Convex

| Domain | Status |
|--------|--------|
| Users, audit, courses, schedule, notifications | **Done** |
| Clubs, events, Flex Friday | **Schema + partial APIs** (`6845f48`) |
| Wrapped | **Done** — `wrapped/snapshots.ts`, `wrappedSnapshots` table |
| Announcements | Partial (`feed`, `comments`) |
| Moderation, uploads | Not started |

### Frontend on Convex

| Area | Status |
|------|--------|
| Auth, profile, admin users/audit, notifications, courses, schedule | **Convex** (API paths: `get`, `list`, `search`, `sendRequest`, etc.) |
| Wrapped page + admin wrapped tab | **Convex** |
| Clubs (directory, workspace, channels, dialogs, widgets) | **Convex** — `useClubId()` / `useRouteChannelId()`; types from `api.clubs.*`; `_id` not REST `id` |
| Clubs CSV bulk invite | **REST** (`clubsApi.bulkInviteCsv`) until Convex action exists |
| Events, calendar, flex-friday, announcements UI | **Still REST** (`@/lib/api`) |

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

## Next Work

1. Add Convex **bulk CSV invite**; port **message report/history** if still needed.
2. Wire **events/calendar/flex** UI; add missing Convex queries (`getPendingApprovals`, etc.).
3. Wire **announcements** UI; complete bookmark/archive/mark-read mutations.
4. Port **moderation** + **uploads** (Convex storage).
5. Docs sweep (`docs/index.md`, architecture, seed docs).
6. Remove Nest/Prisma from default dev path when no REST callers remain.

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
