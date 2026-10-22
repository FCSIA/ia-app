---
tags: [feature, audit, admin]
---

# Audit Log

[Home](../index.md)

The audit log records significant actions for staff review. Read/unread changes
are personal state and do not create events; historical entries remain available.
Admin-facing reads require ADMIN, SUPER_ADMIN, or SUPPORT_STAFF.

## Review activity

`/admin/audit` opens the log. Legacy `/admin?tab=audit` links still work. Admin
sections use a grouped sidebar on desktop, an icon rail at intermediate widths,
and a section picker on smaller screens. Audit filters remain in the URL when
switching sections.

The desktop table separates When, Person, Action, Record, and Where. Events use a
single line, minute-level times, day headings, and full timestamps in Details.
Neutral category icons identify six domains: People & access, Clubs & chat,
Announcements, Moderation, Schedules, and Flex & events. Destructive action text
uses the destructive token. Selecting a row or its keyboard-accessible Details
button opens the event; closing Details returns focus to the opener.

Person controls open the shared profile preview with a filter action, full
profile, Open in Users, and Copy ID. Users links open the exact account through
the existing staff permission gate. Live records and parent context are links;
unavailable records keep saved names/previews without a dead primary link.
Original IDs, action codes, metadata, and timestamps remain in the collapsed
Technical details section. Meaningful message changes, CSV counts, role changes,
and other allowlisted metadata are shown outside that section. Whiteboard
snapshots remain available.

On phones, the log uses two-line interactive Cards and filters open in a bottom
Drawer with a persistent Show events footer. The Cards retain the existing
primitive geometry; the October 22 fixture measured 72.25px per item. Material
visual changes await design-owner review; the audit's 56px/ten-visible-item
proposal is not implemented. See the repair ledger for all remaining scope.

## Filters and search

When, Person, Action, and Record header controls open their own popovers.
Category and action checklists support multiple choices: choices within one
checklist combine with OR, and separate filters combine with AND. Category
changes remove selected actions outside the selected domains. Exact person and
record filters use stable IDs. Date controls include both selected local days.
Each explicit filter has a removable chip; Clear all resets the search and fields.

The main search accepts text and structured terms. Typing a supported field
prefix opens Command suggestions for people, actions, types, loaded records,
sources, or date examples. Arrow keys and Enter select a suggestion. Invalid
unfinished queries show an error and keep the last applied URL and results.
Typed fields replace the corresponding explicit field filter; explicit fields
remove corresponding typed terms, avoiding contradictory duplicate controls.

```text
person:"Eniola Famakinwa" action:"Posted a message"
type:message -action:reaction "room assignments"
record:Robotics after:2026-10-01 before:2026-10-02
source:system
```

Supported fields are `person`, `action`, `type`, `record`, `text`, `source`,
`after`, and `before`. Terms combine with AND, match case-insensitive substrings,
and support double-quoted phrases; prefix a term with `-` to exclude it. Plain
words search recorded fields. `source` accepts `person` or `system`. Structured
dates include both UTC calendar days; date-picker fields use local time.
Original action codes remain searchable even if a future code has no registry entry.

`audit_` search parameters store the query, exact actor/record, selected actions
and categories, source, record type, and dates. Reloading or sharing a valid URL
restores those filters. Previous results remain visible while filters refresh,
scoped to the signed-in identity, with an Updating status. Initial loading uses
skeleton rows while retaining the table header.

## Backend and historical rollout

Every application audit writer calls `logAuditEvent` with a required actor ID or
explicit `"system"`. The helper records semantic category, impersonation
provenance, and both aggregate entries atomically. Missing historical actors are
Unknown (not recorded), not automatically System; a missing current actor is a
Former user. System classification requires explicit provenance or a known
automatic action. A source scan test rejects direct domain audit inserts.

`listPage` chooses indexed actor, record/type, category, action, or date ranges.
Multiple actions/categories and historical type aliases merge ordered index
streams before pagination. Remaining predicates run before pagination through
`convex-helpers` streams with a 1,000-document / 4MB page read budget. Context and
actor resolution are memoized per request. Selective text searches can still
return a partial or empty page at that budget; Load older activity continues the
cursor. The legacy bounded `list` API still hydrates and filters its bounded feed.

The `@convex-dev/aggregate` category and actor indexes provide exact totals for
category, actor, and date filters. Other combinations, including actions, record
type/ID, source, and free text, show a candidate-range denominator explicitly
labelled events in range, not an exact match total. True exact totals for those
predicates need additional aggregate/search indexes or a complete scan; the
current query deliberately avoids an unbounded count scan.

Historical indexing is a separate deployment operation. The bounded, idempotent
`internal.audit.migrations.backfill` processes 100 records per transaction,
backfills category, recovers legacy CLUB_JOINED actors from retained `meta.userId`
when possible, inserts missing aggregate entries, and schedules the next page.
Only completion marks `auditIndexState` key `v1` ready. Until then category queries
fall back to chronological filtering and the UI shows loaded counts. Other lost
human attribution cannot be reconstructed. This repair did not deploy or invoke
the migration. Deploy/run only against an explicitly authorized target.

## Source and API

- Backend: `apps/convex/src/audit/`
- Shared registry, labels, metadata presentation and grammar: `apps/shared/audit.ts`
- Web: `apps/web/src/app/admin/_hooks/use-admin-audit.ts` and `_components/audit/`
- Shared person preview: `apps/web/src/components/users/person-trigger.tsx`
- `api.audit.events.list`: bounded legacy/mobile read
- `api.audit.events.listPage`: filtered cursor history
- `api.audit.events.listFilterOptions`: static action/type registry
- `api.audit.events.counts`: readiness-gated totals and category facets
- `api.audit.events.get`: full event and record preview

## Related

- [October 22 repair ledger](../reference/ui-audit-log-repairs-2026-10-22.md)
- [October 20 UI review](../reference/audit-ui-review-2026-10-20.md)
- [Users and admin](users-admin.md)
- [Moderation](moderation.md)
- [Indexes and search](../database/indexes-and-search.md)
