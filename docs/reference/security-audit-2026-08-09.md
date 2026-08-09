# Security audit and remediation plan — 2026-08-09

Full-codebase review of the Convex backend (`apps/convex`), Next.js web app
(`apps/web`), Expo mobile app (`apps/mobile`), shared packages, CI workflows,
and the production dependency tree.

This document is a work order. Each finding has an ID, a severity, the exact
code that is wrong, why it is exploitable, and the fix to implement. Work the
phases in order — Phase 1 items are exploitable today by ordinary users.

**Threat model.** Every Convex query and mutation is reachable by anyone who
knows the deployment URL, and that URL ships in the client bundle as
`NEXT_PUBLIC_CONVEX_URL`. Every route registered by
`authComponent.registerRoutes` in `apps/convex/src/http.ts` is likewise a public
HTTP endpoint. Anything the web or mobile UI does not call is still callable
with `curl`. Treat client-side checks as cosmetic.

---

## Severity summary

| ID | Severity | Title |
|----|----------|-------|
| C1 | Critical | `SUPPORT_STAFF` can set any user's password via the Better Auth admin HTTP route |
| C2 | Critical | App-level `ADMIN` can impersonate `SUPER_ADMIN` via `/api/auth/admin/impersonate-user` |
| C3 | Critical | Better Auth role is never re-synced on demotion or deactivation |
| C4 | Critical | Default credentials (password == student ID) and `mustResetPassword` is never enforced |
| H1 | High | Unauthenticated reads expose club join codes and member/leader emails |
| H2 | High | Any authenticated user can delete or hijack arbitrary storage objects |
| H3 | High | Login rate limiting is bypassable via `/sign-in/email` and spoofed `X-Forwarded-For` |
| H4 | High | No security response headers on the web app |
| H5 | High | Vulnerable dependencies, including a Next.js proxy-bypass advisory |
| M1 | Medium | Club `LEADER` can flip a private channel to public and read its history |
| M2 | Medium | Club join codes use `Math.random()`, never expire, and redemption is unlimited |
| M3 | Medium | Events, calendar, and course catalog are readable unauthenticated |
| M4 | Medium | `logoUrl` / `bannerUrl` accept arbitrary attacker-chosen URLs |
| M5 | Medium | Web client derives role gating from tamperable `localStorage` |
| M6 | Medium | Uploads are unmetered and orphaned storage objects are never reclaimed |
| M7 | Medium | SVG accepted for avatars; MIME checks trust a client-declared value |
| M8 | Medium | Deleting a channel orphans all of its messages and attachments |
| M9 | Medium | CSV formula injection in the web admin export |
| M10 | Medium | Missing `returns` validators leak internal document fields |
| L1 | Low | Service worker caches authenticated pages and never clears on sign-out |
| L2 | Low | Mobile offline cache is unencrypted and survives sign-out |
| L3 | Low | Any signed-in student can enumerate the full user directory including roles |
| L4 | Low | `betterAuth/dev.ts` exposes unguarded "wipe all auth data" mutations |
| L5 | Low | CI actions pinned to mutable tags |
| L6 | Low | Wildcard trusted auth origin for Vercel previews |
| L7 | Low | No rate limiting on content-creating mutations |
| L8 | Low | Moderation reports accept unbounded arbitrary fields; `/report` is unprotected |
| L9 | Low | Club `memberLimit` is never enforced; duplicate memberships possible |
| L10 | Low | Stale artifacts from the removed `apps/api` service on disk |

---

## Phase 1 — Critical: authentication and privilege escalation

These four findings share one root cause: **there are two parallel permission
systems** — the app's `users.roles` array and Better Auth's `user.role` column —
and only the first one is being maintained. Better Auth's admin plugin is fully
exposed over HTTP and authorizes purely from its own column.

### C1 — `SUPPORT_STAFF` can set any user's password (full super-admin takeover)

**Where**

- `apps/convex/src/auth.ts:97-100` — `supportStaffAc = defaultAc.newRole({ user: ["get", "set-password"], session: [] })`
- `apps/convex/src/auth.ts:143-151` — `admin({ adminRoles: ["admin", "support_staff"], roles: { admin: adminAc, support_staff: supportStaffAc, user: userAc } })`
- `apps/convex/src/http.ts:6` — `authComponent.registerRoutes(http, createAuth)` publishes every Better Auth route, including `/api/auth/admin/*`
- `node_modules/better-auth/dist/plugins/admin/routes.mjs:729-766` — `setUserPassword` checks only `hasPermission({ permissions: { user: ["set-password"] } })`. It never checks *whose* password is being set.

