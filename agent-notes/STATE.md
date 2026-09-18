# Current Execution State

## Active Focus

- **Branch**: `main`
- **Goal**: Make Convex usage scale predictably from the 2026-08-31 production
  baseline toward a 1,500-user, chat-heavy school rollout, without mutating or
  deploying to production.
- **Coordination note**: A parallel FERPA/compliance session owns `docs/compliance/`
  and the FERPA link in `docs/index.md`. Avoid editing those unless explicitly
  asked.

## Current Truth

### Convex Usage and Scale Audit (2026-08-31)

- Production `elated-anaconda-301` was inspected read-only. No production
  function was run, no deployment was selected for mutation, and no data was
  changed.
- The current production dataset has 172 application users. Better Auth has 77
  users with currently valid sessions; 29 distinct users had session activity
  in the sampled 24-hour window and 77 in the sampled seven-day window.
- The dashboard screenshots cover roughly August 6-31: 756K function calls and
  1.05 GB database I/O, of which 98.9% was reads. That is about 29K calls and
  40.4 MB of I/O per day. Using the 29 recently active users as a directional
  DAU denominator gives roughly 1,000 calls per active-user day and 1.4-2.7 MB
  of database I/O per active-user day, depending on whether the period average
  or August 31 is used.
- A post-PR #90 production log sample of 1,000 completed executions over about
  65 minutes read 7.64 MB / 16,692 documents. The dominant uncached reads were
  `clubs/detail:getWorkspaceNavigation` (~281 KB / 711 documents per uncached
  execution), `schedule/dashboard:get` (~127 KB / 212 documents),
  `courses/catalog:list` (~89 KB / 106 documents), `clubs/channels:list`
  (~383 KB / 976 documents), and `clubs/detail:get` (~331 KB / 841 documents).
- The 72-hour Convex health insights had no high-read or resource-limit event;
  they contained only four write-contention retries. This means no single
  execution crossed the insight thresholds, not that the aggregate read rate
  is scale-ready.
- Current fixes batch channel access state across sibling channels, reuse
  already-loaded club unit state, avoid fetching public-channel membership
  lists, batch repeated message-author reads, hydrate each schedule course only
  once, bound unfiltered course candidate reads by the requested limit, and
  move the mobile Home dashboard from the full friend-schedule query to the
  day query.
- Workspace navigation and channel activity are now separate subscriptions.
  Message creation no longer patches `clubChannels.lastMessageAt`, so a hot
  channel does not invalidate the broad club/structure/membership navigation
  query for every viewer. A compact activity query reads only the newest
  indexed message per visible channel plus the viewer's receipts. Web and
  native chat advance receipts only while visible, throttle them to at most one
  attempt every three seconds, and the mutation skips no-op writes.
- Message audit events retain a 240-character preview, lengths, attachments,
  poll, reply, actor, and entity context instead of duplicating each message's
  full plain-text and Markdown payload into `auditEvents`.
- Convex Professional is likely sufficient for the realistic 1,500-user school
  workload after these optimizations, but the literal 3-10 messages per minute
  from all 1,500 users is a stress ceiling rather than a normal human workload.
  It implies 47.52M-158.4M messages in a 22-day, eight-hour school-month, or
  194.4M-648M if sustained 24/7. The current one-scheduled-notification-job per
  message architecture already makes that at least two function executions per
  message before reactive subscribers, receipt writes, mentions, or push jobs.
  Load testing and a reverse notification-subscriber index are required before
  promising that ceiling on the Professional S256 deployment class.
- PR #90's documented one-time production refreshes still appear outstanding:
  `courseCatalogMetadata` is empty and `appStats.roleGroupCountsReady` is
  absent. An authorized operator must explicitly approve running
  `internal.courses.metadata.refresh` and
  `internal.stats.rebuildUserCounts` against production.
- The next chat scale work is to avoid scheduling a notification job for every
  ordinary message when all-message notifications are opt-in, materialize or
  batch per-message reactions/polls/attachments so a 30/50-message page does
  not perform N-per-message reads, and run a production-shaped load test that
  measures subscription fanout and S256 concurrency. The legacy optional
  `clubChannels.lastMessageAt` field remains for compatibility and can be
  removed in a later narrow migration after deployed clients no longer read it.

### Security Audit Remediation (2026-08-09)

- All critical, high, medium, and low findings in the dated security audit have
  code remediations on `codex/security-audit-remediation`.
