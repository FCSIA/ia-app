---
tags: [feature, schedule, students, admin]
---

# Schedule

← [[index|Home]]

---

## What It Does

The schedule workspace gives students a Saturn-style class grid and lets admins define the bell schedule that powers live class detection.

---

## Student Flow

- Students open `/schedule` from the left navigation.
- They build their 5-day schedule by selecting official **Courses** for each period.
- They choose whether their schedule is public or private.
- They can search classmates by first name, last name, or `uniqueId`.
- **Friend Requests**:
    - Students send a friend request to a classmate.
    - The classmate must **Accept** the request before schedules can be compared.
    - Once accepted, if a friend has a public schedule, it becomes viewable in the comparison panel.

Private schedules stay hidden from friends, but the owner still sees their own live class state.

---

## Admin Flow

- Admins use the `Admin Blocks` tab inside `/schedule`.
- They define the **Bell Schedule** by adding blocks for each weekday.
- A block can be:
  - a period block (`Period 1` through `Period 8`)
  - a custom block such as Lunch, Advisory, Assembly, or Dismissal
- Blocks cannot overlap on the same day.
- When a period block is active, students see their saved course for that period. When a custom block is active, students see the custom label instead.

---

## Data Model

During the Convex port, `/schedule` is backed by `apps/convex/src/schedule.ts`
and these Convex tables:

- `studentSchedules` (one schedule container per student)
- `studentScheduleEntries` (one child document per weekday/period/course)
- `studentScheduleFriends` (request/accept workflow)
- `schoolDayBlocks` (the bell schedule)
- `courses` (the source of truth for class names)

---

## Convex Surface

- `api.schedule.dashboard` (Dashboard with entries, blocks, and friends)
- `api.schedule.saveMine` (Update my schedule)
- `api.schedule.searchPeople` (Search students through the users search index)
- `api.schedule.sendFriendRequest`
- `api.schedule.acceptFriendRequest`
- `api.schedule.removeFriend`
- `api.schedule.createBlock`
- `api.schedule.updateBlock`
- `api.schedule.deleteBlock`

The old REST endpoints are legacy reference only while the remaining API app is
being removed.

---

## Seed Data

The old Prisma seed script created default blocks, student schedules, and
accepted friend pairs. The Convex schedule schema is ready for native seed data,
but the schedule seed fixture has not been ported yet.
