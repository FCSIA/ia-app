---
tags: [database, indexes, search, convex]
---

# Indexes and Search

[Home](../index.md)

Convex queries should use indexes for hot paths. Small seeded lists can be
filtered in TypeScript, but production-scale paths need explicit indexes or
search indexes.

## Existing Search Indexes

- `users.search_users` supports people search.
- `courses.search_courses` supports course search.

## Important Read Indexes

| Domain | Examples |
| --- | --- |
| Users | `by_authUserId`, `by_uniqueId`, name/role list indexes |
| Audit | `by_createdAt`, `by_actorId_and_createdAt`, entity lookup |
| Notifications | `by_userId_and_createdAt`, `by_userId_and_isRead_and_createdAt` |
| Courses | `by_slug`, `by_title`, department/pathway indexes |
| Schedule | schedule owner, entries by schedule/day/period, friendships |
| Clubs | members by user/club, channels by club, messages by channel/thread |
| Events | `by_clubId`, `by_status`, `by_startAt` |
| Calendar | `by_startAt`, linked event/flex Friday rows |
| Flex Friday | Friday date, session/workshop/roster relationships |
| Moderation | keyword lookup, reports by status/created time |
| Wrapped | user and school-year lookup |

## Scaling Notes

- Move bounded preview reads to cursor pagination before real data volume grows.
- Use search indexes for broad text search instead of scanning large tables.
- Exact unread counts may need a counter-backed design before production scale.
- Audit search currently hydrates some fields after pagination; add indexed or
  search-specific fields if audit volume becomes large.

## Related

- [Schema map](schema-map.md)
- [Notifications](../features/notifications.md)
- [Audit log](../features/audit-log.md)
