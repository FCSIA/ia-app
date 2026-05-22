# IA Backend -> Convex Porting Guide

This guide is for planning a backend replatform from the current NestJS,
Prisma, PostgreSQL, local-upload architecture to Convex.

## Ground Rules

- Start every porting session by reading `agent-notes/STATE.md`, then this
  file, then the relevant docs under `docs/`, then only the source files needed
  for the domain being planned or changed.
- Use Nix + direnv in this repo: run `direnv allow` once, then prefer
  `direnv exec . <command>` when checking tools.
- Before touching Convex code in this repo, read
  `apps/convex/convex/_generated/ai/guidelines.md`. Those generated rules
  override stale memory about Convex APIs.
- Match or improve the existing product behavior. API shapes, database IDs,
  seeded data, and internal implementation details can break if that makes the
  Convex design cleaner; permissions, data visibility, audit semantics, and
  school workflows cannot drift silently.
- Treat current docs as the product map and current code/schema as the source
  of truth where they disagree. The Prisma schema currently has 43 models and
  24 enums, including newer fields that some docs do not yet mention.
- Treat `packages/contracts` as transitional. As each domain moves to Convex,
  delete Nest DTOs, Axios response types, and Prisma-shaped transport types.
  Keep only genuinely shared product enums or pure cross-app logic that still
  earns its place after generated Convex API types exist.
- Keep `docs/` synchronized with the port. Any accepted Convex phase that
  changes architecture, data shape, auth, frontend API flow, storage, or feature
  behavior must update the matching docs in the same change. Do not leave
  NestJS/Prisma/PostgreSQL/Axios/Swagger docs describing the active system
  after the Convex replacement exists.
- Do not use broad compatibility shims to hide semantic drift. If a Prisma or
  NestJS primitive has no Convex equivalent, document the product decision or
  rewrite the primitive around Convex's model.

## Sources Read

Repo:

- `agent-notes/STATE.md`
- `docs/index.md`
- `docs/architecture/{overview,tech-stack,data-flow,diagram-inventory}.md`
- `docs/backend/{backend-overview,backend-auth,modules,controllers,services,prisma}.md`
- `docs/database/{database-overview,schema,seed}.md`
- `docs/frontend/{api-layer,frontend-auth}.md`
- Feature docs for announcements, clubs, events, schedule, Flex Friday,
  notifications, moderation, and audit log
- `apps/api/prisma/schema.prisma`
- Backend entry points, auth, uploads, notification delivery, club access
  policy, selected service hot paths, `apps/web/src/lib/api.ts`, and
  `packages/contracts/src/*`

Convex:

- Convex AI page and AI files: https://docs.convex.dev/ai
- Generated AI rules equivalent to `convex_rules.txt`:
  https://convex.link/convex_rules.txt
- Core docs for functions, runtimes, auth, custom JWT, database types, file
  storage, HTTP actions, search, scheduling, import/export, limits, Next.js,
  OpenAPI, self-hosting, and `convex-test`.
- Better Auth + Convex docs for local component install, auth config, generated
  schema, client/server helpers, supported plugins, username login, and SSO
  compatibility.
- Component docs/readmes:
  - Convex Components and usage: https://docs.convex.dev/components
  - Aggregate: https://github.com/get-convex/aggregate
  - Sharded Counter: https://github.com/get-convex/sharded-counter
  - Rate Limiter: https://github.com/get-convex/rate-limiter
  - Migrations: https://github.com/get-convex/migrations
  - Workpool: https://github.com/get-convex/workpool
  - Workflow: https://github.com/get-convex/workflow
  - Action Cache: https://github.com/get-convex/action-cache

## Feasibility Verdict

Porting the backend to Convex is possible, but not as a lossless file-by-file
translation. Convex can own the app's database, backend functions, auth
integration, storage, scheduled work, realtime updates, and many HTTP-facing
workflows. The product is a good conceptual fit for Convex because it is a
TypeScript app with collaboration-heavy school communication features, lots of
viewer-specific reads, and in-app notifications that would benefit from
subscriptions.

The hard part is that the current backend is built around NestJS controllers,
Passport JWT guards, Prisma's relational query model, PostgreSQL constraints,
raw SQL, disk uploads, and generated Swagger. Convex is a transactional
document database plus TypeScript functions. That means the port is a
re-architecture of backend boundaries and data access patterns, not a syntax
conversion.

### Good Fits

- TypeScript business logic can remain TypeScript.
- Mutations provide transactional writes and optimistic concurrency.
- Queries are reactive by default and can replace notification polling and many
  TanStack invalidation patterns.
- Built-in file storage can replace local `UPLOAD_DIR` and static `/uploads`.
- Scheduled functions/crons can cover expiration, cleanup, seed/demo loading,
  snapshot generation, and durable workflows.
- Convex Components can remove custom infrastructure for common hard parts:
  Aggregate for counts/sums/rank/offset pagination, Sharded Counter for
  high-write counters, Rate Limiter for abuse controls, Workpool/Workflow for
  durable background jobs, and Action Cache for expensive external actions.
- Full-text search can cover some course, people, message, and audit search
  needs if the product accepts Convex's search semantics.
- The Next.js frontend can call Convex functions directly through Convex React
  hooks, or use HTTP/Convex clients during a staged frontend rewrite.