**Why it is exploitable**

`apps/convex/src/users/admin.ts:765-772` carefully restricts support staff to
student password resets. That guard lives in a Convex mutation, and nothing
forces an attacker to use it. A `SUPPORT_STAFF` user holds Better Auth role
`support_staff` (`users/_lib.ts:181-189`), which is in `adminRoles`, so they can
send:

```
POST {CONVEX_SITE_URL}/api/auth/admin/set-user-password
{ "userId": "<super admin authUserId>", "newPassword": "..." }
```

and then sign in as the super admin. The app-layer restriction is bypassed
entirely.

**Fix**

1. Remove `"support_staff"` from `adminRoles` and drop `set-password` from
   `supportStaffAc`. Support-staff password resets stay available *only* through
   `users.admin.resetPassword`, which already scopes them to students.
2. Add every admin-plugin path the app does not deliberately expose to
   `disabledPaths` in `createAuthOptions` (`apps/convex/src/auth.ts:118`):
   `/admin/set-role`, `/admin/create-user`, `/admin/update-user`,
   `/admin/list-users`, `/admin/list-user-sessions`, `/admin/ban-user`,
   `/admin/unban-user`, `/admin/impersonate-user`, `/admin/stop-impersonating`,
   `/admin/remove-user`, `/admin/set-user-password`, `/admin/get-user`,
   `/admin/revoke-user-session`, `/admin/revoke-user-sessions`.
   Server-side `auth.api.*` calls from Convex mutations keep working; only the
   HTTP surface closes.
3. Add a test that asserts each disabled path returns 404/403 for an
   authenticated `support_staff` session.

### C2 — App-level `ADMIN` can impersonate `SUPER_ADMIN`

**Where**

- `apps/convex/src/users/_lib.ts:181-189` — `betterAuthRoleForAppRoles` maps **both** `ADMIN` and `SUPER_ADMIN` to Better Auth `"admin"`.
- `adminAc` grants `user: [create, list, set-role, ban, impersonate, delete, set-password]`.

**Why it is exploitable**

Every "only super admins can …" guard in `users/admin.ts` (lines 208, 580, 615,
695, 761) is defeated. An `ADMIN` calls
`POST /api/auth/admin/impersonate-user` with the super admin's `authUserId`,
receives a session bound to that `authUserId`, and
`getMaybeCurrentAppUser` (`apps/convex/lib/currentUser.ts:17-33`) resolves it to
the `SUPER_ADMIN` app user. They can now delete users, create admins, and export
the full student roster. `/admin/set-role` and `/admin/remove-user` are equally
available.

**Fix**

1. Introduce a distinct `super_admin` access-control role and map
   `SUPER_ADMIN` → `"super_admin"`, `ADMIN` → a narrower `"admin"` role that has
   neither `impersonate` nor `set-role` nor `delete`.
2. Closing the HTTP surface (C1 step 2) is the load-bearing mitigation — do both.
3. In `users/admin.ts`, add a shared `assertCanActOn(actor, target)` helper that
   refuses any action where the target's privilege tier is greater than or equal
   to the actor's, and call it from `activate`, `deactivate`, `assignRoles`,
   `resetPassword`, and `deleteUsers`.

### C3 — Better Auth role is never re-synced on demotion or deactivation

**Where**

- `apps/convex/src/users/admin.ts:669-740` (`assignRoles`) patches only `ctx.db`.
- `apps/convex/src/users/admin.ts:525-602` (`activate` / `deactivate`) patch only `isActive`.

**Why it is exploitable**

Demote an admin to `STUDENT`, or deactivate them entirely, and the app blocks
them — `getMaybeCurrentAppUser` returns `null` for `!user.isActive`. But their
Better Auth `user.role` is still `"admin"` and their session is still valid, so
every `/api/auth/admin/*` power survives indefinitely: impersonate any user, set
any password, remove any account. There is **no session revocation anywhere in
the codebase**. Deactivation is not a real off-switch.

**Fix**

1. In `assignRoles`, after patching the app doc, call
   `auth.api.setRole({ body: { userId: target.authUserId, role: betterAuthRoleForAppRoles(nextRoles) } })`.
