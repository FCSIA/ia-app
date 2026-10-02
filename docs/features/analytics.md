---
tags: [feature, admin, analytics]
---

# Admin analytics

[Home](../index.md)

The **Analytics** tab in the admin panel shows super admins how the app is
used: notification reach and read times, push health, chat and announcement
activity, moderation workload, and Flex Friday fill. Only `SUPER_ADMIN` can
open the tab or call its functions.

## How the numbers are made

A nightly cron (`roll up admin analytics`, 04:30 New York) writes one small row
per kind of activity per school day to `analyticsDaily`. The dashboard reads
those rows and never scans messages, deliveries, or reports itself.

| Kind | Covers | Source |
| --- | --- | --- |
| `notifications` | Deliveries created that day, read share, time to first read | `notificationDeliveries` |
| `chat` | Messages, thread replies, people who posted, messages per club | `clubChannelMessages` |
| `announcements` | Readers in each announcement's first 24 hours | `announcements`, `announcementReads` |
| `moderation` | Reports opened and reviewed, time to review, backlog | `moderationReports` |
| `pushHealth` | What each device last reported about push, per platform | `notificationPushDevices` |
| `flex` | Registrations against capacity for Flex Fridays three weeks either side of today | `flexFridays`, `flexRegistrations` |

- Days are school days on the school's own clock (America/New_York), including
  the 23- and 25-hour days when the clocks change.
- Yesterday is counted once it has ended. Announcements wait an extra day so
  every one has had 24 hours to be read.
- Deliveries and messages are counted in resumable batches by creation time, so
  a busy day never hits a transaction limit.
- Rows hold counts only. Chat authors are tracked while a day is being counted,
  so people aren't double-counted, and dropped when the day completes.
- Push health and the moderation backlog are readings at the moment the cron
  runs, so they can't be recovered for past days.
- Time to first read uses `notificationDeliveries.readAt`, recorded from the
  release that added it. Older reads count as read but have no time.

## Filling in history

Days before analytics shipped have no rows. When a range includes them, the tab
shows how many days are counted and offers **Fill in history**, which calls
`api.analytics.dashboard.fillHistory` for up to 90 days. It skips days already
counted, so repeating it is harmless, and spreads the work out a second apart.
Filled-in days record no moderation backlog rather than today's.

## Reading the charts

- Each chart plots one series in `--chart-1`, the theme color that keeps at
  least 3:1 contrast against cards in every theme. Breakdowns use one color per
  chart (bar lists, tables) instead of a categorical palette.
- Trends span the whole selected range; uncounted days are left as a gap rather
  than dropped, so a partly counted range never looks complete.
- Every chart has a **Table** toggle with the same values.

## Source files

- Rollups: `apps/convex/src/analytics/rollups.ts`
- Summaries (pure, unit-tested): `apps/convex/src/analytics/_summaries.ts`
- School-day boundaries: `apps/convex/src/analytics/_days.ts`
- Dashboard queries and fill-in: `apps/convex/src/analytics/dashboard.ts`
- Tab: `apps/web/src/app/admin/_components/analytics/`

## Related

- [Notifications](notifications.md)
- [Moderation](moderation.md)
- [Flex Friday](flex-friday.md)
