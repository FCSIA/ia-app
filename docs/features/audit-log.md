---
tags: [feature, audit, admin]
---

# Audit Log

[Home](../index.md)

The audit log records significant system actions for admin review.
Read/unread changes are personal state and do not create audit events. Historical
read/unread entries remain available.

## What It Does

- Shows who acted, what happened, the related record, and the exact time in everyday language.
- Resolves related people, clubs, channels, workshops, and other named records without changing stored audit data. Saved names/titles take precedence; related names reflect current records. Deleted people remain distinguishable from automatic system activity, and their original IDs remain available.
- Defaults to **All** activity. General and Flex & Events offer narrower views; both historical camel-case and uppercase categories are recognized.
- Uses cursor pagination across the complete history, newest first by recorded time (with creation time and ID breaking ties). Filters apply before the page target. A bounded scan can still return a partial or empty batch; the older-history control continues from its cursor. Counts describe matching records loaded, not all matches, until **End of history**.
- Keeps all original action codes, IDs, timestamps, and metadata in **Details → Original data and IDs**. Whiteboard snapshots and links remain available.
- Places activity views, search, and a compact Filters trigger together on desktop. Filters expand inline into one, two, or four columns; advanced search stays inside that disclosure. Applied field filters remain visible when collapsed. The visible search value is not repeated underneath it.
- Pairs the record category with a concise action, then shows the affected record beneath it. Existing `action` and `entityType` fields remove duplicate nouns without changing stored codes. Desktop rows keep bounded Person and When columns; narrower screens fold those values into the activity cell.
- Limits long record titles, person names, context, message previews, and unknown categories to two lines in the table. Details preserve complete content and original data. Closing Details returns keyboard focus to the row's opener.
- Emphasizes actions, with consistent compact record-category colors across additions and deletions. Text retains the theme's foreground contrast; IDs and timestamps remain secondary. An ID appears in the table only when a record title is unavailable.

## Search

Basic search includes names, readable action labels, record context, and recorded metadata. The Person field accepts full names and IDs. From/To controls use inclusive boundaries in the browser's local timezone.

**Advanced search** applies a query explicitly, in combination with the selected view and other controls. Invalid drafts show an error and leave the last applied query unchanged. Clear resets both the applied query and its draft.

```text
person:"Eniola Famakinwa" action:"message posted"
type:message -action:reaction "room assignments"
record:Robotics after:2026-10-01 before:2026-10-02
source:system
```

Supported fields: `person`, `action`, `type`, `record`, `text`, `source`, `after`, and `before`. Terms combine with AND, match case-insensitive substrings, and support double-quoted phrases. Prefix a term with `-` to exclude it. Plain words search all recorded fields. `source` accepts `person` or `system`. Advanced date terms use inclusive UTC calendar dates. Queries accept original codes, including older actions absent from the dropdown suggestions.

## Source Files

- Backend: `apps/convex/src/audit/`
- Shared logger and hydration: `apps/convex/src/audit/_lib.ts`
- Bounded context resolution: `apps/convex/src/audit/_context.ts`
- Shared labels and query grammar: `apps/shared/audit.ts`
- Web: `apps/web/src/app/admin/_hooks/use-admin-audit.ts` and `apps/web/src/app/admin/_components/audit/`

## Convex Surface

- `api.audit.events.list` (bounded legacy/mobile read)
- `api.audit.events.listFilteredPage` (bounded, pre-filtered cursor history)
- `api.audit.events.listPage` (legacy native-cursor history for existing clients)
- `api.audit.events.listFilterOptions` (suggestions from the latest 500 events)
- `api.audit.events.get`

## Data Model and Permissions

`auditEvents` stores actorId, action, entityType, entityId, meta, and createdAt. Admin-facing reads require ADMIN, SUPER_ADMIN, or SUPPORT_STAFF. Unauthorized clients receive no rows, related names, options, or details.

Domain mutations call `logAuditEvent` after significant writes, including message changes/reactions and whiteboard edits. Stored event data is not rewritten by name resolution or search.

New announcement comment events preserve their announcement ID and title in the
existing metadata field, so the parent remains identifiable after deletion. This
does not retain comment text or migrate older events that lack the relationship.

## Known Limits

Full-name, metadata, category, and advanced filters run on hydrated rows during a bounded scan of the timestamp index. Date controls range that index; exact action and record-type checks run before hydration. Each query stops after at most 100 audit rows or once audit-document bytes reach 2 MiB (which may be exceeded by the last row), so sparse searches can still require multiple older-history requests. Related records are memoized within each query, but their reads and bytes are additional to those audit-row limits. Search cost grows with the history scanned; add dedicated indexed/search fields before large production audit search. Unavailable records retain the type and original ID.

## Related

- [October 20 UI review](../reference/audit-ui-review-2026-10-20.md)
- [Users and admin](users-admin.md)
- [Moderation](moderation.md)
- [Indexes and search](../database/indexes-and-search.md)
