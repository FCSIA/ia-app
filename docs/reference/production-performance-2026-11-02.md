---
tags: [performance, audit, production]
---

# Production performance review — November 2, 2026

The owner authorized authenticated profiling of `app.fcsia.com`, followed by
focused fixes and a release. Baseline web build: `c9b12fc`, v0.8.41 alpha.
Backend: `elated-anaconda-301`. No production fixtures, content, passwords,
session tokens, or raw logs are included here.

## Method and limits

Exercised dashboard, announcements, clubs, a club chat, schedule, calendar,
events, Flex Friday, analytics, audit, and notifications as a super admin.
Captured 864 bounded runtime events through the Convex CLI, including nested
component calls and repeated presence updates. Ranked distinct application
queries using uncached completion execution times. These timings exclude
browser/network latency. This is a small observational sample, not a load test
or a claim about the five slowest functions under every user/workload.

The 72-hour Health report contained isolated presence/auth concurrency retries,
and no resource-limit insights. Admin access and empty feeds do not represent
the experience of a student with populated personal data.

## Five slowest distinct application queries observed

| Query | Samples | Median ms | Maximum ms | Maximum documents read | Matching optimization |
| --- | ---: | ---: | ---: | ---: | --- |
| `audit/events:listPage` | 2 | 365.9 | 503.3 | 411 | Filter before joins; parallel independent actor/context reads |
| `moderation/reports:listFeedback` | 1 | 460.1 | 460.1 | 436 | Parallel independent report relationship reads |
| `presence/status:clubStatuses` | 2 | 318.7 | 322.6 | 46 | Parallel independent per-person presence reads |
| `moderation/reports:list` | 4 | 202.8 | 306.4 | 130 | Same shared report serializer as feedback |
| `clubs/channels:getMessagePage` | 1 | 220.3 | 220.3 | 79 | Parallel independent reactions/attachments reads |

## Changes and expected effects

- `apps/convex/src/audit/_filters.ts` and `events.ts`: reject stored-field
  mismatches before hydration. Candidate event rows are still read, and cursor
  boundaries are unchanged. Joins for rejected candidates disappear. The gain
  depends on filter selectivity; unfiltered history has the same read set.
- `apps/convex/src/audit/_lib.ts`: actors and context resolve concurrently.
  Detail context and whiteboard preview also resolve concurrently in `events.ts`.
  Existing per-page deduplication remains.
- `apps/shared/audit.ts`: empty search terms return immediately instead of
  building name/label/reference strings and serializing metadata for every row.
- `apps/web/src/app/admin/_hooks/use-admin-audit.ts` and `audit-tab.tsx`:
  filter suggestions subscribe only while the existing Filters disclosure is
  open. Baseline suggestions took 144–188 ms and read 503 documents for a
  roughly 1 KB result. Closed Filters now eliminates that subscription. Selected
  action/type values remain available while suggestions reload on reopening.
- `apps/convex/src/moderation/reports.ts`: independent relationship reads run
  together, followed by concurrent image URL and response-author hydration.
  Expected benefit: fewer serial I/O stages, with identical limits and read set.
- `apps/convex/src/presence/status.ts`: members/sponsors read concurrently;
  each person's presence lookup runs independently. Offline people still skip
  Do Not Disturb reads. Deduplication, ordering, access gates, and limits remain.
  Expected benefit: remove the per-member serial latency sum.
- `apps/convex/src/clubs/channels.ts`: reaction and attachment summary reads
  run concurrently. Deleted-message suppression, chronological attachments,
  caps and truncation indicators remain unchanged.

No numeric speedup is promised before deployment measurements. Parallel reads
reduce serial work but cannot eliminate authentication, database scheduling,
network latency, or unrelated query stages. No schema migration or dependency
upgrade is required.

## Other tweet cases

The measured paths are database-I/O dominated. The sample does not justify
replacing hash maps with indexed arrays, bit packing, or changing object layout
to structures of arrays. Existing audit request-local memoization prevents
duplicate reads; removing it would add work. No new result cache is introduced.
Browser/user hydration caches were not established as a bottleneck by this pass.

## Validation

- All 464 backend tests across 88 files pass, including existing presence,
  moderation, chat, authorization and pagination coverage.
- A new audit regression compares stored-field-prefiltered results with fully
  hydrated matching across action, type, category, source, record substring,
  date, person and structured searches, traversing original cursor boundaries.
- Backend/web typechecks, web lint and production web build pass. Web lint
  retains 21 existing warnings.
- Before release, the initial audit table contains 250 rows. A SHA-256 of their
  visible text is `4ca818bc1da43492aff5b5e9dc5d69c99fc2695b4af6d0c48c91baa9f0270f48`.
  This supports a post-release comparison without retaining personal content.
