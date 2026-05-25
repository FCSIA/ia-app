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

During the Convex port, `/schedule` is backed by `apps/convex/src/schedule/`
and these Convex tables:

- `studentSchedules` (one schedule container per student)
- `studentScheduleEntries` (one child document per weekday/period/course)
- `studentScheduleFriends` (request/accept workflow)
- `schoolDayBlocks` (the bell schedule)
- `courses` (the source of truth for class names)

---

## Convex Surface

- `api.schedule.dashboard.dashboard` (Dashboard with entries, blocks, and friends)
- `api.schedule.dashboard.saveMine` (Update my schedule)
- `api.schedule.friends.searchPeople` (Search students through the users search index)
- `api.schedule.friends.sendFriendRequest`
- `api.schedule.friends.acceptFriendRequest`
- `api.schedule.friends.removeFriend`
- `api.schedule.blocks.createBlock`
- `api.schedule.blocks.updateBlock`
- `api.schedule.blocks.deleteBlock`
- `api.schedule.seed.seedFromStaticData` (secret-protected fixture loader)

The old REST endpoints are legacy reference only while the remaining API app is
being removed.

---

## Seed Data

Schedule fixtures are Convex-owned in `apps/convex/seed-data/schedule.ts`.
They create:

- default Monday-Friday school-day blocks
- one personal schedule for each active student with grade/pathway metadata
- 5 weekday entries for each selected period/course
- accepted schedule friendships for the first 180 sorted student pairs

Run `api.schedule.seed.seedFromStaticData` after users and courses are seeded. The
mutation is cursor-based because the full fixture writes thousands of entry
documents:

```bash
cd apps/convex
PATH=../../node_modules/.bin:$PATH convex run schedule/seed:seedFromStaticData \
  '{"secret":"<SCHEDULE_SEED_SECRET_OR_BOOTSTRAP_SECRET>","reset":true,"batchSize":20}'
```

Continue calling it with the returned `nextCursor` until `isDone` is `true`.
