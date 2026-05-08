---
tags: [feature, wrapped, analytics, year-in-review]
---

# IA Wrapped

← [[index|Home]]

---

## Overview

IA Wrapped is a Spotify Wrapped-style year-in-review experience for each user. It summarizes the user's school-year activity across club channels, reactions, schedule friends, club membership, pathways, and Flex Friday credits.

The feature is available to normal users only during May. Admins and super admins can access it outside the normal availability window.

**Files:**
- Backend: `apps/api/src/wrapped/`
- Web: `apps/web/src/app/wrapped/`
- Shared frontend helper: `apps/web/src/lib/wrapped.ts`

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

---

## Related

- [[diagram-inventory]] — Detailed architecture and feature list
- [[clubs]] — Channel messages, mentions, reactions, and attachments
- [[schedule]] — Schedule friends
- [[flex-friday]] — Credits and pathway workshops