### Not Drop-In

- NestJS modules/controllers/guards/decorators do not map directly to Convex.
- Prisma relations, includes, cascades, `groupBy`, `count`, raw SQL, and
  Postgres-specific indexes must be redesigned.
- Current JWTs are HS256 from Nest. Convex custom JWT providers currently
  expect RS256 or ES256 with issuer/JWKS configuration, so the current token
  issuer is not a clean direct auth provider.
- Better Auth is the selected auth provider, but it still changes cookies,
  sessions, password reset, frontend providers, and user/auth table boundaries.
- PostgreSQL CUID primary keys are disposable for this port. Do not add
  old ID fields or retain old IDs. Reset/reseed with native Convex `_id`
  values.
- Convex documents have a 1 MiB size limit, arrays have limits, and strings
  must be valid Unicode. Rich chat bodies, snapshots, uploads, and arbitrary
  JSON need validators and size checks.
- Local filesystem logging and file serving do not exist in Convex functions.
- `pg_trgm` fuzzy search and custom SQL ranking do not exist in Convex search.
- Convex has no SQL foreign keys or automatic cascade delete; deletes and
  uniqueness are application-level invariants enforced through indexed reads
  and mutations.

## Is File-by-File Phase A The Right Mentality?

No. File-by-file porting is the wrong Phase A for this project.

The current files are shaped by NestJS dependency injection and Prisma. Convex
code should be shaped by tables, indexes, auth identity, function visibility,
transaction boundaries, and client subscriptions. Translating
`announcements.service.ts` into `apps/convex/convex/announcements.ts` line by line would
carry over the wrong abstractions: Prisma includes, HTTP exceptions,
controller/service splits, N+1 preference checks, and in-memory filters that
Convex specifically warns against.

Phase A should be domain-first and contract-first:

1. Inventory the product behavior, permissions, data model, side effects, and
   client contract for one domain.
2. Design the Convex tables, indexes, validators, helper functions, and auth
   checks for that domain.
3. Decide whether the frontend should call native Convex functions directly or
   whether a narrow HTTP route is needed for uploads/exports/external callers.
4. Write tests and comparison cases against the product behavior.
5. Only then port implementation code, preferably by vertical slice.

File-by-file review is still useful as an inventory method, especially for
edge cases, but it should not drive the code layout.

## Current Backend Inventory

Runtime today:

- Next.js 15 / React 19 frontend.
- Axios API client in `apps/web/src/lib/api.ts`.
- JWT and user profile stored in browser localStorage as `ia_token` and
  `ia_user`.
- NestJS API with global validation, global exception filter, global JWT guard,
  global roles guard, Swagger docs, static upload serving, and CORS.
- Prisma Client over PostgreSQL.
- Local disk uploads through Multer and `UPLOAD_DIR`.
- Transitional TypeScript contracts in `packages/contracts`.

Backend domains:

- Auth: uniqueId/password login, bcrypt, JWT signing, sessions, logout, change
  password, active-user enforcement.
- Users: CRUD, roles, activation, password reset, CSV import/export, dashboard
  layout.
- Courses: searchable course catalog.
- Schedule: student schedules, school day blocks, friends, pg_trgm people
  search.
- Announcements: targeting, read tracking, bookmarks, comments, archive,
  approval, moderation, notifications.
- Clubs: membership, sponsors, join codes, requests, invites, CSV bulk invite,
  channels, channel permissions, tags, messages, replies, attachments,
  reactions, polls, reports.
- Events and calendar: event workflow, approvals, publication, calendar
  entries.
- Flex Friday: Fridays, sessions, workshops, registrations, assignments,
  attendance, credits.
- Notifications: scoped preferences, deliveries, unread count, read state.
- Moderation: local keyword rules, profanity masking, reports, escalation.
- Audit: admin-visible action log and entity history.
- Uploads: flyers, chat attachments, club images.
- Wrapped: school-year activity snapshots and admin generation.

## Architecture Decisions Before Code

These decisions block any serious implementation.

Because the app has not reached alpha and current data is disposable seed
data, implementation contracts can be broken when it makes the Convex design
cleaner: IDs, seed shape, local database contents, REST surface, and temporary
admin data can all reset. Do not break the product goals: school roles,
club/sponsor rules, announcement approval, moderation/audit behavior, schedule
sharing, Flex Friday workflows, and notification intent still need to survive
the port.

Functional parity means the same user-visible behavior and domain guarantees,
not preserving NestJS/Prisma/Axios/Swagger shapes. Do not add old ID fields,
dual-read paths, or old REST response adapters just to resemble the current
backend.

### 1. Auth Provider

Decision: use Better Auth with `@convex-dev/better-auth`, installed as a local
Convex component.

Why:

- It keeps authentication code and auth data inside this app's Convex-backed
  system instead of outsourcing student/teacher identity data to a managed
  third-party auth vendor.
- It fits the current uniqueId/password login better than Clerk/Auth0-style
  social/OIDC-first flows.
- The Convex integration is maintained by Convex and provides JWT/JWKS/cookie
  integration for `ctx.auth.getUserIdentity()`.
- Better Auth has the features this app is likely to need next: username login,
  email/password, session management, rate limiting, 2FA, passkeys, email OTP,
  and other plugin-based security features.