2. In `deactivate`, call `auth.api.banUser` plus `auth.api.revokeUserSessions`
   for the target; in `activate`, call `auth.api.unbanUser`.
3. Revoke sessions on any privilege *reduction* as well, not only deactivation.
4. Add a reconciliation `internalMutation` that walks `users` and repairs any
   Better Auth role that disagrees with `betterAuthRoleForAppRoles(user.roles)`,
   and run it once after deploying this phase — existing accounts are already
   out of sync.
5. Add regression tests: demote → assert admin HTTP route rejects; deactivate →
   assert existing session no longer authenticates.

### C4 — Default credentials and unenforced `mustResetPassword`

**Where**

- `apps/convex/src/users/admin.ts:332-340` — when `generatePasswords` is false, `temporaryPassword = uniqueId`. The student's password *is* their student ID.
- `apps/convex/src/users/admin.ts:414` — `const generatePasswords = args.generatePasswords ?? false` makes that the default.
- `apps/convex/src/seed.ts:144-500` — seeds `SUPER001`/`SUPER001`, `ADMIN001`/`ADMIN001`, `TCH001`/`TCH001`, `STU00n`/`STU00n`, all with `mustResetPassword: false` (line 500).
- `apps/convex/src/users/admin.ts:194` — `password: v.optional(v.string())` with no length or strength validation.
- `mustResetPassword` is written in four places and cleared in `users/auth.ts:25`, but **no code path gates on it**. Grep the repo: nothing blocks a user whose flag is `true`.

**Why it is exploitable**

`emailAndPassword.minPasswordLength: 12` only applies to sign-up and
change-password. `/admin/create-user`
(`node_modules/better-auth/dist/plugins/admin/routes.mjs:129-176`) performs no
length check, so 8-character `password == username` accounts are created
successfully. Anyone who knows a student ID — printed on every ID badge — knows
that student's password, and nothing ever forces a change. If the demo seed has
ever run against a shared or cloud deployment, `SUPER001` / `SUPER001` is a live
super-admin login.

**Fix**

1. Remove the "use the student ID as the password" mode from
   `importStudentRow` / `importStudents`. Always call
   `generateTemporaryPassword()`. Delete the `generatePasswords` argument
   rather than defaulting it.
2. Enforce `mustResetPassword` as a hard server-side gate. Add the check to a
   shared helper — `getCurrentAppUser` is the natural place — so that every
   mutation except `users.auth.changePassword` and every query except
   `users.me.me` rejects while the flag is set. Mirror it in the UI: redirect to
   a forced-change screen from `apps/web/src/proxy.ts` and
   `apps/mobile/app/_layout.tsx`.
3. Validate password length (≥ 12) and reject `password === uniqueId` in
   `createLinkedUser` (`apps/convex/src/users/_lib.ts:229`), so every creation
   path is covered.
4. Change the seed so privileged accounts get random passwords surfaced in the
   run output, and set `mustResetPassword: true`. Add a guard that refuses to
   seed when the deployment is not local/anonymous.
5. Rotate every existing credential that came from an import or the seed, and
   check the audit log for logins to seeded accounts.

---

## Phase 2 — High: data exposure and platform hardening

### H1 — Unauthenticated reads expose join codes and emails

**Where**

- `apps/convex/src/clubs/management.ts:15-24` — `getAll` has **no authentication check at all** and returns `clubSummaryWithCounts(...)`, which spreads `...club` — including `joinCode`.
- `apps/convex/src/clubs/detail.ts:20-27` — `get` explicitly builds an `anonymousClubContext` for signed-out callers, then returns `...summary` (again including `joinCode`), plus `leaders` and `sponsors` unconditionally.
- `apps/convex/src/clubs/serialize.ts:8-18` — `toClubUserRef` includes `email` and `roles`.

**Impact.** An anonymous request to `clubs:management:getAll` enumerates every
club and its secret join code. An anonymous request to `clubs:detail:get`
returns club leaders and sponsors with their **email addresses and app roles** —
student and staff PII, plus a map of who the admins are.

**Fix**

1. Require `getCurrentAppUser` in `clubs.management.getAll` and
   `clubs.detail.get`; delete `anonymousClubContext` unless a genuinely public
   club directory is a product requirement (if it is, build a separate,
   explicitly-shaped public projection).
