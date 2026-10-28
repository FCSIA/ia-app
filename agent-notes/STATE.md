# Current Execution State

## Active Focus

- **PR #173 local review (2026-10-28)**: `codex/pr-173-volunteer-reporting`
  in `.worktrees/pr-173-review` contains the volunteer UI/reporting follow-up.
  Its anonymous local backend uses 3294/3295; the web preview uses 3173.
  Members have exact-minute personal tracking; permitted reviewers have all-time
  club totals, member breakdowns, and complete status-filtered history. Proof
  restaging/cleanup now preserves submitted evidence. Existing demo records are
  retained and indexed. Signed-in phone-width diagnostics cover 320/390px and
  tablet/desktop widths; native-device and design-owner review remain pending.
  Keep this worktree/backend separate from concurrent PR #171 and the primary
  checkout's unrelated edits. No remote push or shared deployment is authorized.

- **Current checkout (2026-10-21)**: The primary checkout is on
  `codex/desktop-notification-banner`, carrying the three earlier local banner
  commits onto main after audit PR #152 squash-merged as `4c464526`.
  The original commits are preserved on `work/desktop-notification-banner`.
- **Current goal**: The owner authorized including the banner in the release,
  after squash-merging audit PR #152 and running `release:ship`.
  Release PR #165 is held in draft until the banner lands; regenerate its single
  release commit from the combined main before validation and production shipping.
  This supersedes earlier draft/awaiting-owner-review and no-production-authorization
  notes for this release. Preserve main's preferred-name display/search support
  when integrating the audit refactor. Local demo data remains intact.
- **Dashboard calendar follow-up**: The owner requested a small commit directly
  in the primary `main` checkout after PR #163 squash-merged as `8b29a445` on
  October 18. After owner feedback, the month controls and full-calendar arrow
  share one header through DayPicker's existing Month slot; the redundant
  Calendar heading is removed. Date targets retain the calendar's cell size in
  touch mode. Material visual changes remain awaiting owner review.
  Web typecheck, lint (21 existing warnings), production build, and the pinned
  changed-file React Doctor scan pass. Browser checks cover 320–1440px layouts,
  touch date grids, keyboard selection, six-week months, and the shared schedule
  date picker. Captures: `/tmp/ia-calendar-review/`; native device review was not run.
  The prior release-headline PR #162 is squash-merged as `00bad9db`.
- **Integration**: On October 17 the owner explicitly authorized squash-merging
  the reviewed UI work in #154–#158 onto main and requested React Doctor fixes.
  #154–#157 landed as `c3a15071`, `c53396d7`, `df566c46`, and `ef157d6a`.
  #158 includes those settings, clubs, and feedback prerequisites and is
  reconciled with their squash commits so final CI validates the combined source.
  Each PR retains a separate squash merge.
  This authorization supersedes older awaiting-owner-review notes below.
- **Goal**: Land verified changes and complete the authorized release. Native
  iPhone swipe verification remains outstanding.
- **Coordination note**: A parallel FERPA/compliance session owns `docs/compliance/`
  and the FERPA link in `docs/index.md`. Avoid editing those unless explicitly
  asked.

## Current Truth

### Audit UI Repair (2026-10-20)

- Current-main integration preserves preferred-name display and regular/preferred
  name searches across basic, paginated, and structured audit queries. All 455
  backend tests across 87 files, backend/web typechecks, and web lint (21 existing
  warnings) pass. The owner authorized PR #152's squash merge and `release:ship`;
  production uses `elated-anaconda-301` and `app.fcsia.com` through release CI.
- The latest composition pass puts view tabs, search, and Filters in one desktop
  toolbar, with inline one/two/four-column filters and nested advanced search.
  Action and record now share a cell: category plus concise verb, then the title.
  Duplicate category nouns, title-plus-ID clutter, and repeated basic search
  summaries are removed. Category colors stay consistent across deletions.
  Complete timestamps remain on every row; long names and unknown categories
  are bounded with complete data in Details. Material visuals await owner review.
- Comment audit events now retain the announcement ID/title in existing metadata,
  including deletion events. No schema migration or dependency upgrade is needed.
  The authorized `anonymous-agent` demo update succeeded, preserving 55 historical
  records. Eight comment tests pass, including deletion/orphan context and refusal
  for a different user; 32 audit and four engagement tests also pass. Web/backend
  typechecks, web lint (21 existing warnings), and the production build pass.
  Five-width, long-content, query recovery, and Details diagnostics are documented
  in the review notes; the final live console has no errors.