Implementation constraints:

- Use the Better Auth username plugin for the existing school `uniqueId` login.
  Disable public username-availability checks to avoid user enumeration.
- Use Better Auth email/password only if student/teacher email availability is
  acceptable; otherwise use generated placeholder emails internally and keep
  `uniqueId` as the login identifier.
- Require 2FA for admins and consider 2FA for teachers/sponsors before any real
  student data exists.
- Keep app roles, active state, grade, pathway, sponsor/leader state, and club
  permissions in the app `users` and domain tables. Do not treat Better Auth
  roles as the product authorization source.
- Prefer Better Auth local install so the generated auth schema, indexes, and
  plugin choices are visible in the repo. This still stores Better Auth data in
  Convex component tables; "local install" means the component/schema live under
  `apps/convex/convex/betterAuth/` instead of using the opaque default component schema.
  Regenerate the local auth schema when plugin configuration changes.
- Do not use Better Auth SSO/SAML as a Phase 1 assumption. The current Convex +
  Better Auth docs list the official SSO plugin as incompatible with this
  integration. If the school requires SAML/enterprise SSO on day one, pause and
  reconsider WorkOS/Auth0 or another OIDC/SAML provider before implementing.

Rejected for now:

- Convex Auth: promising, but still beta and its Next.js support is documented
  as under active development.
- Clerk/Auth0/WorkOS: good products, but they move identity data and auth
  policy outside this app by default and are less aligned with reset-first,
  uniqueId/password school login.
- Temporary external auth issuer: unnecessary now that Better Auth can issue
  Convex-compatible auth through the maintained component. Do not carry over
  the current HS256 Nest JWTs.

Do not accept `userId` from clients for authorization. Every protected Convex
function must derive identity with `ctx.auth.getUserIdentity()`, then load the
current app user/roles server-side. For sensitive mutations, prefer the Better
Auth component's session-validating helpers over trusting the JWT payload
alone.

Account model:

- Students and staff do not self-register. Accounts are created by admin/CSV
  seed/import flows.
- Initial passwords are generated at import/activation time and must be reset
  soon after activation, matching the current product direction.
- Do not assume student email can receive external mail. Password reset for
  students should route through school front-office/helpdesk staff or
  superadmins who can verify the request and reset the password.
- Add a product role for front-office/helpdesk staff if the current role set
  does not already express "can reset student passwords, cannot administer the
  whole system."
- Keep a future SSO path open in docs: school Google/Microsoft/OIDC/SAML may be
  added later, but it is not a Phase 1 blocker.
- Password lockout/login rate limiting is not a Phase 1 blocker because it is
  not implemented today. Track it as post-port security hardening in
  https://github.com/virajdas/ia-app/issues/23 and prefer Convex-native rate
  limiting once the Better Auth flow is stable.

### 2. Native Convex Client Target

Recommended target: native Convex functions for app data, with `useQuery`,
`useMutation`, `useAction`, generated `api` references, and realtime
subscriptions.

Do not preserve the REST/Axios layer by default. Use HTTP actions only where
the interface is inherently HTTP-shaped: multipart uploads, CSV exports,
webhooks, or a concrete external caller. If the frontend rewrite must be
incremental, wrap native Convex calls behind feature-specific client modules
instead of recreating the current API surface.

### 3. Seed Reset and Data Scope

Current assumption: there is no production or alpha data to preserve. Existing
local data is generated by `faker-js` seed scripts, and the PostgreSQL data can
be wiped, truncated, or ignored. The port should favor clean Convex-native
schema and IDs over mirroring historical rows.

- Default path: transform the seed data into Convex seed/import functions,
  accept new `_id` values, and update fixture references during seeding.
- New Convex seed fixtures should live with the Convex app, preferably under
  `apps/convex/seed-data/`, with callable seed/reset functions or actions under
  `apps/convex/convex/`. Do not move the legacy Prisma seed files until the
  old API no longer depends on them.
- Do not carry old PostgreSQL IDs through the schema, temporary import code, or
  comparison tests. Compare behavior and fixture meaning, not old IDs.
- Preserve explicit `createdAt` / `updatedAt` fields only where product
  behavior, sorting, or deterministic seeded demos need them. Do not preserve
  timestamps just to mirror Prisma history.
- Moving old uploaded files is not required for the current seeded dataset
  unless seeded uploaded assets become part of the demo. New upload work should
  go straight to Convex storage IDs.
- `@convex-dev/migrations` is not for this initial Postgres-to-Convex reset.
  Keep it in mind for future Convex-to-Convex schema changes, data backfills,
  Aggregate/Sharded Counter backfills after there is real Convex data, and
  long-lived dev/prod deployments where data must survive code changes.
- If real user data unexpectedly appears before cutover, pause and make a new
  explicit data-preservation decision outside this reset-first plan.

### 4. Hosting and Compliance

Convex can be self-hosted, but self-hosting is an operations decision, not an
automatic privacy win.

Default development path: use Convex Cloud for speed while no real student data
exists, then make a deliberate Cloud vs self-hosted decision before any real
student/teacher data is entered.

Choose self-hosting only if the school/privacy requirements justify owning
uptime, backups, upgrades, monitoring, incident response, database persistence,
file storage, and dashboard/admin key security. Choose Convex Cloud if the
managed product's compliance posture, region, backups, and DPA/security review
are acceptable.

