# Idiomatic Convex Refactor TODO

This note was salvaged from PR #27 after deciding not to merge that stale
branch. It is planning-only; do not start implementation from this file without
first re-reading:

- `AGENTS.md`
- `apps/convex/src/_generated/ai/guidelines.md`
- Current Convex docs for CLI import/export behavior
- Better Auth Convex component docs/source for table ownership expectations

## Goals

- Reduce invalid states in Convex schemas, especially user role/classification
  data.
- Move demo seeding toward an explicit CLI flow instead of dashboard-only
  internal reset calls.
- Keep seed data reproducible, reviewable when needed, and ignored by git by
  default.

## User Schema Audit

- Treat `roles` as the source of truth, or make any derived booleans impossible
  to update outside one helper.
- Audit `users` fields that duplicate role information:
  - `isStudent`
  - `isTeacherStaff`
  - `isStudentAdmin`
  - `isOtherRole`
- Decide whether these booleans are still worth storing for index/search
  performance. If they stay stored, enforce writes through a single
  `classifyRoles` path and add tests for every role combination.
- Audit all mutations that modify users:
  - admin create/update/import
  - auth/link creation
  - seed creation
  - any future profile/admin role editing path
- Check whether `STUDENT_ADMIN` should imply `isStudent` everywhere. Current
  helpers are inconsistent and can represent contradictory states.
- Avoid compatibility aliases or broad cleanup that hides the actual invariants.

## Notification Schema Follow-up

- Confirm the new `notificationDeliveries.subject` union covers every producer
  and route target without optional entity-id bags.
- Add narrow tests for subject validation and href generation.
- Audit notification preference scopes for school-wide, major/pathway, club,
  channel, mentions, notify-all channels, Flex Friday, events, and moderation.
- Decide whether channel all-message notifications should default off or be
  explicitly initialized per membership/channel.

## Seed Architecture

- Replace dashboard-only demo seeding with a CLI-oriented flow exposed as
  `bun run dev:seed`.
- Generate deterministic JSON import files with fixed-seed `@faker-js/faker`.
- Store generated files in a gitignored directory by default, for example:
  - `.generated/convex-seed/`
  - or `tmp/convex-seed/`
- Keep source seed definitions in TypeScript, not hand-edited generated JSON.
- Make generated output deterministic enough that diffs are meaningful when
  intentionally inspected.
- Decide whether the seed command should:
  - wipe/import all owned tables
  - import only app-owned tables and separately clear auth tables
  - support dry-run/generate-only/import-only modes

## Convex Import CLI Research

- Verify the current recommended Convex CLI command for table imports.
- Confirm JSON format requirements:
  - array vs JSONL
  - Convex IDs
  - `_creationTime`
  - table references
  - replace vs append semantics
- Confirm whether imports can safely target tables owned by Convex components.
- Confirm how imports behave for indexes and generated schema validation.
- Confirm the right workspace command shape. Do not run Convex commands from the
  repository root; use `bun run --filter cvx ...`.

## Better Auth Tables

- Determine whether Better Auth component tables should be imported directly.
- Prefer documented Better Auth/Convex component APIs if direct imports are not
  supported or would violate component ownership.
- If auth table import is not safe, design a seed flow that creates app users
  through app mutations and auth users through supported component APIs.
- Confirm whether password hashes/session records should ever be part of demo
  import data.

## App Stats and Counts

- Revisit whether `appStats` counters should remain app-owned counters or move
  to `@convex-dev/aggregate`.
- Use `@convex-dev/aggregate` only if the product needs indexed/ranged counts,
  pagination offsets, or ranking queries.
- If counters stay, add tests around create/delete/reset/rebuild paths and
  document the one-time rebuild needed for existing deployments.

## Admin Dashboard UI

- Add an admin-visible user count surface only after the backend invariant work
  is settled.
- The UI should read a small stats query, not fetch or derive from all users.
- Show at least total users, students, staff, and last updated time.

## Verification Plan

- Run the narrowest checks first:
  - `bun run --filter cvx codegen`
  - `bun run --filter cvx typecheck`
  - focused seed script tests once added
- Run broader checks before merging:
  - `bun run --filter web build`
  - `bun run lint`
- Test seed flow against a disposable Convex dev deployment before touching any
  shared development deployment.
