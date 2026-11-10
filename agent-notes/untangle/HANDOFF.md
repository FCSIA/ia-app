# Untangle refactor — handoff

Status as of 2026-11-09. Read this whole file before touching the branches.

Open PR: <https://github.com/FCSIA/ia-app/pull/228> (`refactor/untangle` →
`main`).

**Start here:** step 0 under "Remaining work", then the deploy-safety list.

## What this is

A whole-codebase structural refactor following the `untangle-codebase` skill
(<https://github.com/caldoai/skills/blob/main/skills/untangle-codebase/SKILL.md>).
The question asked of every pair of pieces: **should these change together?**
Fix hidden links (copies, implicit conventions), needless links (callers on
internals, wrong dependency direction), surplus (wrappers, dead code) and
special cases. The owner chose both optional extras: remove comments that only
restate code, and remove/rewrite tests that can't catch a real bug.

Hard constraint: **behaviour stays identical**, except for the bug fixes listed
below. Anything that would change behaviour goes on the "Owner decisions" list
instead of into code.

## Branches

| Branch | State | What it holds |
| --- | --- | --- |
| `refactor/untangle` | Green locally; CI red for a reason outside this PR (see "CI"). PR #228. | 7 refactor commits (the last is this handoff) plus a merge of `origin/main` at `f22b4c42`. |
| `refactor/untangle-round3-wip` | **Does not typecheck. Tests never run.** Pushed, no PR. Not updated with `main`. | One snapshot commit (`09080d17`) on top of `36f2e105` with all round-3 edits, including the unfinished Convex and web ones. |

Never commit to `main`. Other agents switch branches in the primary checkout
(`/Users/sreysus/workflow/ia-app`), so work in your own worktree:

```sh
git fetch origin
git worktree add .worktrees/untangle origin/refactor/untangle -B refactor/untangle   # or reuse the existing one
cd .worktrees/untangle
direnv allow . && direnv exec . bun run worktree:bootstrap -- --no-convex
```

## Commits on `refactor/untangle`

1. `test: run every web, mobile and shared test from its own workspace` —
   web, mobile, shared and design-tokens each own a `vitest.config.mts`; the
   three hand-listed root configs are gone. Before this, 27 of web's 37 test
   files never ran. `apps/shared` is now a workspace (`@ia/shared`) with its
   own typecheck; the vision-OCR integration test moved to web so shared no
   longer imports web.
2. `shared: own the domain rules every app used to re-type` — `apps/shared`
   now owns roles (`roles.ts`), labels, school time (`school-time.ts`,
   `wrapped-window.ts`), chat protocol (`chat/protocol.ts`, `attachments.ts`,
   `whiteboard-limits.ts`), limits (`limits.ts`), notifications
   (`notifications.ts`), routes/hrefs (`routes.ts`), dashboard layout,
   onboarding steps, audit/feedback vocabularies. Colour math lives in
   `packages/design-tokens/src/color.ts`. Convex enforces, web and mobile
   import.
3. `cvx: give each backend rule one owner` — channel gate
   (`clubs/channelGate.ts`), channel policy (`clubs/channelPolicy.ts`),
   membership (`clubs/membership.ts`, three separately named "leader"
   predicates), message serialization, `summaries.ts`, push transport
   (`notifications/_pushTransport.ts`), staged images
   (`uploads/_stagedImage.ts`), CSV runner (`users/_csvRows.ts`),
   `applyRoleChange`/`writeUserNames`, `events/_publish.ts`,
   `schedule/_friends.ts`, `flexFriday/_credits.ts`, schema-derived
   validators, dead public functions/indexes removed, shared test helpers
   (`apps/convex/test/auth.ts`, `apps/convex/test/fixtures.ts`).
4. `web: colocate features with their routes and drive shell state from tables`
   — channel feature under `app/clubs/[clubId]/channels/_components/`,
   `channel-workspace.tsx` split (3.5k → ~1k lines), composer in
   `components/chat/`, `lib/routes.ts` route table, `app/admin/_lib/admin-sections.ts`,
   `lib/csv.ts`, `lib/browser-storage.ts`, typed Flex Friday forms.
5. `mobile: derive chat and dashboard data from the server's types` — chat and
   dashboard types from `FunctionReturnType`, `src/lib/tab-queries.ts` shared
   by screens and prewarm, one dashboard widget pipeline.
6. `mobile: restore behaviour the refactor changed and share event limits` —
   reverts five behaviour changes from commit 5 and finishes the mobile/shared
   part of round 3.
7. `agents: hand off the untangle refactor` — this file.
8. Merge of `origin/main` (`f22b4c42`, 2026-11-09). Main's two new commits
   (event sponsor approvals, GitHub feedback push recovery) conflicted in 3
   files. Resolutions: `events/approvals.ts` `settlePendingEvent` clears moot
   approvals, then publishes through the shared `events/_publish.ts` (main's
   duplicate local `publishEvent` deleted; same writes, same notification);
   `moderation/feedbackGithub.ts` keeps main's `restartStalledGithubIssuePushes`
   cron and uses `REPORT_HREF` in main's new `applyGithubStatus`; web
   `feedback-tab.tsx` keeps both import sets. Every check in "Verification"
   passed after the merge (cvx 563 tests).

### Bug fixes included (intentional behaviour changes)

- **Security:** global search (`apps/convex/src/search/global.ts`) checks
  channels with `getChannelAccessForChannels` instead of the dead
  visibility-only model. Restricted channel names no longer show to everyone;
  members can find channels they reach through a role or unit.
- Mobile student dashboard: Today and Welcome widgets read a `mySchedule`
  field the server never returns, so they always showed the empty state. They
  now use `hasPersonalSchedule`.
- Prewarm: web calendar prewarm uses the page's own `calendarListArgs`; mobile
  dashboard prewarm now includes pinned announcements and the school day.
  Prewarms of paginated queries (web `/announcements`, mobile Feed tab) were
  removed because a paginated subscription can never be shared.
- Flex Friday `AuditView` uses `apps/shared/audit` labels instead of a stale
  table with action names Convex never emits.

### Known small behaviour differences shipped (reviewed, accepted as low risk)

- Web invite/club/unit CSV parsers now honour escaped quotes and multi-line
  fields, and throw (caught and toasted) on malformed quoting.
- Feedback/moderation search filters also match full name (`filterBySearchQuery`).
- Flex pass page waits for `users.me` (localStorage user cache removed).
- gif-autoplay preference resets to "on" when storage is blocked.
- Command palette ids renamed: `route-dashboard` → `route-home`,
  `route-flex` → `route-flex-friday` (not persisted anywhere).
- `clubs.channels.postMessage` checks client-id length before the channel
  lookup (error precedence only).
- Hierarchy-created channels store `accessRoleIds: []` (reads the same as unset).
- Mobile offline cache key for the student schedule renamed to
  `dashboard-school-day` (old cached shape would crash the new code).
- `weekdayForDateKey` returns `null` for malformed keys; `schedule/dayPlans.ts`
  normalizes first so it still throws as before.

## CI

PR #228's `Security audit` job fails, which fails `CI Gate`. **This is not
caused by the refactor:** `main` fails the same way. `osv-scanner.toml`
ignores `GHSA-g3hv-75wg-m249` (minimatch) and `GHSA-3g3m-2fjr-6pw4` (glob)
only until 2026-11-06, and `scripts/dependency-security.test.mjs` pins that
date. The exceptions' owner (rebanto, per `osv-scanner.toml` and
`docs/reference/security-exceptions-2026-10-30.md`) must re-review and
extend them or remove the vulnerable versions, on `main`. Then update this
branch with `main` and CI should be green. Don't extend the dates from this
branch: that's a security decision, not part of the refactor.