2. Never spread `...club`. Add explicit `returns` validators listing only the
   fields the client needs. `joinCode` must appear only inside the existing
   `activeJoinCode` branch, which is already gated on `canManageMembership`.
3. Drop `email` from `toClubUserRef`; add a separate staff-only serializer for
   the few surfaces that legitimately need it.

### H2 — Arbitrary storage-object deletion by any authenticated user

**Where**

- `apps/convex/src/users/me.ts:57-115` (`saveUserImage`) accepts any `storageId: v.id("_storage")` and never checks who uploaded it.
- `apps/convex/src/users/me.ts:116-147` (`clearUserImage`) then calls `ctx.storage.delete(...)` on whatever is stored.
- `apps/convex/src/clubs/shared.ts:60-70` returns `...attachment` — which includes `storageId` — with **no `returns` validator**.

**Attack chain.** Read any channel attachment you can see → take its
`storageId` → `saveUserImage({ kind: "avatar", storageId })` (passes, since the
stored `contentType` is an image and it is under 100 KB) →
`clearUserImage({ kind: "avatar" })` → the shared attachment file is destroyed
for everyone in the club. The intermediate state also lets you serve someone
else's private file as your avatar.

**Fix**

1. Follow the pattern already used correctly for chat: record every
   `generateUploadUrl` result in an owner-keyed staging table and require an
   ownership check before a `storageId` may be adopted. Reuse
   `assertStagedChatAttachmentOwner` (`uploads/chatAttachments.ts:65-72`) as the
   model.
2. Apply the same ownership check to `uploads.files.finalizeClubImage`.
3. Stop returning `storageId` to clients — add a `returns` validator to
   `listChannelAttachments` that exposes only `_id`, `fileName`, `fileUrl`,
   `mimeType`, `size`, `createdAt`, `messageId`, `messagePreview`, `author`.

### H3 — Login rate limiting is bypassable

**Where**

- `apps/convex/src/auth/loginRateLimitPlugin.ts:26` and `:63` — both hooks match only `ctx.path === "/sign-in/username"`.
- `apps/convex/src/auth.ts:119-131` — `emailAndPassword.enabled: true` also exposes `POST /api/auth/sign-in/email`, which no hook covers.
- `apps/convex/src/users/_lib.ts:143-145` — `buildStudentEmail` makes every student's email fully derivable: `{uniqueid}@fcstu.org`.
- `apps/convex/src/auth/loginRateLimitPlugin.ts:38-41` — the IP is taken from the **left-most** `x-forwarded-for` value, which is client-supplied.

**Impact.** Unlimited password guessing by switching to the email endpoint. Even
on the username endpoint, rotating a spoofed `X-Forwarded-For` defeats the
per-IP bucket. Conversely, the username lockout (5 failures → 30 minutes,
`rateLimits.ts:5-11`) is an anonymous denial-of-service against any named
account — including the super admin — and `sendResetPassword` throws
(`auth.ts:126-130`), so there is no self-service unlock.

**Fix**

1. Change the matcher to cover all credential paths:
   `/sign-in/username`, `/sign-in/email`, `/change-password`, `/forget-password`,
   and any future sign-in provider. Prefer a prefix match on `/sign-in/` over an
   equality check so new endpoints are covered by default.
2. Key the failed-attempt bucket on the resolved account, not the submitted
   identifier, so username and email attempts share one counter.
3. Derive the client IP from the right-most entry of `x-forwarded-for` (or the
   platform-provided header), not the left-most.
4. Add a global per-deployment sign-in throttle as a backstop.
5. Replace the flat 30-minute lockout with exponential backoff plus a CAPTCHA or
   staff-unlock path so lockout cannot be weaponized, and emit an audit event on
   every lockout.

### H4 — No security response headers

**Where.** `apps/web/next.config.ts` defines `headers()` but only for `/sw.js`.