- The owner requested omitting read/unread audit events. Announcement mutations
  now preserve personal read state without emitting them; other read-state
  domains already omitted them. Existing history is retained. All 25 focused
  audit/engagement tests and backend typecheck pass, and the authorized local
  demo update is complete with its 55 historical records intact.
- Follow-up repairs shared Calendar/Popover geometry and surface contracts,
  selected-tab visibility, reduced-motion behavior, and Table's inherited font
  axis that suppressed nested emphasis. Audit rows now emphasize actions and use
  compact semantic category colors with readable foreground text. Date pickers
  reopen on their selected month and retain only caller-specified bounds.
- DateTimePicker uses standard month navigation so future years are available.
  Browser checks pass time editing, future navigation, Escape/focus return, and
  a fitting 248px popup at 390px. The test form was canceled without saving.
- All 21 focused audit tests pass, including missing-quote recovery. The authorized
  local demo was updated again with that parser fix; its 55 records remain.
  Web typecheck/lint (21 existing warnings) and production build pass. Five-width
  and six-theme diagnostic review is recorded in the QA document; material visuals
  still await the design owner. No remote branch push was performed.
- Full-width disclosures and a container-fitting grid replace the 288px filter
  container that squeezed desktop controls into roughly 57px columns. The audit
  table separates time, person, activity, and record on desktop and folds these
  into the activity cell as space narrows. Redundant headings and introductory
  copy are removed; complete details remain available.
- Passive admin panels, metrics, notices, and feedback/report cards no longer
  highlight on hover. Existing interactive controls retain their feedback.
- Details restore focus to their opener. Integration retains main's approved
  calendar cell sizing instead of layering the audit branch's overlapping touch
  width/aspect rule over it.
- Web typecheck, lint (21 existing warnings), and production build pass through
  `direnv exec .`. All 17 audit backend tests pass offline. Browser checks cover
  five widths from 320px to 1440px, six themes, long content, filter results,
  details/raw data, focus return, and loading/empty/pagination states.
- The owner explicitly authorized updating the existing local demo at port 3210.
  A one-time, typechecked function push to `anonymous-agent` succeeded without
  resetting or seeding data. All 55 original audit records remain. Live browser
  checks pass category views (55 general / 0 flex), an inclusive October 17 date
  range (16), advanced search (1), invalid-draft preservation, and hydrated Details.
- Port 3210 serves the demo state stored in the `merge-pr147` worktree. The
  primary checkout's selected local deployment has the same ports but separate
  state. Do not start another schema watcher against it. Web alone is running
  at port 3000; backend updates were performed with an explicit temporary target.
- Main integration verification passes web/backend typechecks, web lint (21
  existing warnings), production compilation, and all 407 backend tests across
  84 files. Main is merged locally. No remote branch push was performed.
- See `docs/reference/audit-ui-review-2026-10-20.md` for evidence and remaining
  review limits.

### Audit Log Readability (2026-10-02)

- Audit-only changes are on `codex/admin-audit-log-ux` in the managed
  `admin-audit-log-ux/ia-app` worktree. The original checkout contains concurrent
  preferred-name work and the combined local preview; preserve that work.
- Plain-language labels, related names, complete original details, an All view,
  bounded advanced search, and pagination through empty batches are implemented.
- 36 focused tests pass, including complete 620-record history and access gates.
  Web/backend TypeScript, web lint, and production compilation pass. `direnv`
  is unavailable on Windows; verification used the installed Node tooling.
  Production compilation used webpack because Turbopack failed on the isolated
  verification copy's dependency junctions.
- Responsive browser review covered 320px, 390px, 768px, and 1440px widths, basic
  and advanced filters, details, raw data, and keyboard dismissal. The composition
  awaits the design owner's visual review, including themes and reduced motion.
- The user subsequently authorized a draft PR: #152 is open with
  `sreyassabbani` requested as reviewer. Keep it in draft pending human review.
  See `docs/features/audit-log.md`.

### Preferred-name moderation (2026-10-20)

- Preferred-name saves now apply the original English profanity dictionary and
  active school keyword rules before storing or indexing names. Detected language
  is masked; each flagged save atomically records a staff-only name snapshot in
  a pending moderation report, an audit event, and an author notification that
  respects preferences. Existing report-review permissions and status actions
  apply. These reports do not enter the feedback/GitHub issue pipeline.
- Nonempty saves have a per-account token bucket (capacity five, five tokens per
  ten minutes). Clearing remains available during cooldowns or rule-read limits.
  Tests cover dictionary/custom rules, detected obfuscations, innocent Unicode
  names, indexing, report access/review, audit, notification opt-outs, and limits.