## Before merging (deploy safety)

1. **Regenerate `_generated/api.d.ts` against a real deployment.** It was
   hand-edited because `convex codegen` needs one. Run `npx convex dev --once`
   (local/dev deployment) in `apps/convex` and confirm `git diff` on
   `apps/convex/src/_generated` is empty or only cosmetic.
2. **Removed public Convex functions** (no client call in git history for
   60+ days; last client use in parentheses): `clubs.channels.getMessages`
   (2026-07-14), `clubs.management.getOne`, `clubs.management.bulkSetMemberRoles`,
   `clubs.management.updateRolePermissions` (2026-08-12),
   `clubs.hierarchy.bulkSetMembers` (2026-08-16), `clubs.invitations.revokeJoinCode`,
   `users.impersonation.prepare` (2026-08-15). `clubs.channels.list` was
   kept (client use 2026-10-17). Confirm no installed mobile build older than
   July still matters.
3. **Removed schema indexes** (no `withIndex` users): `clubChannelMessages.by_authorId_and_channelId_and_createdAt`,
   `clubInvites.by_recipientId_and_status`, `clubJoinRequests.{by_clubId_and_requesterId, by_clubId_and_status_and_requesterId, by_requesterId_and_status}`,
   `clubMembers.by_clubId_and_role`, `clubPeopleGroupRules.by_groupId_and_kind`,
   `clubTagMembers.by_tagId_and_userId`, `clubUnitMembers.by_unitId_and_role`,
   `clubUnits.by_parentUnitId_and_position`.
