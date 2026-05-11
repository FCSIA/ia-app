---
tags: [feature, wrapped, analytics, year-in-review]
---

# IA Wrapped

← [[index|Home]]

---

## Overview

IA Wrapped is a Spotify Wrapped-style year-in-review experience for each user. It summarizes the user's school-year activity across club channels, reactions, schedule friends, club membership, pathways, and Flex Friday credits.

The feature is available to normal users only during May. Admins and super admins can access it outside the normal availability window.

Wrapped summaries are stored as annual `WrappedSnapshot` rows. The snapshot keeps the student-facing experience fast and stable during the May traffic spike while still letting admins regenerate data after source-record corrections. The API falls back to generating a missing current snapshot for the requesting user, but the intended launch flow is to pre-generate snapshots before the window opens.

**Files:**
- Backend: `apps/api/src/wrapped/`
- Web: `apps/web/src/app/wrapped/`
- Shared frontend helper: `apps/web/src/lib/wrapped.ts`
- Database: `WrappedSnapshot` plus indexed source tables for channel messages, reactions, mentions, friendships, club membership, and Flex attendance

---

## School Year Window

Wrapped uses the school year as its reporting range:

```text
August 1 through July 31
```

The May window summarizes the school year that started the previous August. For example, May 2026 summarizes the 2025-26 school year.

---

## Reported Stats

| Stat | Meaning |
|------|---------|
| `messagesSent` | Number of club channel messages the user sent during the school year |
| `channelsEngaged` | Distinct club channels the user posted in |
| `friends` | Accepted schedule friends added during the school year |
| `clubs` | Clubs the user belonged to by the end of the reporting window |
| `flexCredits` | Present Flex Friday attendance count |
| `flexCreditsRequired` | Annual requirement, currently 12 |
| `pathwayFlexCredits` | Present Flex Friday workshops that targeted the user's major pathway |
| `topChannel` | Channel and club where the user sent the most messages |
| `topMentioned` | User most frequently mentioned by this user |
| `pathway` | Major, minor, lanyard color, pathway label, and active peer count |
| `mostUsedWord` | Most common non-stopword in the user's messages |
| `peakHour` | Hour of day with the most messages, using America/New_York time |
| `longestStreak` | Longest consecutive daily message streak |
| `mostActiveDay` | Calendar day with the most messages |
| `reactionsReceived` | Total reactions on messages written by the user |
| `topEmoji` | Emoji most often used by the user in reactions |
| `longestMessageChars` | Character count of the user's longest message |

---

## Frontend Experience

The web page builds an animated slide deck from the summary:

- Intro slide with the user's name.
- Message count and approximate weekly rate.
- Peak hour.
- Most active day.
- Longest posting streak.
- Word of the year.
- Channels engaged.
- Top channel.
- New friendships.
- Most-mentioned user.
- Club count.
- Pathway slide with lanyard color, peers, and pathway workshop credits.
- Flex Friday credits versus the 12-credit requirement.
- Reactions received and favorite emoji.
- Outro slide.

The slide deck uses GSAP animations, themed gradients, and per-slide visual graphics.

---

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| GET | `/wrapped/availability` | Returns whether Wrapped is currently open and when the next window opens |
| GET | `/wrapped/me` | Returns the authenticated user's Wrapped summary |

Admins can pass a school year query when requesting `/wrapped/me`; normal users are limited to the currently open Wrapped window.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/wrapped/admin/snapshots/status?schoolYear=2025` | Admin-only snapshot coverage and freshness for a school year |
| POST | `/wrapped/admin/snapshots/generate` | Admin-only generation or refresh for all eligible students or selected user IDs |

Generation payload:

```json
{
  "schoolYear": 2025,
  "userIds": ["user-id-1"],
  "refresh": false
}
```

`userIds` is optional. If omitted, the service targets active student-style users (`STUDENT`, `STUDENT_LEADER`, `STUDENT_ADMIN`). `refresh: false` skips snapshots already generated with the current schema version; `refresh: true` rebuilds them.

---

## Data Strategy

Wrapped uses a Prisma-managed snapshot table instead of PostgreSQL materialized views. Materialized views are useful for repeated aggregate reads, but PostgreSQL refreshes them on demand and Prisma does not model materialized views directly. A first-class snapshot row better matches this app's existing NestJS + Prisma style:

- Student reads are a single indexed lookup during the high-traffic May window.
- Students see stable school-year results rather than changing numbers during the experience.
- Admins can check coverage and regenerate snapshots after data fixes.
- Admin analytics can sort/filter scalar metrics without unpacking the full JSON summary.

The snapshot stores the full public `WrappedSummary` JSON plus scalar metrics such as messages sent, Flex credits, reactions received, and longest streak. If the summary schema changes, bump the schema version and regenerate snapshots.

---

## Related

- [[diagram-inventory]] — Detailed architecture and feature list
- [[clubs]] — Channel messages, mentions, reactions, and attachments
- [[schedule]] — Schedule friends
- [[flex-friday]] — Credits and pathway workshops