- All 415 backend tests and backend/web/mobile TypeScript pass. Devlog and
  whitespace checks pass; the new dependency bundles successfully in this worktree's anonymous local Convex backend (3270/3271).
  The older backend's automatic filtering of other content remains unported;
  see the moderation feature document for that scope and existing UI-copy drift.

### Preferred profile names (2026-10-20)

- Recovered the unmerged preferred-name commits `103981f1` and `f96ddfd5`
  from `codex/admin-audit-readability`, preserving that checkout's unfinished
  audit edits. Ported only preferred-name work into an isolated branch, then
  rebased onto concurrent theme fix `196cf06a` without changing it.
- Web and native settings set or clear a complete preferred display name.
  Shared identity projections, initials, mentions, notifications, and both-name
  searches use the preference while retaining regular roster names and IDs.
  Newer shared announcement authors/filters and profile components remain intact;
  audit searches also match full regular names, and initials preserve Unicode
  code points.
- Final combined verification: all 406 backend tests and 20 focused client
  tests, backend/mobile TypeScript, production web build (including web TypeScript),
  and isolated Convex push pass. Web lint passes with 21 existing warnings;
  React Doctor 0.9.8 has one low-impact advisory on mapping/filtering two name
  values in bulk assignment. Devlog generation and whitespace checks pass.
- Signed-in production-build browser checks at localhost:3004 cover normalized
  save, reload persistence, regular-name disclosure, header/avatar initials,
  clearing, and a 390px layout without horizontal overflow or console errors.
  Design-owner visual review and native device verification remain outstanding.
  Windows lacks direnv, so checks use the repository-pinned Bun 1.4.2 directly.
- Only this worktree's anonymous local backend on ports 3270/3271 was initialized,
  seeded, and updated. Shared and production deployments were not changed.
  See `docs/features/preferred-names-testing.md` for the review checklist.
### Desktop notification setup notice (2026-10-19)

- Release integration rechecked desktop/narrow geometry, saved dismissal,
  loading and permission states. The feature now controls Banner's existing
  `open` prop through eligibility changes, preserving its collapse lifecycle.
  Banner also restores focus when a loading action was disabled before closing,
  while preserving focus explicitly moved elsewhere. Fixture keyboard checks,
  all six eligibility tests, web typecheck and lint (21 existing warnings) pass.
- The dashboard's existing push recovery notice now also offers first-time setup
  on supported desktop browsers. Blocked permission shows browser-settings
  guidance without an Enable action. Explicit browser opt-outs and the existing
  30-day dismissal marker are respected; permission/focus/visibility/storage
  changes refresh the notice. First-time mobile prompts remain unchanged.
- Owner follow-up requests a square, edge-to-edge banner and no subtitle. The
  notification notice now composes Fluid `Banner variant="fixed"`, `BannerTitle`
  and `BannerAction` in AppShell's new `bannerSlot`, outside page padding. Header
  and banner share a sticky group. Current Fluid rendered example, fixed Code,
  API, exact registry source and dependencies were inspected; shadcn confirms
  Radix/new-york/Lucide. Registry dry-run/diff would overwrite shared adapters,
  so only Banner was added, adapted to existing motion/HSL/type/Button contracts
  and protected in `fluid:update`. No shared dependencies were overwritten.
- An isolated fixture renders the actual AppShell/header/sidebar and banner,
  with account, router and push responses mocked. Desktop geometry is exact:
  header bottom/banner top 64px; sidebar right/banner left 72px; radius 0px.
  Edges remain joined after scrolling. 320/390px layouts have no horizontal
  overflow; blocked copy wraps. Keyboard enable still registers and hides the
  notice; keyboard dismissal restores focus and removes its row. Light/dark
  captures: `/tmp/ia-push-review/shell-banner-*.jpg`. This is diagnostic review,
  not an authenticated dashboard or native-device test.
- Six eligibility tests, web typecheck/lint (21 existing warnings), and production
  build pass. An isolated browser fixture verifies keyboard setup, loading,
  successful registration, blocked guidance, opt-out, dismissal/reload/expiry,
  storage-write failure, and mobile recovery. Light/dark and 390px checks are
  diagnostic; authenticated dashboard, real push delivery, and native device
  review were not run. Captures: `/tmp/ia-push-review/`. Visual review remains
  with the design owner. No shared or production deployment was changed.

### Announcement layout and detail pages (2026-10-17)