Either way, Phase 0 must document:

- where student/teacher identity, profile, schedule, club, message, upload, and
  audit data live;
- who can access production data operationally;
- backup/restore and retention expectations;
- region/data residency requirements;
- DPA/security-review requirements before real school data is imported.

### 5. Product Semantics

Clarify before implementation:

- There are no external consumers of the current REST API. Delete REST/Swagger
  parity from the plan unless a new external caller appears.
- Replace localStorage auth with Better Auth cookie/session flow.
- Derive an authorization matrix from the existing code and docs before
  changing auth code. This is not a product re-spec. It is an audit artifact
  that records current behavior with source-file references so the port does not
  accidentally loosen or tighten access.
- Are upload URLs public, signed, expiring, or only available to authenticated
  users?
- Is true typo-tolerant people/course search required, or is prefix/full-text
  search acceptable?
- Are notifications only in-app, or will email/push be added during the port?
- Keep audit/messages/uploads/deleted-user history at least as much as the
  current app does. Log everything; do not shrink retention during the port.

Authorization matrix artifact:

- Generate it by reading the current guards, services, policies, docs, and UI
  affordances. Do not invent new access rules unless the user explicitly
  approves a product change.
- Include source references for each rule, especially `ClubAccessPolicy`,
  global roles guard usage, module services, feature docs, and frontend route
  gating.
- Cover at least these actors: unauthenticated, inactive user, student, teacher,
  sponsor, club member, club leader, private-channel member, front-office or
  helpdesk staff, admin, and superadmin if present.
- Cover at least these action families: user import/export/reset/deactivate,
  announcements, clubs, private channels, messages/reactions/polls, events,
  Flex Friday, notifications, moderation, audit, uploads, and Wrapped/admin
  generation.
- If the code and docs disagree, record the conflict and pick the code as the
  temporary source of truth until the user resolves it.

### 6. Runtime, Contracts, and Operations

Do this before implementation, not while debugging failed deploys:

- Audit every backend dependency for Convex runtime compatibility. Anything
  requiring Node APIs, native bindings, filesystem access, long CPU work, or
  external network calls belongs in a Node action or should be replaced.
- Shrink `packages/contracts` aggressively. Generated Convex API/data-model
  types should replace backend transport contracts as domains move. Keep shared
  code only when it is not Convex-derived and is needed by more than one app.
- Expected end state: remove backend DTOs and REST transport contracts as each
  domain moves to Convex. Keep only product-level shared types that remain
  useful after Convex validators/generated API types exist.
- Map environment variables and secrets from the current API to Convex
  deployment configuration: auth provider values, storage/upload settings,
  external integrations, admin seed credentials, and any future email/push
  provider.
- Define observability expectations: Convex logs/dashboard, any external error
  reporting, sanitized `serverErrors` table if needed, and audit/event export.
- Define rollback for the reset-first plan. With no real data, rollback should
  mean redeploy the old app and reseed the old database, not dual-writing or
  preserving IDs.

### 7. Component Selection

Evaluate Convex Components before writing custom infrastructure:

- Use `@convex-dev/aggregate` for queryable counts, sums, rank, random access,
  and offset pagination over table-backed data. Candidate uses: unread
  deliveries by user, channel message counts, reaction counts, poll vote
  counts, member counts, leaderboard/top stats, and Wrapped source metrics.
- Use `@convex-dev/sharded-counter` only for high-write counters where exact
  table-shaped aggregation is not needed and reads are less frequent than
  writes. Do not use it when the UI needs sorted/ranked access; use Aggregate.
- Use `@convex-dev/rate-limiter` for upload/admin/import abuse controls in the
  port. Also use it later for login attempts/password lockout once issue #23 is
  scheduled against the Convex auth flow.
- Use `@convex-dev/workpool` for bounded parallel background jobs such as
  notification fanout, bulk import chunks, file processing, and external calls
  that need retries or completion callbacks.
- Use `@convex-dev/workflow` for durable multi-step processes that must resume
  after failure, such as Wrapped generation, complex approval/publication
  workflows, or future AI/admin jobs.
- Use `@convex-dev/action-cache` only for expensive actions with stable inputs:
  embeddings, external lookups, generated summaries, or other paid/slow calls.
- Keep `@convex-dev/migrations` scoped to future Convex data evolution and
  component backfills after data exists. It is not part of preserving old
  Postgres IDs or rows for this port.

### 8. Documentation Rewrite Scope

Every implementation phase must carry the docs with it. Treat stale docs as a
bug because future agents and contributors are instructed to read `docs/`
before code.

- Update `docs/index.md` so it points to the Convex-era architecture and no
  longer frames NestJS/Prisma as the active backend after cutover.
- Rewrite `docs/architecture/*` for Convex functions, data flow, realtime
  subscriptions, storage, scheduled work, components, and deployment topology.
- Rewrite `docs/backend/*` around Convex modules/functions, auth helpers,
  public/internal function boundaries, actions, HTTP actions, and component
  usage. Remove NestJS controller/service/guard language once it is no longer
  active.
- Rewrite `docs/database/*` for `apps/convex/convex/schema.ts`, validators, indexes,
  Convex IDs, storage metadata, seed/reset strategy, Aggregate/Sharded Counter
  state, and future Convex data-evolution jobs.