**Missing:** `Content-Security-Policy`, `Strict-Transport-Security`,
`X-Frame-Options` / `frame-ancestors`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy`, `Permissions-Policy`. The app can be framed, which makes
clickjacking against admin destructive actions viable, and there is no
defence-in-depth if an XSS is ever introduced.

**Fix.** Add a global header block. CSP needs `connect-src` for
`NEXT_PUBLIC_CONVEX_URL` (both `https:` and `wss:`) and
`NEXT_PUBLIC_CONVEX_SITE_URL`, and `img-src` for `*.convex.cloud` plus `data:`
and `blob:` for the client-side image compressor. Start in
`Content-Security-Policy-Report-Only`, confirm the console is clean across
dashboard, chat, wrapped, and the admin tabs, then enforce.

### H5 — Vulnerable dependencies

`pnpm audit --prod` reports **26 high, 17 moderate, 2 low**. The ones that matter
for this app:

| Package | Installed | Fixed in | Why it matters here |
|---|---|---|---|
| `next` | `^16.2.6` | `>=16.2.11` | **Middleware/Proxy bypass in App Router** — `apps/web/src/proxy.ts` *is* the auth redirect gate. Also SSRF in rewrites and Server Actions, plus Server Actions DoS. |
| `better-auth` | `1.6.11` | `>=1.6.22` | Account takeover (pre-account hijacking) and stored XSS via `javascript:` `redirect_uri`. The affected plugins are not enabled, but the version is well behind. |
| `ws` (via `convex`) | `<8.21.0` | `>=8.21.0` | Memory-exhaustion DoS. |
| `sharp` (via `next`) | `<0.35.0` | `>=0.35.0` | Inherited libvips CVEs; reachable through image optimization. |
| `lodash` (via `platejs`) | `<=4.17.23` | `>=4.18.0` | Code injection via `_.template`; prototype pollution in `_.unset`/`_.omit`. |
| `postcss` | `<=8.5.11` | `>=8.5.12` | Arbitrary file read via `sourceMappingURL`. Build-time. |
| `hono` (via `@convex-dev/better-auth` → `convex-helpers`) | `<4.12.34` | `>=4.12.34` | `memo()` cross-user SSR data disclosure; CORS ReDoS. |

**Fix.** Bump `next` and `better-auth` first — they are direct dependencies and
carry the two advisories that touch this app's actual auth path. Use
`pnpm.overrides` in `pnpm-workspace.yaml` for the transitive ones (`ws`,
`postcss`, `lodash`, `sharp`, `hono`). Re-run `pnpm audit --prod` and record the
remaining accepted findings. Add `pnpm audit --prod --audit-level high` to
`contributor-validation.yml`.

---

## Phase 3 — Medium

### M1 — Club `LEADER` can unlock a private channel

`apps/convex/src/clubs/channels.ts:1153-1172` — `update` requires only
`context.canManageChannels`, which is true for any `LEADER`
(`clubs/access.ts:142-146`), and it lets the caller set `visibility`. But
`canReadChannel` (`clubs/access.ts:167-178`) grants private-channel access only
to sponsors, admins, and explicit channel members. So a leader who cannot read a
private channel can flip it to `PUBLIC` and then read the entire history.

**Fix.** Require sponsor/admin, or explicit membership in that channel, to
change the visibility of a `PRIVATE` channel. Log visibility changes to
`auditEvents`.

### M2 — Weak, non-expiring club join codes

`apps/convex/src/clubs/invitations.ts:345-363` — `Math.random().toString(36).substring(2, 8).toUpperCase()`.
Non-cryptographic, six characters, never expires, never single-use, and
`redeemJoinCode` (line 365) has no rate limit.

**Fix.** Generate with `crypto.getRandomValues`, lengthen the code, add an
expiry and an explicit revoke, and add a `RateLimiter` bucket on redemption
keyed by user (mirror `friendLinkRateLimiter` in `rateLimits.ts:31-38` — that
module is a good example of the pattern done right).

### M3 — Unauthenticated reads of events, calendar, and courses

- `apps/convex/src/events/events.ts:16` (`list`) and `:48` (`get`) tolerate a null user and return published events.
- `apps/convex/src/events/calendar.ts:8` (`list`) returns all non-`PERSONAL` entries with no user.
- `apps/convex/src/courses/catalog.ts:16, 48, 117` have no auth call at all.

**Fix.** Require `getCurrentAppUser` in each. If the course catalog is
intentionally public, add a comment saying so and add a test that pins the
decision.

### M4 — Unvalidated URL fields

`apps/convex/src/clubs/management.ts:101-165` — `update` accepts `logoUrl`,
`bannerUrl`, and `accentColor` as free strings from any club manager. Nothing
constrains them to Convex storage. A club leader can point a club logo at an
external host and harvest the IP and user agent of every member who views the
club page, or embed a `data:` URL.

**Fix.** Accept a `storageId` and resolve the URL server-side (the
`finalizeClubImage` flow already produces one), or validate that the URL's
origin matches the deployment's storage origin. Validate `accentColor` against a
strict hex pattern.

### M5 — Client-side role gating from `localStorage`

`apps/web/src/lib/auth.ts:19-36` caches the full profile — including `roles` —
under `ia_user`, and `useCurrentUser` (`:60-79`) falls back to it when the live
query is unresolved. `hasRole`, `isAdmin`, `AppShell` navigation, and the admin
route content all derive from that value, so editing one `localStorage` key
unlocks the admin UI.

Convex still enforces every real check server-side, so this is presentation
only — but it is a misleading trust boundary that invites a future client-only
check to become a real vulnerability.

**Fix.** Use the cache only for non-sensitive optimistic display (name, avatar).
Derive all gating from the live `api.users.me.me` result, and render a loading
state rather than a cached-role guess.

### M6 — Unmetered uploads, orphaned storage

`apps/convex/src/uploads/files.ts:59-66` — `generateUploadUrl` is available to
every authenticated user with no rate limit and no per-user quota. Only *staged
chat attachments* get a TTL sweep
(`uploads/chatAttachments.ts:135-147`); a URL that is used but never finalized
leaves an orphan storage object forever. A single student can exhaust the
storage quota.

**Fix.** Add a per-user rate limit and a daily byte quota on
`generateUploadUrl`. Add a scheduled sweep that deletes storage objects with no
owning row after a grace period.

### M7 — SVG avatars; MIME trusted from the client

`apps/convex/src/users/me.ts:80` accepts anything whose `contentType` starts
with `image/` — which includes `image/svg+xml`. And the content type itself is
whatever the client sent at upload time
(`apps/web/src/lib/convex-upload.ts:15` sets `'Content-Type': file.type`), so
`uploads/chatAttachments.ts:16-21`'s block list for
`text/html`/`image/svg+xml`/JS is bypassable by simply declaring `image/png`.

Convex serves files from a separate origin, so this is not same-origin XSS
against the app — but a stored SVG or HTML page opened directly is still a
scripting and phishing vector on the storage origin.

**Fix.** Replace the `startsWith("image/")` test with an explicit allow-list
(`image/png`, `image/jpeg`, `image/webp`, `image/gif`). Verify magic bytes
server-side rather than trusting the declared type.

### M8 — Channel deletion orphans content

`apps/convex/src/clubs/channels.ts:1174-1184` deletes only the `clubChannels`
row. Messages, channel memberships, attachments (and their storage objects),
reactions, mentions, and poll votes all survive.

**Fix.** Schedule a cascading cleanup, mirroring
`clubs/channelDeletion.cleanupDeletedMessage`.

### M9 — CSV formula injection in the web admin export

`apps/web/src/app/admin/_lib/admin-utils.ts` — `escapeCsvCell` quotes cells but
does not neutralize a leading `=`, `+`, `-`, or `@`. The mobile equivalent gets
this right (`apps/mobile/src/features/admin/roster-csv.ts:escapeCsvCell` prefixes
with `'`). Exports include names that came from an imported roster.