- Announcement feed and detail views compose the same clickable profile avatar
  and author metadata. Comment queries now return the same limited author
  projection, including avatar and roles, without contact or sign-in fields.
- Mobile feed actions share one row with the author avatar; time and expiry
  stay visible beside the audience. Shared Empty owns vertical centering, and
  Clubs uses the standard AppShell top inset. Detail pages use the approved
  compact CardGroup corners and existing save/report/discussion controls.
- Shared person profiles show mutual-friend and club lists without stat tiles
  or an extra friend-list disclosure. Both lists use the existing compact
  CardGroup corner contract. Section gaps apply only between visible content,
  so identity-only profiles retain equal top and bottom dialog insets.
  A fuller profile with badges is deferred; the
  owner's future direction is basic identity for everyone and richer social
  details for friends. This simplification preserves existing data visibility.
- Web typecheck, lint (21 existing warnings), production build, a changed-file
  React Doctor scan, backend typecheck, and 21 focused backend tests pass.
  Compiled browser checks cover 320px touch targets, 390px and desktop layouts,
  profile dialogs, save/restore, comment creation/removal, and centered empties.
  Review captures are in `/tmp/ia-announcement-layout-review/`. The owner
  authorized the final profile simplification and PR merge on October 18;
  native iPhone verification was not run.
- Only the existing isolated demo backend on localhost:3210 was updated. It
  retains the same database and accounts. No shared or production deployment
  was selected or changed.

### UI integration and React Doctor (2026-10-17)

- The settings hierarchy now indexes channels and units by parent once rather
  than repeatedly scanning both collections for each branch. All three existing
  hierarchy regressions and web typecheck pass; pinned React Doctor 0.9.8 reports
  no new issues on #155. Clubs and feedback also have no new findings.
- Announcement filters compile selection sets once per filter/search change and
  share the predicate across current and past posts. Timestamps hydrate from
  deterministic dates before showing local relative labels; expiry transitions
  are scheduled after mount with capped browser timer delays. Seventeen focused
  tests, web typecheck, and lint pass (21 existing warnings). The pinned scan has
  no new announcement findings; suppressions were not added.
- Full CI and security checks remain the merge gate. Production release and
  deployment are separate operations; this integration does not authorize them.
- The combined local suite passes all 385 backend tests, shared-package tests,
  mobile typecheck, web typecheck, and 17 focused announcement tests. The final
  combined PR scan reports no new React Doctor issues.

### Merge backlog reconciliation (2026-10-15)

- PR #151 is closed as superseded: its trial merge produced exactly the current
  main tree. PR #121 is also closed: its complete patch is equivalent to commit
  `4841d245`, already incorporated in main and retained by the Bun migration.
- Local announcement-pagination and UI-follow-up worktrees correspond to
  already-merged PRs #125 and #128; their older source must not replace newer
  main behavior.
- PR #110 retains the current Convex 1.46.0 environment types, presence
  component, Google Vision configuration, Bun commands, and current feedback
  permissions. Thirteen focused tests cover status mapping, signed/forged webhooks,
  repository isolation, duplicate/stale events, and anonymous/student retry
  refusal, plus mocked issue creation/failure without exporting submitter identity.
  All 373 backend tests, backend/web typechecks, web lint (21 existing
  warnings), brand/devlog checks, production web build, and an isolated local
  Convex push pass. GitHub webhook activation and production deployment remain
  separate operations; neither was performed.
- Merged security prerequisite PR #153 source-patches `braces@3.0.3` after its newly
  reported nesting vulnerability blocked the merge gate. Nine audit/dependency
  regression tests and the GitHub security scan pass. The advisory-specific
  patched-version exception expires on 2026-11-01; replace the patch and remove
  the exception when a fixed release or replacement is available.
- PR #147 implements the design owner's approved direction: height-balanced
  fresh defaults, stable manual placement, and a quiet **Balance layout** action
  with Undo. Optional desktop column positions persist alongside the mobile
  reading order; legacy layouts retain their existing split. Pointer and keyboard
  moves support empty columns and Escape cancellation. Done awaits a successful
  save. The previous automatic packing could erase a visible drag; it no longer
  runs after manual changes.
- Dashboard verification: all 379 backend tests and five column-layout regressions,
  backend/web typechecks, web lint (21 existing warnings), production web build,
  and an isolated local Convex push pass. Browser checks cover manual cross-column
  placement, balancing/Undo, keyboard ordering/empty-column drops/cancellation,
  Save/reload, live desktop/390px reflow, light/custom dark themes, and reduced
  motion. Native touch dragging still needs device review. The owner authorized
  squash-merging #147 after visual review; it landed as `55b615e1` with passing CI.
