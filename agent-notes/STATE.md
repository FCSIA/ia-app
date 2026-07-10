# Current Execution State

## Active Focus

- **Branch**: `main`
- **Goal**: Convex-first IA app; broad backend/data/routing hardening pass completed.
- **Coordination note**: A parallel FERPA/compliance session owns `docs/compliance/`
  and the FERPA link in `docs/index.md`. Avoid editing those unless explicitly
  asked.

## Current Truth

### Backend on Convex

| Domain | Status |
|--------|--------|
| Users, audit, courses, schedule, notifications | **Done** |
| Clubs, events, calendar, Flex Friday | **Done for current web flows** |
| Wrapped | **Done** |
| Announcements | **Done for current web flows** |
| Moderation, uploads | **Done for current web flows** |

### Hardening Completed

- Club access now distinguishes ordinary members from `LEADER`/`SPONSOR`
  management roles and uses indexed membership/sponsor lookups.
- Club creation uses the staff/admin allowlist; club deactivation requires admin
  roles; workspace detail data is hidden from authenticated users who cannot
  access the club workspace.
- Channel reads/writes/reactions/polls now validate channel access, parent
  message channel ownership, and poll option membership.
- General events require an event-manager role; club events require admin,
  sponsor, or club leader authority.
- Calendar creation no longer lets regular users create non-personal calendar
  sources.
- Announcement comments require announcement read access; announcement approval
  is limited to global approvers or the relevant club sponsor.
- Flex Friday attendance and assignment paths validate active student targets,
  workshop/session conflicts, existing registration/assignment state, and
  capacity.
- Upload finalizers verify storage metadata instead of trusting caller-provided
  size or MIME type.
- Convex schema now has relationship indexes for the hot club/event/channel/
  notification/Flex paths; codegen has been run.

### Frontend and Routing

- `/courses` is included in protected route middleware.
- Club channel message queries include both `clubId` and `channelId`.
- Event creation UI only offers eligible clubs to non-general creators and
  blocks club-scoped submissions without an eligible club.
- Event author cancellation checks both current user id shapes used by the app.
- Profile settings now use a responsive two-column composition with identity
  and vertical section navigation in the left rail. Account, notifications,
  appearance, and role-aware moderation render one at a time on the right.
- User and club image editors share `EditableAvatar`; editable avatars reveal
  their controls on hover or keyboard focus.
- The shared switch is a dumb controlled Fluid/Radix primitive with visible
  off/disabled states, an 80ms spring, accessible labels, and no padded empty
  footprint. Optimistic Convex state stays in feature containers.
- Profile appearance choices use the Fluid radio group as a linear list with
  keyboard and roving-tabindex fixes; Fluid buttons drive the left rail.
- Fluid controls now share substrate-relative interaction colors: `bg-hover`
  mixes the current foreground at 6%, while `bg-active` uses 10%. Selected and
  hover layers no longer depend on undefined `bg-selected` or dark-only accent
  fallbacks, so Light, Dark, Contrast, Bubblegum, and Custom stay consistent.

### Remaining Debt

- Channel delete is still a direct row delete and does not cascade related
  messages/reactions/memberships.
- Announcement feed still has pagination/read-amplification room for improvement.
- `bodyRich` and poll option payloads are still `v.any()` shaped data.
- Web still has a localStorage-backed user cache that may need a privacy pass.
- Legacy `apps/api` and `packages/contracts` references should be deleted or
  formally retained once the team decides their fate.

### Verification (latest)

- `pnpm --filter cvx codegen` - pass
- `pnpm --filter cvx typecheck` - pass
- `pnpm --filter cvx test` - pass (3 files, 14 tests)
- `pnpm lint` - pass
- `pnpm build` - pass
- `pnpm test` - pass (`cvx` Vitest, 3 files, 14 tests)
- `git diff --check` - pass; Git only reported CRLF normalization warnings

Convex also reported that optional Convex AI guidance files are behind upstream.

For the latest profile/avatar UI slice, focused web TypeScript and ESLint checks
plus `git diff --check` pass. A build and browser smoke test were intentionally
not rerun per the user's instruction.

For the shared Fluid interaction-surface refactor, focused web TypeScript and
ESLint checks plus `git diff --check` pass. A build and browser smoke test were
again intentionally not run.

## Next Work

1. Deploy the Convex schema/index/function changes to the target deployment
   before production student/staff use.
2. Coordinate with the FERPA session before touching `docs/compliance/` or the
   FERPA entry in `docs/index.md`.
3. Decide whether the legacy `apps/api` app and `packages/contracts` should be
   deleted now or retained temporarily for reference.
4. Address the remaining lower-priority hardening debt listed above.

## Handoff Commands

```bash
pnpm --filter cvx codegen
pnpm --filter cvx typecheck
pnpm lint
pnpm build
pnpm test
```
