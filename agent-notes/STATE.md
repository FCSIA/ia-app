# Current Execution State

## Active Focus

- **Branch**: `agent/web-chat-modernization` (draft PR #45)
- **Goal**: Modernize web chat behavior and presentation while preserving the shared Convex-first mobile/web model.
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
- Channel message deletion now erases content immediately, retains roots only
  while they anchor replies, and removes attachments/storage plus related
  reactions, mentions, and poll votes in bounded scheduled batches.
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
  Expo/SecureStore auth, Convex live data, shared design tokens, IA app assets,
  production-shaped dynamic Expo config, redesigned 5-tab mobile IA,
  announcements/feed, clubs/chat/reporting/join approvals/people/tags,
  Calendar hub (My Week, Month, Events), Discover for Courses/Flex/Wrapped,
  Flex Friday browse/register/pass, notifications inbox plus settings,
  profile/avatar/password, persisted themes with editable custom mobile
  colors, dev-only design-system gallery, offline cached dashboard/schedule/
  pass state, notification deep-link routing, native push device/test-push
  validation in settings, and Maestro smoke flows.
- Mobile config now supports opt-in `EXPO_IOS_PERSONAL_TEAM=1` builds that omit
  paid-team-only iOS push and Associated Domains entitlements, use a
  developer-supplied bundle identifier, and leave Android/school builds
  unchanged. The app explains that remote push is unavailable in this mode.
- Android Expo Go QA now uses safe-area in-app headers instead of native stack
  headers, non-translucent status bars, React Native-safe RGB/RGBA mobile
  colors, visible disabled/primary buttons, and Android emulator Convex env
  sync via `pnpm sync:convex-env -- --android`.
- Mobile navigation is student-prioritized: tab bar is Home, Calendar, Clubs,
  Feed, Discover. The old More and Classes tabs are removed. Inbox and Profile
  are reachable from every tab through the shared in-app header, and Profile
  owns Appearance and Notification settings.
- Mobile UI has a shared primitive layer for headers, rows, segmented controls,
  chips, switches, avatar, skeletons, icon buttons, bottom sheets, stats,
  press-scale motion, haptics, and toast feedback. Dashboard customization now
  uses a bottom sheet with drag-to-reorder.
- Mobile club chat now keeps its composer above the iOS home indicator and
  keyboard, renders emoji reactions with canonical token payloads, and allows
  independent message operations without freezing the composer.
- Mobile club chat shows people mentions by name while retaining stable IDs in
  portable links, offers a labeled reaction picker and author-only edit action
  on long press, and supports deliberate swipe-to-reply with reduced-motion
  behavior.
- Club workspaces now prioritize People and Shared content over internal mention
  groups, search channel names and access-checked message history, and collect
  paginated files and images for each readable channel.
- Web channel chat now uses paginated message summaries, bounded thread reads,
  shared optimistic message insertion, concurrent attachment staging, compact
  shadcn chat/composer primitives, names-only mention results, out-of-flow
  message actions, and a compact animated channel-alert sheet. The club shell
  now uses a narrow navigation subscription, channel permissions load
  separately from the bounded mention audience, and notification preference
  fanout uses exact indexed lookups.
- Web club pages now use a compact, channel-first workspace inspired by Discord's
  conversational density: the shared club/channel navigation is available on
  desktop and mobile, messages render as a flat hover-action timeline, and the
  club directory, overview, people, tags, and composer use tighter flat rows
  instead of spacious nested cards. Channel reactions now stay in document flow,
  the solid composer and message spacing preserve clear separation, channel
  alerts update optimistically, and pinned messages live in the channel toolbar.
- Mobile schedule rows use readable semantic period badges and open the linked
  course detail from Home and My Week while preserving edit-mode selection.
- Mobile announcement feed/detail views use flat editorial rows, restrained
  unread tinting, compact top-right read/save controls, and divider-free comment
  threads.
- Mobile announcement search composes with All, Unread, and Saved filters, and
  unread rows choose the perceptually furthest accessible theme surface rather
  than assuming a lighter or darker direction.
- Mobile Flex Friday uses a flat pass/date/session/workshop hierarchy with
  compact selectors, inline status, capacity, and location details instead of
  nested card and pill stacks.
- `packages/design-tokens` centralizes theme, badge, radius, spacing, and type
  tokens for web/mobile consumption. Web imports the Tailwind token bridge.
- `packages/fun-facts` centralizes the shared school-appropriate fun fact bank
  and picker used by both the web loading/dashboard widget and the mobile Home
  Fun Fact card.

### Remaining Debt

- Mobile v1 is repo-local store-ready. Remaining mobile launch blockers are
  external: school-controlled EAS project id/account owner, Apple/Google store
  accounts, universal-link domain files, reviewer credentials on a demo
  deployment, physical iOS/Android push validation, screenshot capture, and
  TestFlight/Play internal-track builds. See `apps/mobile/STORE_READY.md`.
- Announcement feed still has pagination/read-amplification room for improvement.
- `bodyRich` and poll option payloads are still `v.any()` shaped data.
- Web still has a localStorage-backed user cache that may need a privacy pass.
- Legacy `apps/api` and `packages/contracts` references should be deleted or
  formally retained once the team decides their fate.

### Verification (latest)

- `pnpm --filter cvx codegen` - pass
- `pnpm --filter cvx typecheck` - pass
- `pnpm --filter cvx test` - pass (14 files, 47 tests)
- `pnpm --filter mobile typecheck` - pass after mobile redesign/IA refactor
- Android Expo Go smoke pass - pass for hosted Convex login session, dashboard,
  Courses list/detail, Events empty state, Calendar personal create/delete,
  Schedule view/edit-mode controls, Clubs list/request-only detail state,
  Wrapped closed state, Profile avatar/password controls, safe-area back
  spacing, and More navigation. Alex STU001 has no approved club memberships in
  the hosted dataset, so member-only club channel/people/tag runtime actions
  were source/typecheck verified but hidden for that user.
- Latest design/tab pass was typechecked. Android Expo Go visual rerun was
  blocked because Expo Go stopped requesting the Metro bundle after reload even
  though Metro `/status` returned `packager-status:running` and `adb reverse`
  mappings existed; restart Expo Go/Metro before the next visual QA pass.
- `pnpm --filter mobile test:maestro` - not run locally; requires Maestro plus
  a built simulator/device app and seeded credentials.
- `pnpm lint` - current rerun reaches the web checks but fails in the unrelated
  mobile package because TypeScript 6 treats its `baseUrl` setting as a
  deprecation error; focused web lint passes with pre-existing warnings only.
- Focused optimistic chat tests - pass (2 tests after moving the helper to
  `apps/shared/chat`)
- `pnpm build` - pass
- `pnpm --filter web exec tsc --noEmit` and `pnpm --filter web build` - pass
  after the compact club-workspace redesign and channel interaction polish;
  signed-in visual QA remains to be run because no browser-control session was
  available.
- `pnpm test` - pass (`cvx` Vitest, 14 files, 47 tests)
- `git diff --check` - pass; Git only reported CRLF normalization warnings

Convex AI guidance and project skills were refreshed with `convex ai-files
update`; current shadcn skills were installed project-locally from `shadcn/ui`.
The dedicated Convex performance audit found no deployment Health issues over
the last 72 hours. Runtime logs instead identified broad chat-route club shell
subscriptions as the dominant read amplification; those subscriptions were
narrowed in draft PR #45.

## Next Work

1. Review and merge draft PR #45 after the web chat visual/interaction pass.
2. Deploy the Convex schema/index/function changes to the target deployment
   before production student/staff use.
3. Coordinate with the FERPA session before touching `docs/compliance/` or the
   FERPA entry in `docs/index.md`.
4. Decide whether the legacy `apps/api` app and `packages/contracts` should be
   deleted now or retained temporarily for reference.
5. Address the remaining lower-priority hardening debt listed above.

## Handoff Commands

```bash
pnpm --filter cvx codegen
pnpm --filter cvx typecheck
pnpm lint
pnpm build
pnpm test
```