4. **Schema validation tightened:** `wrappedSnapshots.summary` went from
   `v.any()` to `wrappedSummaryValidator`. All 175 prod rows were checked
   read-only on 2026-11-06 and pass. If snapshots were generated since,
   re-check: export with `npx convex data wrappedSnapshots --prod --limit 8000
   --format jsonl` (from a checkout with prod access; it's approved
   read-only) and validate each `summary` against
   `apps/convex/src/wrapped/_lib.ts#wrappedSummaryValidator`; delete the export
   afterwards. Every other table's document validator was diffed against
   `origin/main` and is identical (`externalCalendarSubscriptions.provider` is
   a one-member union of the same literal).
5. **Bundle check** (Convex's bundler does not resolve `~/` aliases, and
   `"use node"` must be line 1):
   ```sh
   cd apps/convex
   rg --files src -g '*.ts' -g '!*.test.ts' -g '!_generated/**' -g '!*.d.ts' \
     | xargs ../../node_modules/.bin/esbuild --bundle --outdir=/tmp/esb \
         --platform=node --format=esm --packages=external --log-level=error
   rg -l "from ['\"]~/" /tmp/esb          # must print nothing
   for f in $(rg -l '^"use node"' src); do head -1 "$f" | grep -q '"use node"' || echo "bad: $f"; done
   ```
6. Human visual review of web (AGENTS.md: agent visual review is not design
   approval) — the channel workspace split, admin sections and shell
   navigation are the riskiest screens. Physical-device check of mobile
   dashboard and chat.

## Verification (run all; all must pass)

```sh
direnv exec . bun run --filter @ia/shared typecheck
direnv exec . bun run --filter @ia/design-tokens lint
direnv exec . bun run --filter cvx typecheck
direnv exec . bun run --filter web typecheck
direnv exec . bun run --filter web lint
direnv exec . bun run --filter mobile typecheck
direnv exec . bun run test            # every workspace incl. ~4 min of Convex tests
direnv exec . bun run --filter web build
```

Baseline on `origin/main` (2026-11-05): cvx 585 tests, mobile 56, and only
10 web test files ran. On `refactor/untangle` (3edcc34c): cvx 551 (tests of
deleted code removed; chat-unread tests moved to shared), web 259 + 8 skipped,
mobile 53, shared 69, design-tokens 11, devlog 11, fun-facts 11.

## Rules for anyone (human or agent) continuing

- Work only in your own worktree; never `git stash`/`reset`/`clean` in a
  shared one. Commit coherent slices with `subsystem: concise change`
  subjects. Internal commits carry `Devlog: skip`; student-visible fixes carry
  `Devlog:` / `Devlog-category:` / `Devlog-scope:` trailers
  (`docs/reference/versioning.md`).
- Behaviour identical. If unifying two copies would change behaviour, keep
  both as separately named values in one place and add the difference to
  "Owner decisions".
- No visual changes; don't restructure `apps/web/src/components/ui` or
  `components/reui` (vendored). Read `.impeccable.md` and
  `agent-notes/WEB_UI_WORKFLOW.md` before web UI work.
- Convex: read `apps/convex/AGENTS.md` and
  `apps/convex/src/_generated/ai/guidelines.md`. Never deploy or touch a
  shared deployment.
- `apps/shared` stays pure: no imports of Convex server code, web or mobile
  (type-only `_generated/dataModel`/`api` is fine). Convex imports shared by
  relative path; web/mobile via `~/apps/shared/...`.
- No compatibility re-export shims: update every importer, delete what is
  unused (verify with `rg`).
- When adding/removing a Convex module without a deployment, keep
  `_generated/api.d.ts` in sync by hand: one
  `import type * as <path with / → _> from "../<path>.js";` line and one
  `"<path>": typeof <ident>;` entry, both sorted; slash-free keys unquoted.
- `git checkout <branch> -- <dir>` does **not** delete files the other branch
  removed. After such a checkout run
  `git diff --name-status --diff-filter=D HEAD <branch> -- <dir>` and `git rm`
  the listed files.