- The work covers Better Auth route and role hardening, forced password reset,
  private club/channel access, upload ownership and file-signature validation,
  abuse throttles, response validators, client cache cleanup, dependency and CI
  pinning, and destructive-operation maintenance authorization.
- Full tests, lint, production build, frozen install, and the production
  dependency audit pass. A built Next.js request against the isolated local
  Convex deployment returns `200` with enforcing CSP, HSTS, frame, MIME,
  referrer, and permissions-policy headers.
- Production was not selected or mutated. After merge/deploy, an authorized
  operator must run the documented role/search reconciliation and rotate any
  remaining legacy imported credentials before declaring the live deployment
  remediated.

### PR Reconciliation (2026-08-08)

- All ready reconciliation PRs are merged: #69-#75, #77, and #80.
- The stacked clubs/OCR/calendar/search series preserved ancestry with normal
  merges through #71, then squash-merged its final #72 layer.
- The special-day #74 base was normally merged before squash-merging its #75
  friend-link/private-group layer. Independent #73, #77, and #80 were
  squash-merged.
- React Doctor and Contributor Validation passed on every refreshed branch;
  local brand, lint, test, and production-build checks passed on the combined
  result.
- Draft FERPA PR #76 and draft login follow-up PR #83 remain open and untouched.
- GitHub reports no remaining open issues.

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

- Club membership now points to club-owned role records with granular
  permissions. New clubs seed renameable `Member` and `Leader` roles; those
  names have no intrinsic backend authority. Existing enum rows remain a
  migration fallback until a club initializes its role records. Role powers
  cover announcements, events, channels, moderation, membership, codes, tags,
  structure, settings, and role administration.
- Clubs now support manager-configured arbitrary internal trees through generic
  units rather than fixed subclub/group levels. Units have free-form type
  labels, presence-only member assignments, per-unit join policies and
  revocable QR codes, and audited mutations. Roles and structure are
  independent. Channel settings own optional role and unit filters; role
  choices are ORed, role/unit filters are ANDed, parent assignments inherit
  downward without sibling access, and selected people remain OR exceptions.
  Channel sidebar order is persisted per structure level and managed through
  the settings Sortable editor; placement remains independent from access.
  Structure management and permanent club deletion live in the dedicated club
  settings page.
- Club creation uses the staff/admin allowlist; club deactivation requires admin
  roles; workspace detail data is hidden from authenticated users who cannot
  access the club workspace.
- Channel reads/writes/reactions/polls now validate channel access, parent
  message channel ownership, inline reply target ownership, and poll option
  membership. Inline replies use an optional `replyToMessageId`; only
  `parentMessageId` creates a thread.
- Channel message deletion now erases content immediately, retains roots only
  while they anchor replies, and removes attachments/storage plus related
  reactions, mentions, and poll votes in bounded scheduled batches.
- General events require an event-manager role; club events require admin,
  sponsor, or the club role's event-creation permission.
- Calendar creation no longer lets regular users create non-personal calendar
  sources.
- Announcement comments require announcement read access; club announcement
  drafts require the role permission, while approval remains limited to global
  approvers or the relevant club sponsor.
- Flex Friday attendance and assignment paths validate active student targets,
  workshop/session conflicts, existing registration/assignment state, and
  capacity.
- Upload finalizers verify storage metadata instead of trusting caller-provided
  size or MIME type.
- Convex schema now has relationship indexes for the hot club/event/channel/
  notification/Flex paths; codegen has been run.

### Frontend and Routing

- The official production web origin is `https://app.fcsia.com`. It is attached
  to Vercel Production, and Convex production `elated-anaconda-301` has
  `SITE_URL`, `NEXT_PUBLIC_SITE_URL`, and `BETTER_AUTH_TRUSTED_ORIGINS` set to
  that origin. The unauthenticated `/api/auth/get-session` endpoint responds
  successfully from the new domain. The former
  `https://ia-app-alpha.vercel.app` hostname now serves a static migration
  notice before authentication with a link to an unlisted, platform-specific
  Home Screen installation guide, while the official domain continues to serve
  the application.
- Web authentication now stays on the browser's current origin, so local LAN
  addresses and development tunnels retain the session cookie. The web auth
  proxy rejects cross-origin POSTs; arbitrary forwarded hosts are accepted only
  by explicitly initialized loopback Convex deployments, while cloud
  deployments retain an explicit origin allowlist.
