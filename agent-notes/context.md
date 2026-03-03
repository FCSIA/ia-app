# IA School App Context

## Organization Scope
- Single school deployment (IA only).
- Users are students and school staff.
- Accounts are pre-created through CSV imports.

## Identity and Profile Data
- Required profile fields: first name, last name, unique ID, grade level.
- Avoid storing additional PII beyond operational needs.

## Roles
- Student
- Student Leader
- Student Admin
- Teacher
- Sponsor
- Support Staff
- Admin
- Super Admin

## Role Assignment Rules
- Super Admin performs initial account creation and role assignment.
- Sponsors can assign roles to existing students for club operations.
- Multi-role users are expected and allowed.
- Roles are global.

## Channels and Areas
- Flex Friday
- Clubs
- Calendar

## Club Model
- Clubs are invite-only.
- Club content is visible only to club members.
- Multiple sponsors per club are supported.
- Sponsor approvals can happen asynchronously.
- Club communication is announcement-centric with optional comments per post.

## Announcement Model
- Admin channel: restricted posting permissions.
- Teacher announcements are allowed when role is assigned.
- Announcements can be school-wide or targeted to subsets (grade/pathway).
- Announcements can include expiration timestamps.
- Expired announcements auto-archive and remain accessible in old/archived views.

## Event Model
- General events: Admin and Support Staff can post.
- Club events: Student Leader drafts, Sponsor approval required.
- Club events are invisible until approved.
- On approval, publish event and release announcement.
- Event detail includes description, optional flyer, time, and location.

## Calendar Experience
- Single unified calendar feed.
- Student-level filtering based on onboarding preferences.

## Communication and Safety
- No 1:1 DMs.
- Reporting system required.
- Keyword filtering required.
- Audit log required for every important action.

## Schedule Context (Appendix)
- Mon-Thu regular day: 8 periods, 8:55 AM to 4:15 PM.
- Lunch is in period 4 or 5.
- Club Weeks occur monthly with a flex club period between period 4 and 5 (typically Tue-Thu).
- Club Week Mondays are used for other activities.
- Flex Fridays run a shorter 4-period schedule.
- Some Fridays are freshman workshops, pathway-specific, or all-student.
- Friday teacher PD means no school session.
- Students register for some Flex Friday sessions; some sessions are teacher-assigned.

## Execution Context Addendum (2026-03-02)
- The primary execution roadmap now lives in `agent-notes/plan.md`.
- Work will be delivered in phased increments from foundation/auth to feature modules, then hardening and launch.
- `tasks.md` remains the high-level product directive; `plan.md` is the implementation decomposition.

## Implementation Context Addendum (2026-03-02)
- Monorepo scaffold implemented using `pnpm` workspaces + Turborepo.
- Apps created:
  - `apps/api` (NestJS)
  - `apps/web` (Next.js PWA shell)
- Shared contracts package created at `packages/shared-types`.
- Local infra created with PostgreSQL + Redis via Docker Compose.
- Initial SQL schema created for all planned core tables in `infra/docker-compose/initdb/001_schema.sql`.

## Persistence Context Addendum (2026-03-02)
- Backend now includes a shared PostgreSQL `DatabaseService` (`pg` pool).
- User storage moved from in-memory to PostgreSQL with role joins (`users`, `roles`, `user_roles`).
- Session storage moved from in-memory map to PostgreSQL (`auth_sessions`).
- Announcement storage moved from in-memory to PostgreSQL (`announcements`, `announcement_targets`) with DB-driven expiration archiving.
- Audit logging moved from in-memory array to PostgreSQL (`audit_events`).
- Event workflows now persist in PostgreSQL (`events`, `event_approvals`) with publish-on-approval behavior.
- Calendar feed now reads persisted `calendar_entries` populated by event publish transitions.
- Flex Friday workflows now persist in PostgreSQL (`flex_sessions`, `flex_assignments`, `flex_registrations`) with conflict checks.
- Reports and moderation keyword management now persist in PostgreSQL (`reports`, `keyword_rules`).
- Notification preferences now persist in PostgreSQL (`notification_preferences`) with default-on bootstrap behavior.

## Full-Pass Context Addendum (2026-03-02)
- Clubs module is now DB-backed (create, invite, club role assignment, sponsor mapping).
- Announcement and event creation now trigger keyword scanning and persistent keyword match records.
- Announcement and event publication now record notification deliveries in `notification_deliveries`.
- Admin-general school-wide announcements enforce notify-all behavior regardless of user preference state at delivery fanout.
- Web app evolved into an operational control panel with live actions for major backend workflows.