- Rewrite `docs/frontend/*` for Convex React hooks/client usage, auth provider
  flow, upload flow, realtime subscription behavior, and removal of the Axios
  API layer where applicable.
- Update every feature doc under `docs/features/` touched by the port:
  announcements, clubs/channels, events/calendar, Flex Friday, notifications,
  moderation, audit log, schedule, uploads, and Wrapped.
- If a doc describes a removed backend primitive only for historical context,
  label it clearly as historical or remove it. Do not let historical notes look
  like current operating instructions.

## Convex Design Rules For This App

### Functions

- Use `query`, `mutation`, and `action` only for public API surface.
- Use `internalQuery`, `internalMutation`, and `internalAction` for private
  backend composition.
- Every Convex function must have argument validators. Add return validators
  for public functions where feasible because they improve contracts and
  OpenAPI output.
- Put Node-only actions in separate files with `"use node";`. Never mix
  queries/mutations into a Node action file.
- Actions must not use `ctx.db`. Actions call mutations/queries with
  `ctx.runMutation` and `ctx.runQuery`.
- In queries/mutations, prefer shared TypeScript helpers over `ctx.runQuery` or
  `ctx.runMutation` to avoid extra invocation overhead and transaction splits.
- Keep side effects out of queries/mutations except database writes and
  scheduler work allowed by Convex. External calls, CSV parsing with Node
  libraries, and heavy CPU work belong in actions.

### Schema

- Define all tables in `apps/convex/convex/schema.ts`.
- Prefer explicit validators over `v.any()`. Use `v.any()` only for rich-text
  or snapshot JSON after documenting the expected shape and size risk.
- Use `Id<"table">` for new Convex references, not bare `string`.
- Prefer native Convex IDs in the real schema. For seeded data, build fixtures
  in dependency order and pass generated IDs directly through the seed helpers.
- Do not store unbounded child collections inside parent documents. Existing
  join tables generally remain separate Convex tables.
- Do not rely on arrays for queryable many-to-many relationships. Roles,
  club memberships, tags, target audiences, and pathway targeting need indexes,
  join tables, fanout tables, or denormalized booleans/summary rows.
- Use indexes for every hot query. Avoid Convex `.filter()` for anything that
  can grow; it filters after scanning.
- Name indexes with all fields, e.g. `by_userId_and_category_and_scopeKey`.
- Convex has no automatic unique constraints. For unique fields like
  `uniqueId`, `slug`, `club name`, `clubId + name`, and scoped notification
  preferences, read by a unique index inside the mutation before inserting.
  Convex OCC should make concurrent duplicate attempts conflict/retry, but
  uniqueness remains app logic.
- Convex has no cascade delete. Either prefer soft deletes for user-facing
  records, or implement explicit internal delete helpers that remove dependent
  documents in batches.

### Data Types

- Prisma `DateTime` becomes a Convex `number` in milliseconds or an ISO string.
  Use one convention per domain. For scheduling/calendar math, prefer
  milliseconds for instants and strings for date-only or clock-time fields.
- Prisma enums become `v.union(v.literal(...))` validators and TypeScript union
  types.
- Prisma `Json` fields need bounded, validated shapes where possible:
  `bodyRich`, `pollOptions`, `AuditEvent.meta`, and `WrappedSnapshot.summary`.
- Convex strings must be valid Unicode and documents must stay under 1 MiB.
  Watch rich text, long announcements, audit metadata, wrapped summaries, and
  any future generated content.
- Convex file storage stores `Blob`s and returns storage IDs/URLs. Store
  `storageId`, original filename, MIME type, and size; do not store only
  `/uploads/...` paths.

### Auth and Authorization

- Create one `requireCurrentUser(ctx)` helper per Convex backend layer. It
  should call `ctx.auth.getUserIdentity()`, map `identity.tokenIdentifier` to
  the app user, check `isActive`, and return roles.
- Preserve multi-role semantics. Do not collapse the app to a single role just
  because many screens use `role = roles[0]`.
- Preserve club-specific permissions separately from global roles. Club leader,
  sponsor, member, private channel member, and admin checks should be helpers
  used by every club/channel function.
- Do not trust client-provided `userId`, `role`, `roles`, `isAdmin`, or club
  permission flags.

### Performance

- Replace unbounded `findMany` and Prisma `include` trees with bounded,
  indexed queries and explicit projections.
- Use pagination for feeds, messages, audit logs, notifications, and any admin
  listing.
- Prefer the Aggregate component for counts/sums/rank/offset access that must
  stay queryable and reactive. Prefer Sharded Counter for high-write singleton
  counters. Hand-written summary tables are the fallback when neither component
  matches the access pattern.
- Avoid fanout writes that read preferences one user at a time. Batch
  notification preference reads by scoped indexes or precompute recipient
  preference state.
- Design hot list views around summary documents if source documents are large.
- For bulk deletes, imports, notification fanout, Wrapped generation, and
  derived-state rebuilds, use batched self-scheduling mutations,
  Workpool/Workflow, or future Convex data-evolution jobs instead of one giant
  mutation.

## Domain Porting Notes

### Auth and Users

Current behavior:

