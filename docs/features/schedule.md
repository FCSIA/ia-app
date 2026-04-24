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

- `student_schedules` (The container)
- `student_schedule_entries` (Links to `courses`)
- `student_schedule_friends` (Request/Accept workflow)
- `school_day_blocks` (The bell schedule)
- `courses` (The source of truth for class names)

---

## API Surface

- `GET /schedule` (Dashboard with entries, blocks, and friends)
- `PUT /schedule/me` (Update my schedule)
- `GET /schedule/search?q=...` (Search students)
- `POST /schedule/friends` (Send friend request)
- `POST /schedule/friends/:id/respond` (Accept/Decline)
- `DELETE /schedule/friends/:id` (Remove friend)
- `POST /schedule/blocks` (Admin: create block)
- `PATCH /schedule/blocks/:id` (Admin: update block)

---

## Seed Data

The seed script creates:
- A default Monday-Friday bell schedule.
- 1,500 student schedules (every student gets one).
- ~180 pre-accepted friend pairs for testing.