- The owner requested follow-up toast/profile geometry repairs: an icon-only Undo,
  a visible centered close control without a reserved empty strip, shared profile
  card corners, equal side/bottom navigation insets, and circular profile avatars.
  These corrections are separate from merged #147 and await a fresh visual review.
  Web typecheck, lint (21 existing warnings), and production build pass. Compiled
  browser checks confirm centered 32px toast controls, keyboard Undo and dismissal,
  equal 9px profile navigation insets on desktop/390px, and circular avatars in
  the sidebar/editor. Review captures are in `/tmp/ia-ui-geometry-review/`.
- Notification settings now share `NotificationSettingsPanel` on `/notifications`
  and `/profile`: redundant subtitles are removed, counts sit inline,
  channel-count/chevron disclosure remains separate from switches, required locks do not reserve
  an empty trailing slot, and channel rows follow the workspace unit hierarchy
  with tree connectors. Owner feedback restored the rounded inner option group,
  compact rows, quiet separators, and distinct club surfaces, without an outer
  panel frame. Static groups use a single border without an elevation outline
  stacked on it. Design guidance distinguishes useful grouping from redundant
  chrome. Scoped switches reflect global inheritance and report failed saves.
  The owner's interaction principles are captured in `.impeccable.md`.
  Three hierarchy regressions, web typecheck/lint (21 existing warnings), and
  production build pass. Compiled browser checks cover route parity, preference
  persistence/inheritance, parent disabling, keyboard disclosure/switches,
  aligned right edges, 390px/touch layouts, reduced motion, and light/custom
  themes. Demo clubs are flat; nested placement is covered by focused tests.
  Captures are in `/tmp/ia-notification-settings-review/`. Material visual changes
  await design-owner review; #154 remains open with passing CI.
- Profile tab panels no longer use the local `SettingsCard` wrapper, whose
  full-strength frame/header border differed from notification settings. Repeated
  panel titles/subtitles and the identity divider are removed; account details
  use a definition list with wrapping values. Useful inner groups remain. The
  document owns a persistent vertical scrollbar track and stable gutter to avoid
  a measured 4px shift when taller panels introduce the 8px scrollbar. Compiled
  checks confirm identical desktop anchors across short/long tabs, all five
  panels within 390px, and password form open/cancel. Combined channel-count
  disclosure works by text click and Enter with a 44px touch target. Group
  borders compute to 1px with no shadow; all switches share one right edge.
- Profile typography now uses readable secondary labels without all-caps
  tracking or unnecessary monospace. Release titles appear once and wrap;
  scope labels stack above changes on narrow screens. The custom theme editor
  composes the shared Fluid Tabs adapter with named panels and arrow/Home/End
  keyboard navigation, replacing manually implemented tabs. Web typecheck,
  lint (21 existing warnings), production build, and 390px keyboard/touch checks
  pass. These additions remain in #155 awaiting owner visual review.
- The owner authorized parallel feedback, clubs landing, and announcements
  passes in isolated worktrees, stacked on #155. Clubs PR #156 removes the
  conflicting outer frame around the approved CardGroup and aligns Discover
  to the same width; typecheck/lint/build and desktop/390px interaction checks
  pass. Preview: `http://localhost:3002/clubs`.
- Feedback PR #157 simplifies `/report`, distinguishes GENERAL feedback from
  moderation notifications (including source-linked legacy inbox records), and
  preserves existing moderation opt-outs until Feedback is configured. All 383
  backend tests, backend/web/mobile typechecks, web lint, and production build
  pass. Independent source review found no blocking compatibility/permission
  issue. Browser checks cover desktop/390px, light/dark, attachment add/remove,
  and keyboard behavior; populated history is not browser-verified. Preview:
  `http://localhost:3001/report`. New backend code is not on the local watcher.
- Announcements PR #158 simplifies metadata/action layout, exposes common
  filters, and applies the same matcher to current/past records. Its narrow
  backend guard excludes non-expiring ACTIVE posts from the recent-expiration
  stream. All 379 backend tests, backend/web typechecks, web lint, production
  build, and three web filter tests pass. The registered Past-query test covers
  expiry boundaries but does not reproduce the old engine bug: convex-test's
  comparator differs from documented Convex missing-value ordering. No backend
  push occurred. Compiled desktop/390px checks, read/save restoration, Saved
  filtering, empty search recovery, and independent comments navigation pass.
  Preview: `http://localhost:3003/announcements`; captures are in
  `/tmp/ia-announcements-review/`. The root agent finished QA/PR creation after
  the announcements subagent exhausted its usage allowance.