**Fix.** Port the mobile guard into the web helper.

### M10 — Missing `returns` validators

`clubs/shared.listChannelAttachments`, `clubs/channels.getMessagePage`,
`searchMessages`, `getThread`, `getMessages`, all of `clubs/management`,
`clubs/detail`, and `events/*` return raw documents with no output validator.
This is how `storageId` (H2) and `joinCode` (H1) leak. The project's own Convex
guidelines require `returns` on every function.

**Fix.** Add explicit `returns` validators to every public query and mutation,
listing only fields the client needs. Consider a lint rule.

---

## Phase 4 — Low / hygiene

- **L1** — `apps/web/public/sw.js` precaches `/dashboard` and serves cache-first
  for every non-`/api/` request, and nothing clears the cache on sign-out. On a
  shared school device the previous user's rendered pages can be served from
  cache. Clear `caches` on sign-out; do not precache authenticated routes.
- **L2** — `apps/mobile/src/lib/offline-cache.ts` writes schedule and Flex data
  to unencrypted `AsyncStorage`; sign-out (`apps/mobile/app/profile.tsx:81`)
  calls only `authClient.signOut()`. Clear the `ia_offline_*` keys on sign-out.
- **L3** — `search/global.palette` and `schedule/friends.search` let any
  signed-in student enumerate the entire user table including `roles`, revealing
  who the admins are. The search index (`schema.ts:95-103`) also covers email.
  Drop `roles` from the palette result; scope people search to a plausible
  audience.