## Remaining work, in order

### 0. Keep the branch current with `main`

`main` keeps moving. Before any other step, and again right before merging:

```sh
git fetch origin
git merge-tree --write-tree --name-only HEAD origin/main   # preview conflicts
git merge origin/main
```

Prefer merging over rebasing: the branch is pushed and has a PR. When
resolving a conflict, keep main's behaviour change and express it through
this branch's owners (shared helpers, `apps/shared` constants, route
builders). Don't bring back a copy the refactor removed. After every merge:

- run the full "Verification" list;
- re-diff `apps/convex/src/schema.ts` against `origin/main`. The only index
  removals may be the 10 listed under "Before merging". Re-run
  `rg '"<index name>"' apps/convex/src` for each one, because main may have
  started using one. Any new document field from main must survive;
- check that main didn't add hand-built hrefs, role arrays or labels that
  the shared modules now own;
- check whether main added or removed Convex modules, and update
  `_generated/api.d.ts` to match (see "Rules").

If the worktree has no `node_modules` (bootstrap again with
`bun install`), tooling falls back to the **primary checkout's**
`node_modules` because the worktree is nested inside it. Then typecheck and
tests run against another branch's packages and fail in confusing ways
(e.g. `blackOrWhiteOn is not a function`). Check `ls node_modules/@ia`
first.

### 1. Finish round 3 from `refactor/untangle-round3-wip`

The snapshot holds unfinished Convex and web edits (mobile/shared from it are
already on `refactor/untangle`). It predates the `main` merge, so it will
conflict where main changed files (at least `events/approvals.ts`,
`moderation/feedbackGithub.ts` and `users/admin.ts`). Bring it over in a
worktree on `refactor/untangle`, **file by file rather than wholesale** for
any file that `git diff 36f2e105 HEAD --name-only` also lists. Otherwise
the checkout silently reverts main's changes and this branch's later fixes:

```sh
git checkout origin/refactor/untangle-round3-wip -- apps/convex apps/web
git diff --name-status --diff-filter=D HEAD origin/refactor/untangle-round3-wip -- apps/convex apps/web   # git rm each
```

Known errors in the snapshot (fix these first). This list comes from the
last typecheck before work stopped. The snapshot's tests were **never run**,
so run the full "Verification" list before trusting it; expect more:

- `apps/convex/src/clubs/clubStructureWrites.test.ts` lines 45, 59, 112, 131,
  150, 162: the test inserts/reads through the wrong table type (reads
  `channelCount` off a `notificationPushSubscriptions` doc; passes
  `Id<"clubs">` where `never` is inferred). Rewrite with
  `apps/convex/test/fixtures.ts` helpers and typed `ctx.db` calls.
- `apps/convex/src/uploads/finalizeStagedImage.test.ts:27`: passes an
  `Id<"_storage">` where a table id is expected; use
  `ctx.storage.store(new Blob(...))` and pass the storage id to the right arg.
- `apps/web/src/app/clubs/[clubId]/channels/channel-workspace.tsx:98` and
  `apps/web/src/app/clubs/[clubId]/people/page.tsx:35`: import `useFriendship`,
  which `components/users/use-friendship.ts` no longer exports (mid-rename to
  "profile dialog owns friend requests"). Finish the move: the
  `user-profile-dialog` calls the friendship hook itself; callers stop passing
  the five friendship props.
- `apps/web/src/app/clubs/[clubId]/people/page.tsx:1526`: props passed to the
  profile dialog no longer match its type (same refactor).
- `apps/web/src/app/clubs/[clubId]/channels/_components/channel-details-sheet.tsx:189`:
  `preferredName` optional vs required — align with the server type
  (`ClubMentionContext["members"][number]`), don't cast.

What the snapshot was doing (finish, then verify each item keeps behaviour):

**Convex**
- Use shared `canManageUser` / `canGrantRole` / `canResetUserPassword` in
  `users/admin.ts` and `users/_lib.ts` instead of the inline copies
  (byte-identical rules; `users/admin.test.ts` added).
- `events/events.ts`: local `isAdmin` actually means the event-manager set —
  replace with the named set from `apps/shared/roles.ts`.
- School-year start re-derived in `wrapped/snapshots.ts` and
  `schedule/_lib.ts` → `apps/shared/school-time.ts`/`wrapped-window.ts`
  (same output; the server-local `new Date(y,7,1)` bound must stay as it is).
