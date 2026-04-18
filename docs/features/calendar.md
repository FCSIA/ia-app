---
tags: [feature, calendar]
---

# Calendar

← [[index|Home]]

---

## Overview

The calendar displays school events and custom entries on a monthly grid. Users can click days to see what's scheduled and navigate between months.

**Files:**
- Backend: `apps/api/src/calendar/`
- Web: `apps/web/src/app/calendar/`
- Database: [[schema#CalendarEntry]]

---

## Two Sources of Data

The calendar shows entries from two places:

1. **CalendarEntry records** — standalone entries created directly (e.g., school holidays, testing days, non-event dates)
2. **Published Events** — when an event reaches `PUBLISHED` status, it automatically creates a linked `CalendarEntry`

Both appear the same on the calendar grid.

---

## CalendarEntry Model

```prisma
model CalendarEntry {
  id          String    @id
  eventId     String?   // null for standalone entries
  title       String
  description String?
  location    String?
  startAt     DateTime
  endAt       DateTime
  tags        String[]  // e.g. ["holiday", "club", "academic"]
}
```

`tags` allow filtering: show only academic events, hide PD days, etc.

---

## The Calendar Grid

The web calendar page:
- Renders a monthly grid (6 rows × 7 columns)
- Highlights today's date with an orange glow
- Shows event chips (small colored pills) on each day
- Clicking a day shows the selected day's events in a panel below
- Previous/Next month navigation

---

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| GET | `/calendar` | All entries in a date range |
| POST | `/calendar` | Create manual entry (restricted roles) |

### Query Parameters (GET)
- `startDate` — filter entries after this UTC date
- `endDate` — filter entries before this UTC date
- `tags` — comma-separated tag filter (e.g. `?tags=holiday,academic`)

---

## Related

- [[events]] — Published events create calendar entries automatically
- [[flex-friday]] — Flex Friday dates appear on the calendar grid