- Users log in with `uniqueId` and password.
- Passwords are bcrypt hashes in `User.passwordHash`.
- Login signs JWTs, stores `AuthSession`, audits login, and returns safe user
  data.
- Logout deletes matching `AuthSession`.
- Admins can create users, assign roles, deactivate/activate, reset passwords,
  import students from CSV, and export students to CSV.

Convex design:

- Use Better Auth local install with the username plugin for `uniqueId` login.
- Keep an app-level `users` table separate from Better Auth's auth user table
  because roles, pathway, grade, active state, dashboard layout, school IDs,
  and product permissions are app data.
- Add an auth identity mapping field such as `authUserId` or
  `tokenIdentifier`, indexed by its own unique index, once the Better Auth
  payload shape is confirmed.
- Implement password reset/admin reset through Better Auth APIs plus internal
  app mutations for audit events and user-visible state.
- Implement admin/CSV account creation with generated initial passwords and a
  forced-reset flag or equivalent first-login reset flow.
- Implement student password resets through superadmin/front-office staff tools,
  not external email, unless school email deliverability is confirmed.
- CSV import/export should be Node actions or HTTP actions. User creation
  should happen through internal mutations in batches.

### Courses and Schedule

Current risk points:

- Course search loads filtered rows then does in-memory substring matching.
- Schedule people search uses raw PostgreSQL SQL and `pg_trgm` similarity.
- Student schedules replace entries transactionally.
- Friend relationships have directional request/accept semantics.

Convex design:

- Use Convex search indexes for course title/department/code if acceptable.
- For people search, Convex full-text search gives typeahead/prefix and ranked
  word search, but not Postgres trigram typo tolerance. If typo tolerance is a
  product requirement, choose an external search service or a custom ngram
  index table.
- Keep `studentSchedules`, `studentScheduleEntries`,
  `studentScheduleFriends`, and `schoolDayBlocks` as separate tables.
- Use one mutation to replace a user's schedule entries, with course
  validation and audit logging in the same transaction where possible.
- Keep accepted friendships queryable in both directions, either with two rows
  as today or a normalized pair key plus indexes for each side.

### Announcements

Current behavior:

- Announcements target school-wide, grades, pathways, clubs, or intersections.
- They have comments, read records, bookmarks, archive/expiry, approval,
  moderation, and notification fanout.

Convex design:

- Do not query array fields with scans for target matching at scale.
- Prefer an explicit `announcementAudience` fanout table or precomputed target
  rows when an announcement is created/approved.
- Use paginated queries for feeds and detail queries for comments.
- Read/bookmark records remain separate tables indexed by user and
  announcement.
- Approval/rejection should be mutations with audit events and notification
  side effects in the same transaction when feasible.
- Expiration can be handled by scheduled functions or a query-time status rule;
  choose one product behavior.

### Clubs and Channels

Current behavior:

- Club access is a mix of global roles, membership, custom leader role,
  sponsor status, private channel membership, join requests, invites, and join
  codes.
- Sponsors can see private channels.
- Channels have visibility, messages, replies, rich text, mentions, tag
  mentions, attachments, reactions, pins, polls, moderation, reports, and
  notification delivery.

Convex design:

- Port `ClubAccessPolicy` as pure helper functions first, then use those
  helpers everywhere.
- Keep membership, sponsors, invites, join requests, channels, channel
  memberships, tags, tag members, messages, attachments, mentions, reactions,
  and poll votes as separate tables.
- Message list queries must be indexed by `channelId`, `parentMessageId`, and
  creation/order fields, and must be paginated.
- Reactions and poll votes need unique application checks.
- Attachments should store Convex `storageId`; message rendering can request
  URLs via a query/action pattern that enforces channel access.
- Mentions should resolve users/tags server-side and write mention rows plus
  notification deliveries in a mutation.
- Bulk channel deletion must explicitly delete dependent rows or mark the
  channel deleted and batch cleanup later.

### Events, Calendar, and Flex Friday

Current behavior:

- Event creation, approval, rejection, publishing, cancellation, calendar entry
  sync, and notifications.
- Flex Friday has dates, sessions, workshops, assignments, registrations,
  attendance, credits, and calendar integration.

Convex design:

- Events and calendar entries stay separate tables, but calendar list queries
  should read one bounded, indexed table.
- If event publication creates/updates calendar entries, do it in the same
  mutation.
- Flex capacity checks must be transactional: read workshop/session state and
  existing registrations/assignments, then insert. Avoid post-write cleanup.
- Large attendance bulk updates should batch if rosters can exceed mutation
  comfort limits.
- Credit counts should be stored or maintained if they become hot; do not
  repeatedly scan attendance history for every dashboard render.

### Notifications

Current behavior:

- Notification delivery rows are polled by the frontend.
- Preferences support category plus scope keys for global, club, channel,
  announcement, and event scopes.
- Channel all-message alerts are opt-in; mentions/thread replies are on unless
  disabled.

Convex design:

- Replace polling with reactive queries for inbox and unread count.
- Keep `notificationPreferences` and `notificationDeliveries`.
- Use Aggregate for unread counts by user/category/scope where the UI needs
  exact reactive counts. Use a hand-written per-user summary row only if the
  Aggregate key shape does not fit.