- `notifications/pushNode.ts` imports DB-reading code for two pure exports →
  `notifications/_pushShapes.ts` (added in the snapshot).
- Volunteer proofs (`uploads/volunteerProofs.ts`) bypass
  `uploads/_stagedImage.ts` validation — route through it keeping error
  strings and the idempotent-retry branch.
- `summaries.ts` (`userSummary`, `clubSummary`) still unused at ~8 sites
  that hand-build the same objects; each endpoint must keep its exact fields.
- `lib/currentUser.ts`: `requireAnyRoleSafe` is exported only for
  `clubs/whiteboards.ts`; drop the export once whiteboards uses
  `viewerWithRoles`.
- Tests: direct coverage for `assignRoles`, `runCsvRows`, `createClubRole`,
  `insertClubChannel`, `finalizeStagedImage` (feedback + announcement),
  `channelGate`, `votePoll`, `flexAttendancesInRange` (snapshot adds
  `channelGate.test.ts`, `channelInteractions.test.ts`,
  `clubStructureWrites.test.ts`, `finalizeStagedImage.test.ts`,
  `flexFriday/_credits.test.ts`, `users/admin.test.ts`). Migrate the
  remaining 7 files with hand-rolled `lib/currentUser` mocks and 9 with
  hand-inserted users to `test/auth.ts` / `test/fixtures.ts`. Delete
  `canPermanentlyDeleteClub` tests along with that wrapper (it is
  `isSuperAdmin`). The "normalized reaction" audit test never passes a glyph —
  make it pass one.
- Comments: ~8 restating doc comments remain in convex; delete them.

**Web**
- Route protection fail-closed: every `app/**/page.tsx` is in `lib/routes.ts`
  as public or protected; `isProtectedPathname` treats unknown paths as
  protected; one public list used by both `lib/routes.ts` and `proxy.ts`. Pin
  today's effective protection for every page in a test (compute it once from
  `origin/main`'s `proxy.ts`) and fix the tautological table test in
  `routes.test.ts`; extend `proxy.test.ts` beyond `/` and `/clubs`.
- Hrefs from route builders (`lib/routes.ts`, `apps/shared/routes.ts`):
  `/schedule?tab=friends`, `/events/…`, `/flex-friday`, `workshopDetailHref`,
  hand-built `/clubs/${id}…`. Nav keyed by route id, not href strings.
- Day plans sub-nav defined three times; define once. The shell copy sets
  `isActive: false` unconditionally — keep today's highlighting exactly.
- Named role sets instead of inline `["STUDENT"]` (4 places); one label
  source each for roles, pathways, event status, 12-hour time ranges, image
  types (rendered text unchanged).
- One "is Mac" hook; `ThemeProvider` config once (`app/providers.tsx` and
  `pages/_app.tsx`); Flex `runAction` plumbing finished with a test
  (`flex-friday/_hooks/useFlexActions.test.ts` in the snapshot).
- Clubs: extract `channel-workspace.tsx`'s ~10 conversation state pieces into
  a hook; move the two ~300-line dialogs out of `people/page.tsx`; constants
  for poll option limit (6), "10 MB", "5 files", role-name length (64) and the
  whiteboard cursor `activeSince` window (two files); tests for
  `useChannelSend`'s upload-discard rules; the whiteboard chunking test must
  assert the client limit, not the server one.
- Comments: `channel-workspace.tsx:603-605`, `channel-search.tsx:58` and a
  handful in web-rest files.

Commit Convex and web as separate commits once everything is green.

### 2. Repeat the check loop until nothing worth fixing is left

The skill's step 5. Run fresh read-only reviewers per area (Convex; web clubs;
web rest; mobile + shared + packages) with this brief, then fix what they find
and repeat:

> Read `git diff origin/main..HEAD -- <area>`. (1) Regressions: any runtime
> behaviour change that isn't a listed bug fix — error messages, role sets,
> query args/return shapes, dropped fields, defaults, time zones, storage
> keys, lost side effects (audit logs, notifications, counts), ordering,
> deleted code still used, public Convex API removed while a client calls it,
> schema changes that could reject existing data, `"use node"` placement,
> clients importing Convex server modules. Give file:line, old vs new,
> severity, fix. (2) What's left: remaining special cases, hidden links,
> needless links, surplus, restating comments, tests that can't fail / repeat
> the implementation / test internals — skipping "Owner decisions". Concrete
> file:line + fix.

Done when: special cases are as few as possible, a typical change lands in
one place, nothing imports something more volatile than itself, reviewers
find nothing worth fixing, and the full verification passes.