- All new material visuals remain awaiting design-owner review. Agent QA does
  not authorize merging them or deploying to a shared/production backend.
- The `merge-pr147` worktree serves the compiled dashboard at
  `http://localhost:3000/dashboard` with its isolated local-anonymous Convex backend
  on ports 3210/3211 and development demo fixtures. The primary dataset is untouched.
  Before/after Balance captures and a phone capture are in
  `/tmp/ia-dashboard-review/` for local review.
- Draft PR #152 still explicitly awaits human visual review. PR #117 has
  unresolved conflicts. Compliance PR #76 remains outside this merge pass.

### Announcement feed and dashboard preview (2026-10-17)

- PR #158 (`feat/announcements-feed-clarity`) is stacked on #155 and remains
  awaiting design-owner visual review. The owner approved an independent shared
  Card attention state. Card owns its neutral translucent unread surface and
  matching focus/hover corners; selection retains its own semantics.
  On October 17 the owner also approved `CardGroup corners="compact"` (12px).
  Feed/past/widget cards use it without changing global button shapes. Neutral
  Badge now composes the shared active fill and border on attention surfaces.
- Concrete grade/pathway/club audiences share one model across feed, dashboard,
  club preview, and detail. Legacy scalar/array targets are merged; intersection
  conditions preserve their AND/OR meaning in accessible text. Numeric grade
  badges have a graduation-cap context. Missing targeting no longer becomes an
  invented School-wide label. Serialized `commentCount` replaces the obsolete
  relation-count field that always displayed zero.
- The full feed groups Pinned for you, Important, and Latest. Important describes
  publisher priority, distinct from personal pins and Saved. Reading preserves
  ordering in All; pin/unpin restores focus to the moved post's More trigger.
  Per-card Unread pills are removed. Feed/past cards retain quiet outlines in
  both states, while unread attention and title weight provide emphasis without
  removing a read post's boundary. Saved uses the existing outlined active Button
  plus a filled primary icon, distinct from transient hover.
- Desktop feed choices, search, Filters, and the plus action occupy one toolbar row. Narrow
  screens deliberately use two rows. Headings have a separate gap before cards.
  The 24rem filter panel keeps Read/Saved/Audience compact Select controls visible;
  independent accordions summarize and disclose grade/pathway/club checkbox facets
  within a bounded ScrollArea. Read actions are icon-only with working tooltips.
  Full-feed author avatars reuse the existing person dialog; its projection adds
  photo and roles without adding sign-in identifiers or contact fields. Club
  people use the same extracted avatar component.
  Zero-comment actions use an icon so all four 44px controls fit together at
  320px. The dashboard title is Unread Announcements; its empty state composes
  the shared unframed Empty inside the existing widget boundary.
- Shared defects are repaired at their owners: RadioGroup resolves both pointer
  coordinates for wrapped rows; nested popup portals share the overlay layer;
  Select and Dropdown share fixed 12px/8px/10px shell/item/focus geometry. The
  trigger retains global shape. Fixed values avoid the app's `rounded-lg` token
  resolving to 16px instead of the registry's expected 8px.
  A stable-gutter root now suppresses react-remove-scroll-bar's duplicate body
  margin while preserving modal scroll lock. Read/Saved, composer, and profile
  photo dialogs retain their document geometry. Clickable Card footer metadata
  passes through to the stretched target with a pointer cursor; semantic controls
  stay independent. Panel titles flex within the action row rather than forcing
  the arrow below a long heading. Widget heading/card text align at a 24px inset,
  with a separate gap above the first card.
- Default Light/Dark borders/dividers now follow the scoped surface foreground.
  Explicit Custom Accent, Bubblegum, and opaque high-contrast border palettes
  are preserved. Their contrast was not retuned; `border-input` is unchanged.
- Fifteen focused audience/filter/hover-geometry tests, web typecheck, lint
  (21 existing warnings), and production build pass. Browser checks cover
  combined Read/Saved filters, nested menu visibility/Escape/focus return,
  composer targeting, wrapped radio hit testing, 320px/390px action geometry,
  section rhythm, saved vs hover, and Light/Dark/Contrast/Custom token behavior.
  Read toggling retains the tested card's 176px height and document position.
  The owner currently has Robotics and Freshman Grade 9 unread, with Robotics
  saved; other demo posts are read. Temporary QA toggles were restored to that
  state. The populated and empty widget were checked at
  390px. Earlier pin/order, audience, custom-theme, and reduced-motion checks
  remain applicable; attention is static and existing proximity motion is unchanged.
