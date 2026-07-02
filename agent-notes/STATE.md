# Current Execution State

## Active Focus

- **Branch**: `codex/ferpa-compliance-hardening`
- **Goal**: FERPA/student-data compliance hardening for the Convex-first IA app.
- **Coordination note**: `docs/compliance/ferpa-compliance-audit.md` now includes
  both the original audit and the 2026-07-01 implementation update for this
  branch.

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
- Club management create/deactivate paths require admin roles; workspace detail
  data is hidden from authenticated users who cannot access the club workspace.
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
- Student-facing club/schedule/Flex surfaces no longer expose student
  `uniqueId` in ordinary directory, invite, roster, channel search, or command
  palette flows.
- Club channel pinning is manager-only; message/channel deletion cascades
  replies, reactions, poll votes, mentions, attachment rows, and owned storage
  objects where possible.
- Moderation report listing is scoped to admin/support globally or club
  managers for their own club, and report submission validates target access.
- Student import always generates random temporary passwords; super-admin CSV
  export logs both audit and disclosure events.
- Disclosure events, directory opt-out, scoped notification preference
  validation, generic push payloads, protected-route service-worker cache
  removal, production security headers, and opt-in preview auth origins are
  implemented.

### Frontend and Routing

- `/courses` is included in protected route middleware.
- Club channel message queries include both `clubId` and `channelId`.
- Event creation UI only offers eligible clubs to non-general creators and
  blocks club-scoped submissions without an eligible club.
- Event author cancellation checks both current user id shapes used by the app.
- The browser no longer persists the full `AppUser` object in `localStorage`;
  old `ia_user` values are cleared.
- The external QR-code image service was removed from club invite UI.
- A profile privacy control lets users toggle directory opt-out.

### Remaining Debt

- Announcement feed still has pagination/read-amplification room for improvement.
- `bodyRich` and poll option payloads are still `v.any()` shaped data.
- Flex Friday staff assignment authority still needs a stricter coordinator or
  workshop-owner policy.
- Uploads still need a dedicated metadata table and scheduled cleanup for
  unfinalized/rejected files.
- The FERPA controls added here need Convex regression tests and FCS
  policy/legal review before production student data use.
- Vendor governance, retention/destruction schedules, incident response, parent
  rights workflows, and directory notice/opt-out import from FCS remain
  operational requirements outside this code branch.
- Legacy `apps/api` and `packages/contracts` references should be deleted or
  formally retained once the team decides their fate.

### Verification (latest)

- `pnpm --filter cvx codegen` - pass
- `pnpm --filter cvx typecheck` - pass
- `pnpm --filter web build` - pass
- `pnpm lint` - pass with one warning in
  `apps/web/src/components/dashboard/widget-registry.ts`
- `pnpm build` - attempted through Turbo, but the tool timed out without a
  captured result; the equivalent package checks were run directly and passed.
- `pnpm test` - no package test tasks are registered, so Turbo executed none
- `git diff --check` - pass; Git only reported CRLF normalization warnings

Convex also reported that optional Convex AI guidance files are behind upstream.

## Next Work

1. Deploy the Convex schema/index/function changes to the target deployment
   before production student/staff use.
2. Add Convex regression tests for the access-control boundaries changed in this
   branch.
3. Decide whether the legacy `apps/api` app and `packages/contracts` should be
   deleted now or retained temporarily for reference.
4. Address the remaining hardening and governance debt listed above.

## Handoff Commands

```bash
pnpm --filter cvx codegen
pnpm --filter cvx typecheck
pnpm lint
pnpm build
pnpm test
```
