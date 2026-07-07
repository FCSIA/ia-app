# Current Execution State

## Active Focus

- **Branch**: `mobile`
- **Goal**: Native Expo mobile app foundation added on top of the Convex-first IA app.
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
| Native mobile push tokens | **Added for Expo clients** |

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
- `apps/mobile` now contains an Expo SDK 57 app with Expo Router, Better Auth
  Expo/SecureStore auth, Convex live data, shared design tokens, mobile tabs,
  announcements, clubs/chat, schedule, events, Flex Friday, notifications,
  profile, theme, and design-system gallery screens.
- `packages/design-tokens` centralizes theme, badge, radius, spacing, and type
  tokens for web/mobile consumption. Web imports the Tailwind token bridge.

### Remaining Debt

- Mobile v1 is a functional foundation, not store-ready: EAS project id,
  app icons/splash assets, physical-device push testing, Maestro flows,
  screenshot parity review, and TestFlight/Play internal builds still need
  product/build credentials.
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
- `pnpm --filter mobile typecheck` - pass
- `pnpm lint` - pass
- `pnpm build` - pass
- `pnpm test` - pass (`cvx` Vitest, 3 files, 14 tests)
- `git diff --check` - pass; Git only reported CRLF normalization warnings

Convex also reported that optional Convex AI guidance files are behind upstream.

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