- The compiled preview runs at `http://localhost:3003/announcements` and
  `/dashboard`, sharing the existing isolated demo backend on 3210/3211.
  October 17's functions were pushed explicitly to that existing isolated local
  backend, without reseeding or selecting a shared/cloud deployment. The author
  projection is verified in the browser. Backend tests (381), backend/web/mobile
  typechecks, web lint, the 15 focused tests, and production build pass. This does
  not certify the expiry guard's time boundary through browser QA. Creation, archive, approval, and
  deletion were not exercised. Current captures are in
  `/tmp/ia-announcement-oct17-review/`; earlier captures remain in
  `/tmp/ia-announcement-interaction-review/` and
  `/tmp/ia-announcement-redesign-review/`.
- The dashboard's existing calendar independently overflows at 320px because its
  seven 44px day targets exceed the available width. It remains a separate
  primitive issue, outside this announcement change.

### Local Bun/Nix setup (2026-10-02)

- Nix/direnv supplies Bun 1.4.2, matching `packageManager` and CI, alongside
  Node 24.14.0. The Bun assets use verified release digests; changing
  `package.json` invalidates the direnv shell cache. CocoaPods is macOS-only.
- The native Apple Silicon shell builds and loads; both Darwin and Linux
  architectures evaluate. Frozen install leaves the lockfile unchanged.
  The dependency/audit regression tests and web typecheck, lint, and build
  pass with Bun 1.4.2. Existing lint warnings remain.
- PR #149 is merged and contains this setup independently of the admin and
  swipe changes.

### Mobile sidebar gesture (2026-10-02)

- The shared app-shell gesture owner uses a scoped native non-passive
  `touchmove` listener. A rightward movement is cancelled before the sidebar
  reveal, so React's passive delegated listener no longer controls the swipe.
- Vertical/left gestures, excluded controls, and multi-touch keep their
  browser behavior. Interrupted or browser-owned gestures cancel the reveal;
  ownership continues until release when a gesture reverses or opens early.
- Twelve gesture regression tests pass. The built mobile page has the native
  listener wired correctly and its explicit sidebar control still works.
  Native iPhone/PWA Back-gesture verification remains pending because this
  browser cannot reliably automate touch input. The user authorized merging
  despite that outstanding device check, and PR #150 is merged.

### Bun stack refresh (2026-10-02)

- PR #100 is merged and retains the newer worktree bootstrap, LAN dev
  orchestration, deploy marker, and Convex 1.46.0 from main while moving installs
  and scripts to Bun.
- PR #111 is merged after #100. It adopts native Convex schema document helpers
  and generated environment bindings without downgrading Convex 1.46.0 or
  removing newer schema fields and performance changes.
- Security dependencies are refreshed, including Next 16.3.8 and image-size
  2.0.4. node-forge 1.4.0 carries the upstream nested DigestAlgorithm validation
  patch until a patched release exists; CI tests reproduce and reject the bug.
- The primary local backend has older whiteboard documents incompatible with
  the current schema. Use an isolated backend for verification; do not reset
  the primary dataset.

### Admin mobile layout (2026-10-02)

- The admin title uses the existing app-header slot, including the loading
  state. Admin tabs and user records use separate horizontal ScrollAreas;
  the page stays within the viewport width.
- User filters and bulk-selection controls wrap. Pagination stays in the
  existing table-panel footer, outside the scrolling records. Names, pathways,
  and role metadata wrap, and touch action columns reserve space for 44px
  buttons. Empty results use the existing AdminNotice outside the wide table.
- Browser verification uses synthetic accounts on the isolated anonymous
  backend in the attached `merge-100-111` worktree. The primary dataset was not
  reset. Phone, tablet, desktop, paging, search, selection, and empty-result
  checks are diagnostic. The user subsequently authorized merging the
  combined local branch, including this admin layout repair.

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
  `bun run sync:convex-env -- --host <LAN IPv4>` while server calls stay on
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
  Custom wallpaper uploads sample up to three distinct image colors on the
  client; the chosen raised-surface tint and candidate colors persist on the
  user's account, with a neutral fallback for older unsampled wallpapers.
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
  sync via `bun run sync:convex-env -- --android`.
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