- Rewrite `deliver` to avoid per-recipient preference queries. Use scoped
  preference indexes and batch recipient resolution.
- Use Workpool or scheduled/batched mutations for large school-wide fanout if
  the audience can exceed transaction comfort limits.

### Moderation

Current behavior:

- Local keyword rules are masked first.
- `glin-profanity` runs after local masking.
- Filtered content is saved masked, an automated report is created, the author
  is notified, and an audit event is written.

Convex design:

- Spike whether the profanity library works in the default Convex runtime. If
  it requires Node APIs, choose a browser-compatible filter or run moderation
  through a Node action plus internal mutation.
- Be careful with action/mutation boundaries: content save, report creation,
  notification, and audit should not become inconsistent.
- Keep keyword rules indexed by active status/keyword and treat report queues
  as paginated admin queries.

### Audit and Errors

Current behavior:

- Audit events are database rows.
- 500s are persisted to JSONL files in `ERROR_LOG_DIR`.

Convex design:

- Keep `auditEvents` as append-only application data, with admin-only paginated
  queries.
- Do not attempt filesystem JSONL logging. Use Convex logs, log streams, an
  external exception integration, or a dedicated `serverErrors` table for
  selected sanitized failures.
- Define retention and export expectations before claiming audit parity.

### Uploads and File Storage

Current behavior:

- Multer writes to local disk.
- API serves `/uploads/...` statically.
- Upload endpoints accept flyers, chat attachments, and club images.
- Upload limit is 5 MB.

Convex design:

- Use Convex file storage. Store blobs, then store metadata and `storageId`.
- Use HTTP actions as a multipart/form-data bridge if frontend upload code is
  not immediately rewritten.
- For native Convex storage flows, use the documented upload URL/storage APIs.
- Club image validation must happen server-side; check MIME type and size.
- Decide whether URLs are signed/temporary or public enough for the app's
  sharing model.

### Wrapped and Analytics

Current behavior:

- Wrapped generation uses Prisma counts, groupBy, aggregates, and in-memory
  processing of a user's messages over a school-year range.
- Admin generation loops users and skips existing snapshots unless refreshing.

Convex design:

- Do not port Prisma `count`, `groupBy`, or aggregate calls directly.
- For small school-year datasets, a batched snapshot job may be fine, but it
  must be explicit about function limits.
- For long-term scale, maintain derived metrics as events happen with
  Aggregate where the metric needs count/sum/rank access, Sharded Counter where
  it is a high-write standalone counter, and explicit summary documents where
  the value is domain-specific.
- Snapshot generation should run as batched scheduled internal mutations,
  Workpool jobs, or a Workflow, not a single admin-triggered transaction over
  all users.

## Suggested Phase Plan

### Phase 0: Feasibility and Architecture Signoff

Deliver artifacts only, no porting:

- Auth decision memo.
- Native Convex client decision, with any remaining HTTP actions justified.
- Cloud/self-host/compliance decision.
- Seed/reset plan: how faker-backed demo data becomes Convex fixtures and how
  PostgreSQL data can be wiped or ignored during the switch.
- Convex schema draft with indexes, validators, and high-risk tables called
  out.
- Authorization matrix derived from current code/docs, with source references,
  covering global roles, multi-role users, active/inactive users, club members,
  leaders, sponsors, private channel members, front-office/helpdesk staff, and
  admins.
- Product behavior map from existing feature flows and `apps/web/src/lib/api.ts`
  to Convex functions. Preserve behavior, not old response shapes.
- Contracts decision for the frontend API layer and any remaining non-Convex
  shared product types.
- Component decision map: which domains use Aggregate, Sharded Counter, Rate
  Limiter, Workpool, Workflow, Action Cache, or no component.
- Runtime/dependency audit and environment variable map.
- Folder-structure decision: keep `apps/convex` as the backend app, move
  Convex-owned seed fixtures under `apps/convex/seed-data`, and avoid new
  `packages/*` workspace packages unless code is truly shared by multiple app
  runtimes and is not generated by Convex.
- Docs impact map for every file under `docs/`: keep/rewrite/remove, expected
  phase, and owner. This is required before implementation because the docs are
  part of the repo's source of truth.
- Risk register for search, analytics/counts, bulk fanout, auth, uploads,
  audit retention, and frontend rewrite.

Exit only when those decisions are accepted.

### Phase 1: Convex Foundation

- Add Convex project files.
- Install Convex AI files and commit the managed guidance.
- Add `apps/convex/convex/schema.ts`, generated code, and test setup.
- Add auth provider wiring and `requireCurrentUser` helpers.
- Add minimal users table and identity mapping.
- Add `apps/convex/convex/convex.config.ts` only for approved components, with named
  Aggregate instances for distinct domains/access patterns.
- Lock component/package versions intentionally and document why each component
  is installed. Do not install components speculatively.
- Add CI/dev commands for Convex codegen, explicit `tsc` typechecking, and
  Convex tests.
- Update foundational docs in `docs/architecture/`, `docs/backend/`,
  `docs/database/`, and `docs/frontend/` to describe the new Convex foundation
  as it lands.

### Phase 2: Read-First Vertical Slices

- Courses and current-user profile.
- Schedule dashboard read path.
- Club directory/read-only detail.
- Announcement feed/read-only detail.