- Same-LAN web PWAs now receive LAN-reachable public Convex URLs from
  `pnpm sync:convex-env -- --host <LAN IPv4>` while server calls stay on
  loopback. Protected-route auth startup renders a branded connection state
  instead of an unexplained blank screen when the backend is slow or
  unreachable.
- Web sign-out now transitions through a query-free `/logout` route before
  revoking the session, and protected route content stays unmounted while
  Convex authentication is loading or absent. This prevents live page queries
  from throwing during logout or session loss.
- The web club directory centers `Your clubs`, uses the group-user icon, and no
  longer exposes the retired `/clubs/[clubId]/tags` route.
- Students can review browser-local OCR matches from an Infinite Campus Term
  schedule screenshot before applying Monday-Thursday classes and saving.
- The calendar follows active theme tokens, Flex Friday uses the compact app
  shell hierarchy, and Cmd+K searches people plus access-checked club channels.
- The web calendar now uses the current Radix ReUI event-calendar source instead
  of a hand-built scheduler. Desktop offers month, week, day, and agenda; mobile
  intentionally offers agenda and day only. The Dashboard calendar uses the
  shared date-calendar adapter, and the ReUI registry is pinned to Radix Nova so
  the old `new-york` style cannot resolve Base UI source into this Radix app.
  Its compact picker keeps header actions inline, removes the selected-today
  cell backdrop, and preserves event-dot contrast on selected dates.
- The calendar route uses the bounded visual-viewport shell so agenda and day
  own working internal scrollports. Agenda keeps descriptions hidden and uses
  a one-line, horizontally scrollable title region with edge-aware overflow
  fades; the connection dialog documents immediate first sync plus automatic
  six-hour refreshes.
- Web Custom appearance is available in production again. Its palette schema
  now owns both the editor slots and CSS-variable mapping, exposes page Text for
  wallpaper legibility, validates restored local colors, and selects automatic
  black/white foregrounds by WCAG contrast rather than a luminance cutoff.
  Follow-up feedback from v0.8.20 showed page foreground leaking into opaque
  club cards and reaction popups. Raised surfaces and app-owned card containers
  now share one card-foreground scope, while all popup families use the paired
  popover scope; wallpaper text stays local to the page substrate. Fluid's
  unlayered surface ladder now gives Custom the same dark-surface cascade level
  as Bubblegum Dark, and invalid custom Text/Background or Primary/surface
  contrast combinations are rejected before application or local persistence.
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
- Mobile UI has task-specific `FeedScreen`, `WorkspaceScreen`, and `FormScreen`
  variants; density tokens; composition primitives; compact list and field
  APIs; local rn-primitives collapsible/separator adapters; and a Gorhom-backed
  sheet that uses `BottomSheetTextInput` for fields rendered inside it. The
  existing shared headers, segmented controls, chips, switches, avatar,
  skeletons, icon buttons, stats, press-scale motion, haptics, and toast
  feedback remain available.
- Mobile club chat now keeps its composer above the iOS home indicator and
  keyboard, renders emoji reactions with canonical token payloads, and allows
  independent message operations without freezing the composer.
- Mobile club chat shows people mentions by name while retaining stable IDs in
  portable links, offers a labeled reaction picker and author-only edit action
  on long press, and supports deliberate swipe-to-reply with reduced-motion
  behavior.
- Mobile club workspaces now use a compact Discord-inspired channel hierarchy:
  an 8px workspace inset, 44px search/actions and single-line visibility-aware
  channel entries without descriptions, a horizontal 40px category header,
  and a 44px detail header. Chat uses tighter message gutters and date markers,
  while formatting lives behind the composer tools button.
- The mobile UI foundation audit and implementation boundary are recorded in
  `docs/reference/mobile-ui-foundations.md`. NativeWind remains the styling
  layer, rn-primitives is adopted incrementally behind local adapters, the
  sheet now uses Gorhom, and Expo UI/Tamagui/gluestack/Paper were not added.
- Device screenshots caught an over-compressed first migration of Dashboard,
  Discover, Calendar, Profile, and Settings. Those broad visual migrations were
  reverted; compact density is scoped to single-line workspace tasks until
  each other workflow receives its own reviewed composition.
- Club workspaces now prioritize People and Shared content over internal mention
  groups, search channel names and access-checked message history, and collect
  paginated files and images for each readable channel.