- Chat read receipts: shared read-boundary selection excludes optimistic
  message IDs, preventing `markRead` argument validation failures on both
  clients. Saved reply boundaries still advance receipts.
- Issue #126 GIF support on `codex/chat-gif-support`: uploaded GIFs and pasted
  GIPHY/Tenor links (previews load only from their media CDNs) autoplay, with a compact corner play/pause control on
  web and mobile. The approved picker now searches a fixed catalog of nine
  existing online Tenor reaction GIFs; it contains no generated media or open
  provider search. Selection appends a media link to the draft. Open GIF controls
  are removed. Web and mobile TypeScript, lint
  (existing warnings), production build, and focused upload/access/deletion and
  mobile attachment tests pass. Isolated web component QA verified still
  previews, playback, keyboard pause, and unavailable media; its temporary route
  was removed. Signed-in local send, Tenor resolution, playback, and keyboard
  pause now pass at localhost:3000; the isolated backend runs on 3210/3211.
  Tenor viewer URLs normalize to direct media, and the PWA worker leaves external
  images to the browser. React Doctor 0.9.8 reports no new findings. Delete QA
  remains pending.
  A clean frozen install with pinned bun run 10.29.3 repaired the stale mobile
  Convex version; mobile TypeScript now passes. All catalog media loaded during
  a temporary content review, and that temporary page was removed. Picker flow
  QA resumed after the user reopened localhost: library display, search, selection,
  and preserving existing draft text pass. Reduced-motion users start paused;
  normal playback is automatic. Filename/status chrome and previewed URL text are
  removed. Copy GIF URL lives in each message's own context menu (web) and actions
  sheet (mobile), so GIFs never open a second menu; web clipboard QA passes. Appearance includes a persisted browser/device autoplay preference;
  web persistence and immediate updates across open chats pass. The regression
  suites pass 20 tests, and React Doctor has no new findings. Mobile-width playback
  controls pass; native device, theme, and reduced-motion visual review remain
  pending. Only the isolated local
  deployment was updated; shared and production deployments were not changed.
  Convex runtime follow-up: shared read-boundary selection excludes optimistic
  message IDs, preventing `markRead` argument validation failures on both clients.
  Saved reply boundaries still advance receipts. Local sending no longer logs the
  error; backend typecheck passes. A repeated esbuild warning refers to the parent
  `../tsconfig.json` outside this repo extending unavailable Astro configuration;
  no backend function compilation failure is associated with it.

- Custom-theme surface follow-up: card and popup foreground scopes are now
  consistent across schedule, notification, shell, club, admin, and shared UI
  surfaces. Web TypeScript, lint, production build, focused surface/palette
  assertions, and `git diff --check` pass. Lint reports 21 existing warnings;
  signed-in visual review remains pending.
- `direnv exec . bun run --cwd apps/web tsc --noEmit` - pass after the web UI
  primitive workflow and remediation slices.
- Web calendar replacement: `bun run --cwd apps/web tsc --noEmit`, web lint,
  frozen offline install, production build, and `git diff --check` pass. Lint
  reports only existing warnings outside the calendar slice; signed-in visual
  review is still required for responsive calendar states.
- `direnv exec . bun run --filter web lint` - pass with 7 existing unrelated
  unused-import warnings.
- `direnv exec . bun run --filter web build` - pass through compilation,
  TypeScript, page data, all 18 static pages, and route optimization.
- `bun run --filter mobile typecheck` - pass
- `bun run lint` - pass with 7 existing web warnings outside this slice
- `bun run --filter cvx codegen` - pass
- `bun run --filter cvx typecheck` - pass
- `bun run --filter cvx test` - pass (14 files, 47 tests)
- `bun run --cwd apps/mobile tsc --noEmit` - pass after removing the deprecated
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
- `bun run --filter mobile test:maestro` - not run locally; requires Maestro plus
  a built simulator/device app and seeded credentials.
- `bun run lint` - pass; web reports 8 pre-existing unused-import warnings and no
  errors
- Focused optimistic chat tests - pass (2 tests after moving the helper to
  `apps/shared/chat`)
- `bun run build` - pass across design tokens, fun facts, Convex, mobile, and web
- `bun run --cwd apps/web tsc --noEmit` and `bun run --filter web build` - pass
  after the compact club-workspace redesign and channel interaction polish;
  signed-in visual QA remains to be run because no browser-control session was
  available.
- `bun run test` - pass (`cvx` Vitest, 14 files, 47 tests)
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
bun run --filter cvx codegen
bun run --filter cvx typecheck
bun run lint
bun run build
bun run test
```
