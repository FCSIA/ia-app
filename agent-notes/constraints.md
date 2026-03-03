# IA School App Constraints

## Product Constraints
- Single-school only.
- No parent/guardian accounts.
- No direct 1:1 messaging.
- Clubs must remain invite-only and member-visible only.
- Club events cannot be visible before sponsor approval.
- Expired announcements must archive automatically.

## Data and Privacy Constraints
- Keep profile data minimal: first name, last name, unique ID, grade level.
- Avoid unnecessary PII collection.
- Maintain immutable audit records for critical actions.

## Role and Governance Constraints
- Global role model with multi-role support.
- Super Admin controls initial user and role setup.
- Sponsors can assign eligible student roles in club context.

## Operational Constraints
- One unified calendar feed with user-level filters.
- Reporting and keyword moderation are mandatory.
- Notifications must support preference controls.
- Admin general announcements override preferences and notify all users.

## Scheduling Constraints
- Must model regular days, Club Weeks, and Flex Friday variants.
- Must account for no-school Friday PD scenarios.
- Must support both teacher-assigned and student-selected Flex Friday sessions.

## Cost and Platform Constraints
- Selected tech stack must be fully free.
- Do not rely on free tiers of paid services.
- Do not rely on trial-based services.
- Prefer open-source and self-hosted components where practical.

## Collaboration Constraints
- `tasks.md` is primarily user-maintained.
- Assistant-maintained working state should stay updated in:
  - `context.md`
  - `current-focus.md`
  - `decisions.md`
  - `progress-log.md`
  - `constraints.md`

## Technical Constraints (Implementation Snapshot)
- Core identity/content governance modules now persist in PostgreSQL (users/roles, auth sessions, announcements, audit events).
- Events and calendar workflows now persist in PostgreSQL with approval-gated publish behavior for club events.
- Flex Friday, reports, moderation keyword rules, and notification preferences now persist in PostgreSQL.
- Notification delivery fanout is now persisted for announcement/event flows, including admin-general override enforcement.
- Remaining major intentional gap: CSV import completion is deferred by stakeholder sequencing decision.
- Localhost-first runtime is functional with Docker Compose assumptions; server deployment scripts remain to be completed.