Goal: prove schema, auth, client integration, and query/index approach before
high-risk writes.

### Phase 3: Bounded Transactional Writes

- Schedule update and friend requests.
- Announcement create/read/bookmark/comment.
- Club join/invite/request/channel/message/reaction flows for bounded channel
  audiences.
- Event/calendar/Flex Friday workflows where the write can complete inside one
  clear transaction.
- Moderation and audit integration for the above writes.

Each bullet is a set of vertical-slice PRs, not one mega-PR. Keep notification
fanout, uploads, CSV, Wrapped, and other large/background work out of this phase
unless the slice is explicitly bounded and tested.

### Phase 4: Storage, Fanout, Bulk, and Admin Workflows

- Convex storage upload flows and seeded/demo file references if needed.
- Notification delivery, Aggregate-backed unread counts, large fanout, and
  reactive inbox behavior.
- User CSV import/export.
- Club bulk invite import.
- Wrapped snapshot generation.
- Convex seed/import scripts for demo data.
- Future Convex-to-Convex backfills with `@convex-dev/migrations` or batched
  internal mutations only if real data or long-lived dev data exists by then.
- Update admin, storage, seed/reset, and workflow docs for the new bulk and
  background processing model.

### Phase 5: Cutover

- Do not build data-preservation dual-read or dual-write machinery. With no real
  data, prefer a clean switch.
- Compare old and Convex-backed product behavior against seed scenarios and
  critical user journeys. Do not preserve old IDs or REST response shapes unless
  a frontend screen still needs that shape during the rewrite.
- Reset/reseed Convex demo data, verify counts and behavior, switch frontend,
  and keep rollback steps documented.
- Remove or archive obsolete NestJS/Prisma/PostgreSQL execution paths after the
  Convex replacement is accepted. Do not leave two active backends unless a
  temporary phase explicitly requires it.
- Complete a full `docs/` sweep. After cutover, active docs must describe
  Convex as the backend, Convex storage as the upload system, the selected auth
  provider as the auth source, and native Convex functions as the app data API
  except for intentionally retained HTTP actions.

## Verification Expectations

Before ported code is considered equivalent:

- Convex codegen succeeds, generated types are current, and explicit Convex
  `tsc` typechecking passes.
- Convex tests use `convex-test` with Vitest and `edge-runtime`.
- `pnpm lint` and `pnpm build` still pass.
- Existing product behavior has comparison tests or scripted checks for each
  domain ported.
- Auth checks are tested for unauthenticated, inactive, wrong-role, right-role,
  club member, sponsor, leader, and admin users.
- Query tests assert pagination and permission filtering.
- Mutation tests assert side effects: notifications, audit events, reports,
  calendar entries, and counters.
- Component tests register installed Convex components with `convex-test` and
  cover Aggregate/Sharded Counter/Rate Limiter/Workflow behavior where used.
- Seed/reset checks verify document counts, orphan checks, file metadata where
  seeded files exist, and sample user journeys.
- Contracts checks ensure frontend imports no longer depend on removed Nest DTOs
  or Axios response wrappers.
- Docs verification checks every file under `docs/` for stale active-system
  references to NestJS, Prisma, PostgreSQL, Axios API calls, Swagger, local
  upload paths, and old JWT/session behavior. Historical mentions are allowed
  only when clearly labeled.

## Things That Are Easy To Miss

- Better Auth changes frontend auth, not only backend auth. Plan cookie/session
  flow, SSR helpers, and removal of localStorage token state together.
- Convex custom JWT does not accept this app's current HS256 token shape as a
  simple drop-in.
- Existing Prisma CUIDs should be discarded. Do not design around old IDs.
- `packages/contracts` can become a source of accidental legacy coupling. Keep
  only non-transport shared product types that still matter after Convex codegen.
- Prisma array fields like `roles`, target grades/pathways, and course numbers
  should not become scan-based Convex filters.
- Runtime compatibility will bite late if it is skipped. Bcrypt, CSV parsing,
  profanity filtering, file processing, and external integrations each need a
  Convex runtime decision.
- Unread counts, member counts, grouped analytics, and "top X" stats need
  Aggregate, Sharded Counter, explicit derived state, or deliberate bounded
  jobs.
- Local upload URLs must become storage IDs plus access-controlled URL
  generation.
- Swagger docs can disappear for the app backend unless there is an external
  HTTP consumer. Use Convex OpenAPI or hand-written HTTP action docs only for
  real HTTP surfaces.
- Docs drift is a porting bug. This repo tells agents to trust `docs/`, so
  stale architecture/database/frontend docs will actively mislead future work.
- Convex reactivity can make polling code obsolete, but it can also increase
  read amplification if list queries are too broad.
- `Date.now()` inside Convex queries/mutations is deterministic per function
  execution. Do not model long-running time-sensitive logic as repeated
  in-function time reads.
- Actions are not transactions and cannot access `ctx.db`; splitting logic into
  actions can introduce race conditions if not designed carefully.
- Future Convex data backfills and fanouts need batching; a school-wide
  announcement to all users should not assume one mutation can always do all
  work.
- Audit "immutability" is a product/legal question, not a database feature.
- The repo-local Postgres startup in direnv may fail if port 5432 is already in
  use; that does not block planning, but it matters for old-vs-new comparison
  scripts later.