- Web channel chat now uses paginated message summaries, bounded thread reads,
  shared optimistic message insertion and reactions, concurrent attachment
  staging, compact shadcn chat/composer primitives, names-only mention results,
  out-of-flow message actions, long-press/right-click context menus, quoted
  channel replies that remain in the main timeline, explicit thread actions,
  mobile PWA thread sheets, and a
  collision-aware single-surface channel-alert popover with Fluid radio choices
  and persisted timed mutes. The club shell now uses a narrow
  navigation subscription, channel permissions load separately from the
  bounded mention audience, and notification preference fanout uses exact
  indexed lookups.
- Web club pages now use a compact, channel-first workspace inspired by Discord's
  conversational density: the shared club/channel navigation is available on
  desktop and mobile, installed mobile PWAs use a scrollable club rail beside
  the channel pane, and right-swipes begin the spring reveal before touch release.
  Shell-level right swipes are otherwise disabled; the global More panel opens
  only from its explicit navigation control.
  Messages render
  as a flat hover-action timeline, and the
  club directory, overview, people, tags, and composer use tighter flat rows
  instead of spacious nested cards. Channel reactions now stay in document flow,
  the solid composer and message spacing preserve clear separation, channel
  alerts update optimistically, and pinned messages live in the channel toolbar.
- Web club workspaces are bounded to the live visual viewport. On iPhone PWAs,
  opening the keyboard resizes the shell while the message timeline remains the
  sole scroll owner, so the shared safe-area header and composer stay anchored.
  The focused root composer uses the same solid card surface as the workspace
  and collapses duplicate shell/dock bottom insets without keyboard detection.
- The web PWA header exposes search without a keyboard shortcut hint on compact
  screens. Dashboard customization lives in the header, and the greeting is a
  borderless date summary instead of a live seconds clock.
- Web tab call sites use the shared current Fluid Tabs appearance and keep
  overflow/layout concerns on parent containers rather than restyling tab lists
  or tab items per page.
- Web club navigation and discovery use Fluid Card groups and nested surface
  levels, with primitive-backed dropdown selection, Fluid ScrollArea panes,
  sticky personal clubs, and channel/global search switching. Notification
  settings use visible surface states and hierarchical club gates: turning a
  club off disables delivery for its channels while retaining each channel's
  saved preference for restoration.
- Web app-owned bounded panes now share the Radix Fluid ScrollArea treatment:
  desktop scrollbars remain visibly discoverable and strengthen on hover or
  scroll, horizontal and dual-axis panes use the same primitive, and
  touch-primary devices fall back to native momentum scrolling. Generic panes
  no longer use mask fades that can imply nonexistent overflow; the chat
  scroller keeps its own measured edge treatment. Behavior-owned chat, menu,
  editor, tab, and attachment scrollports retain their existing contracts.
- Web schedules now use a Fluid-first two-pane workspace: the selected school
  day stays mounted while date data refreshes, dates use the shadcn calendar
  popover, class pickers are anchored only to explicit row toggles, school times
  are displayed in 12-hour format, and friend links are created and revoked in
  a compact non-modal popover with locally generated IA-branded QR sharing.
  Schedule groups now have their own top-level tab and compact create popover;
  auth-sensitive schedule queries stop during logout, and student IDs are no
  longer rendered across web or mobile UI surfaces.
- Web UI handoff now follows the required primitive-first gate in
  `agent-notes/WEB_UI_WORKFLOW.md`: agents must inspect current Fluid docs,
  rendered and Code examples, APIs, registry source, and local adapters; choose
  primitives by semantics; preserve proximity registration; and escalate shared
  primitive gaps instead of patching pages. ESLint now keeps semantic tables,
  headless-library imports, interactive badges, raw pressed buttons, and direct
  clipboard use behind shared UI contracts.
- The schedule editor now uses indexed Fluid table rows, Discover Clubs forwards
  CardGroup indices like the channel-list reference, the date picker matches the
  current DayPicker/Fluid DOM contract, quick filters use a shared ToggleGroup,
  and visible friend/join values use Fluid InputCopy. Event Share uses the native
  share sheet with a centralized copy fallback.
- Superadmin day plans now use the REUI Sortable interaction for pointer, touch,
  and keyboard block reordering while keeping school time slots fixed; redundant
  arrow controls and the superadmin-only one-item tab list are removed. The admin
  date chooser uses the current shadcn Popover + Calendar composition with fixed
  Tailwind v4 CSS-variable sizing, while date/template navigation and schedule
  option fields use the exact current Fluid Radix Tabs and Select sources without
  call-site styling overrides. Applying a template is labeled and explained as a
  date-plan replacement instead of a clipboard-style clone.
