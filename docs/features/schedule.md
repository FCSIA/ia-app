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
- They enter classes by weekday and period.
- They choose whether their schedule is public or private.
- They can search classmates by first name, last name, or `uniqueId`.
- They can pin classmates as friends.
- If a friend has a public schedule, that schedule becomes viewable in the friend panel.

Private schedules stay hidden from friends, but the owner still sees their own live class state.

---

## Admin Flow

- Admins use the `Admin Blocks` tab inside `/schedule`.
- They can add blocks for each weekday.
- A block can be:
  - a period block (`Period 1` through `Period 8`)
  - a custom block such as Lunch, Advisory, Assembly, or Dismissal
- Blocks cannot overlap on the same day.
- Each weekday can only have one block for a given period number.

When a period block is active, students see their saved class for that period. When a custom block is active, students see the custom label instead.

---

## Data Model

This feature uses four main tables:
- `student_schedules`
- `student_schedule_entries`
- `student_schedule_friends`
- `school_day_blocks`

See [[schema]] for the exact Prisma models.

---

## API Surface

- `GET /schedule`
- `PUT /schedule/me`
- `GET /schedule/search?q=...`
- `POST /schedule/friends`
- `DELETE /schedule/friends/:friendId`
- `POST /schedule/blocks`
- `PATCH /schedule/blocks/:blockId`
- `DELETE /schedule/blocks/:blockId`

Only admins can manage school-day blocks. Only student-role accounts can manage a personal schedule or friend list.

---

## Seed Data

The seed script creates:
- a default Monday-Friday bell schedule
- sample public schedules for `STU001` and `STU003`
- a pair of sample friend links between those students

That makes the feature usable immediately in local development after seeding.