### 3. Survey files

The original per-area problem lists (~800 items) and round-2 review reports
lived in a temp directory that was cleared, and are lost. The remaining-work list above is
everything still open from them. To regenerate a full list, run the survey
step of the skill per area (Convex clubs, Convex rest, web clubs, web rest,
mobile, cross-app/shared/tests).

## Owner decisions (current behaviour kept; code keeps both variants named)

**Fix first. These are real bugs, not preferences** (each is a separate
small PR with a `Devlog:` trailer, not part of this refactor):

1. Duplicate tag slugs make posting `@slug` throw. `clubs/tags.ts` `create`
   doesn't enforce slug uniqueness within a club.
2. `dashboard/needsYou.ts` links staff to `/admin?tab=reports`, which matches
   no web admin section (`app/admin/_lib/admin-sections.ts`).
   `resolveAdminTab` falls back to Users, so the item opens the Users tab,
   not Reports (section id `moderation`).
3. The 64-character role-name limit isn't applied on the CSV bulk path.

The rest are choices for the owner:

- Role sets that disagree: moderation queue audience (`moderation/reports.ts`
  list vs act vs `dashboard/needsYou.ts`); feedback read vs write/notify;
  "student" with vs without STUDENT_ADMIN (`STUDENT_ROLES` vs
  `STUDENT_GROUP_ROLES` in `apps/shared/roles.ts`); "cancel any event": mobile
  staff (`EVENT_CANCEL_ANY_ROLES`) vs web admin-only
  (`EVENT_CANCEL_ANY_WEB_ROLES`).
- Announcement targeting: `notifications/delivery.ts` and
  `announcements/_lib.ts` disagree on empty GRADE/PATHWAY targets (who is
  notified vs who can read).
- Chat message grouping window: web 7 min vs mobile 5 min (two constants in
  `apps/shared/chat/protocol.ts`).
- Web club Settings page admits channel-only managers but the sidebar link
  doesn't show for them.
- Plain `Error` → `ConvexError` in `clubs/invitations.ts`,
  `clubs/hierarchyRules.ts`, `flexFriday/*` (prod would show real messages
  instead of "Server Error").
- Cascades: deleting a club/channel leaves `clubRoles` and read receipts;
  removing a member leaves unit/channel/tag memberships.
- Two unread definitions (`getMyClubs` vs `getWorkspaceActivity`).
- Mobile dashboard layout uses its own widget ids (`features/dashboard/home-layout.ts`)
  and wipes `columns` on save; web uses `apps/shared/dashboard-layout.ts`.
- 24-hour setting is ignored in schedule tables; "current class" uses the
  device clock, not school time.
- Per-user browser/mobile storage survives sign-out.
- Calendar entry link precedence: `calendarDetailHref` vs `calendarWidgetHref`
  (`components/calendar/calendar-links.ts`).
- Palettes: `destructive-foreground` differs web vs mobile; mobile
  `readableForeground` uses a 0.58 brightness cutoff vs web's WCAG rule;
  mobile accepts 3-digit hex.
- Joining a club through open join / join code / request approval doesn't
  clear stale invites.
- Convex site URL precedence differs between web call sites.
- Legacy backfill fallbacks (comment counts, session counts, club counts,
  course metadata, `roleGroupCountsReady`, preference `enabled`,
  `events.isInactive`, audit `listPage`) — removable once prod data confirms
  the backfills ran. Keep `schoolDayBlocks` (clients still use it).
- `schedule/importOcr.ts` (Google Vision import) has no client since
  `d0292f71`; delete if browser OCR is final.
- Web `isWebPreviewableImage` is narrower than mobile `isImageAttachment`;
  web has two attachment size formatters.
- Moderation hrefs `/admin?tab=moderation` vs `/admin/moderation` (pick
  one; the dead `needsYou` href is bug 2 above).
- Mention suggestions vs mention resolution resolve colliding role/unit/tag
  names differently; `typingUsers` builds its own name format;
  `loadClubRole` ignores `customRoleId`; `detail.getWorkspaceNavigation` omits
  `whiteboardsEnabled`.
- Whiteboard presence runs its own tables instead of `@convex-dev/presence`.
- Mobile gallery-only density primitives (`Stack`, `Inline`, `Divider`,
  `CompactList*`, `densityMetrics`) and web `ShapeProvider`/`IconProvider`:
  keep or delete.
- Mobile notification category labels differ in case from web's.