- **L4** — `apps/convex/src/betterAuth/dev.ts` exports `clearAuthData` (deletes
  every session, account, and user) and `deleteUserData` as **unauthenticated
  mutations**. They live inside the `betterAuth` Convex component, so today they
  are reachable only from the parent app, not from clients. That is a
  configuration accident away from being catastrophic — add an explicit guard
  and a comment stating why the file is safe.
- **L5** — `.github/workflows/react-doctor.yml` uses `millionco/react-doctor@v2`
  (mutable tag) and checks out untrusted PR code without
  `persist-credentials: false`; `prod.yml` runs `pnpx vercel` unpinned. Pin
  third-party actions to commit SHAs and add `persist-credentials: false`.
- **L6** — `apps/convex/src/auth.ts:81` trusts any
  `*-sreyassabbanis-projects.vercel.app` origin for auth. Any deployment under
  that Vercel account — including a preview built from a fork — is an accepted
  auth origin. Narrow to specific hostnames, or gate the wildcard on a non-prod
  environment flag.
- **L7** — Only login and friend-link redemption are rate-limited.
  `clubs.channels.postMessage`, `moderation.reports.submit`,
  `clubs.invitations.requestToJoin`, and `announcements.comments.add` have no
  limits. Add `RateLimiter` buckets.
- **L8** — `moderation.reports.submit` accepts unbounded arbitrary
  `contentType` / `contentId` strings with no reference validation. Bound their
  length and validate against a known set. Separately, `/report` is missing from
  `protectedRoutes` in `apps/web/src/proxy.ts`.
- **L9** — `clubs.memberLimit` is stored but never enforced in `joinOpenClub`,
  `respondToJoinRequest`, `redeemJoinCode`, or `respondToInvite`;
  `respondToInvite` (`clubs/invitations.ts:319`) also inserts a `clubMembers`
  row without checking for an existing membership, so duplicates are possible.
- **L10** — `apps/api/` still holds `dist/`, `prisma/migrations/`, and
  `logs/server-errors-2026-05-10.jsonl` (129 KB) from the removed REST service,
  plus a 155 KB PostgreSQL `logfile` at the repo root. Both are gitignored and
  untracked — nothing leaked through git — but they are dead weight containing
  real error output. Delete them.

---

## Cross-cutting recommendations

1. **Collapse the two permission systems.** Better Auth's `user.role` should be
   a pure derivative of `users.roles`, written only by a single helper that is
   called on every role change, and its admin HTTP surface should be closed.
   C1, C2, and C3 all disappear once that invariant holds.
2. **Default-deny the Convex surface.** Add a shared wrapper —
   `authedQuery` / `authedMutation` / `adminMutation` — so a new function is
   authenticated unless the author opts out explicitly. Today the opposite is
   true, which is how `clubs.management.getAll` shipped with no check.
3. **Add authorization regression tests.** `SECURITY.md` already asks for a
   denied-access case per authorization fix. There are Convex tests in place
   (`clubs/access.test.ts`, `schedule/shareLinkSecurity.test.ts`) — extend that
   pattern to cover every finding here.
4. **Audit-log the security-relevant paths that are silent today.** Channel
   visibility changes, join-code generation and redemption, and login lockouts
   all currently leave no trace.

## Verification after each phase

```bash
pnpm --filter cvx codegen
```

```bash
pnpm --filter cvx typecheck
```

```bash
pnpm test
```

```bash
pnpm lint
```

```bash
pnpm build
```

```bash
pnpm audit --prod --audit-level high
```

## Dependency audit disposition after remediation

The production audit now has no patchable high-severity findings. Two Expo/Metro
build-tool findings remain for `image-size` (`GHSA-w3rx-r6r6-pgpr` and
`GHSA-5p2g-fcmc-qvqq`): GitHub lists `2.0.3` as patched, but npm publishes only
through `2.0.2`. The application does not invoke the affected ICNS, JXL, or HEIF
parsers at runtime. CI ignores only these two advisory IDs until a patched
release exists; all other high findings still fail the build.