- Schedule day-plan management is calendar-first: configured academic-year
  boundaries and a mandatory regular template drive Monday–Thursday
  inheritance, Fridays remain unassigned until an admin acts, and linked date
  assignments follow template edits until explicitly unlinked into custom
  snapshots. No-school templates contain zero blocks. Initial production data
  must be configured by an `ADMIN` or `SUPER_ADMIN`; until then, management is
  gated behind a dedicated setup flow and does not render the calendar or normal
  tabs. Calendar cells use compact status dots, a legend, and detailed tooltips.
  Student, friend, and group schedule navigation uses calendar dates instead of
  weekday selector strips.
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

- The club workspace selector is route navigation and should use the current
  Fluid Dropdown popup contract. The existing retrofit is intentionally not
  extended: current Fluid `MenuItem` lacks the leading-media and link-composition
  API needed for club logos and native navigation. The proposed shared API is a
  constrained `leadingMedia` slot plus `render={<Link ... />}` composition while
  `MenuItem` retains ownership of label, current/check state, index registration,
  roving focus, and close-on-select. Approve and implement that shared primitive
  API before migrating the selector and the remaining legacy dropdown
  compositions.
- Signed-in visual interaction QA is still required for the repaired proximity
  highlights, calendar geometry, course picker density, copy controls, filters,
  and keyboard/reduced-motion states because browser control was unavailable.
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

- Custom-theme surface follow-up: card and popup foreground scopes are now
  consistent across schedule, notification, shell, club, admin, and shared UI
  surfaces. Web TypeScript, lint, production build, focused surface/palette
  assertions, and `git diff --check` pass. Lint reports 21 existing warnings;
  signed-in visual review remains pending.
- `direnv exec . pnpm --filter web exec tsc --noEmit` - pass after the web UI
  primitive workflow and remediation slices.
- Web calendar replacement: `pnpm --filter web exec tsc --noEmit`, web lint,
  frozen offline install, production build, and `git diff --check` pass. Lint
  reports only existing warnings outside the calendar slice; signed-in visual
  review is still required for responsive calendar states.
- `direnv exec . pnpm --filter web lint` - pass with 7 existing unrelated
  unused-import warnings.
- `direnv exec . pnpm --filter web build` - pass through compilation,
  TypeScript, page data, all 18 static pages, and route optimization.
- `pnpm --filter mobile typecheck` - pass
- `pnpm lint` - pass with 7 existing web warnings outside this slice
- `pnpm --filter cvx codegen` - pass
- `pnpm --filter cvx typecheck` - pass
- `pnpm --filter cvx test` - pass (14 files, 47 tests)
- `pnpm --filter mobile exec tsc --noEmit` - pass after removing the deprecated
  mobile `baseUrl`, correcting compact density, and reverting the broad visual
  migrations
- Mobile Vitest suite - pass (14 files, 42 tests)
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
- `pnpm lint` - pass; web reports 8 pre-existing unused-import warnings and no
  errors
- Focused optimistic chat tests - pass (2 tests after moving the helper to
  `apps/shared/chat`)
- `pnpm build` - pass across design tokens, fun facts, Convex, mobile, and web
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

1. Review and merge the replacement stacks in base-first order: #69 -> #70 ->
   #71 -> #72, #74 -> #75, and #78 -> #79 / #80. Review independent PRs #73 and
   #77 separately; keep draft #76 blocked until district/legal decisions land.
2. For issue #65, approve a pinned Codex Security command/action, its exit-code
   contract, fork-PR secret policy, findings retention, required check name, and
   triage owner before adding that gate.
3. Reload the mobile Club workspace on a physical device and verify the
   horizontal category header, 44px channels, chat rhythm, keyboard, and sheet
   behavior; no simulator was booted for the corrective pass.
4. Review and merge draft PR #45 after the web chat visual/interaction pass.
5. Deploy the Convex schema/index/function changes to the target deployment
   before production student/staff use.
6. Coordinate with district/legal owners before representing the FERPA work as
   production-ready or changing unresolved policy sections.
7. Decide whether the legacy `apps/api` app and `packages/contracts` should be
   deleted now or retained temporarily for reference.
8. Address the remaining lower-priority hardening debt listed above.

## Handoff Commands

```bash
direnv exec . pnpm --filter cvx codegen
direnv exec . pnpm --filter cvx typecheck
direnv exec . pnpm lint
direnv exec . pnpm build
direnv exec . pnpm test
```
