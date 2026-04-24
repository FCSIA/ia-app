---
tags: [feature, flex-friday, scheduling]
---

# Flex Friday

← [[index|Home]]

---

## Overview

Flex Friday is a school scheduling system where students choose (or are assigned to) sessions taught by teachers on designated Fridays. It's the most complex feature in the app.

**Files:**
- Backend: `apps/api/src/flex-friday/`
- Web: `apps/web/src/app/flex-friday/`
- Database: [[schema#FlexFriday]], [[schema#FlexSession]], [[schema#FlexRegistration]], [[schema#FlexAssignment]]

---

## Data Hierarchy

```
FlexFriday (a specific Friday date)
    └── FlexSession (a thematic group, e.g. "Coding Workshops")
            └── FlexWorkshop (a specific instance, e.g. "AI with Mr. Smith")
                    ├── FlexRegistration (student signs up — STUDENT_CHOICE)
                    └── FlexAssignment (teacher assigns student — TEACHER_ASSIGNED)
```

---

## FlexFriday & Session Types

**FlexFriday Types:** `ALL_STUDENT`, `GRADE_SPECIFIC`, `PATHWAY_SPECIFIC`, `TEACHER_PD`.

**FlexSession Types:**
- `STUDENT_CHOICE`: Students register for their preferred workshop.
- `TEACHER_ASSIGNED`: Teachers manually place students into workshops.

Sessions can optionally restrict by `targetPathway` or `targetGrade`.

---

## Workflows

### Setup
1. Admin creates a **FlexFriday**.
2. Staff create **FlexSessions** for that day.
3. Teachers create one or more **FlexWorkshops** within those sessions.

### Registration (Student Choice)
- Students browse sessions and workshops matching their grade/pathway.
- They register for a workshop if capacity is available.
- They can unregister and swap as long as slots are open.

### Assignment (Teacher Assigned)
- Teachers creation a session of type `TEACHER_ASSIGNED`.
- They assign students to specific workshops via the roster management tools.
- Students see these mandatory assignments on their Flex Friday dashboard.

---

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| GET | `/flex-friday` | All upcoming Flex Fridays |
| GET | `/flex-friday/:id` | Detailed view with session/workshop tree |
| POST | `/flex-friday/:fid/sessions` | Create a session (Staff/Admin) |
| POST | `/flex-friday/:fid/sessions/:sid/workshops` | Create a workshop (Teacher) |
| POST | `/flex-friday/workshops/:wid/register` | Student sign-up |
| POST | `/flex-friday/workshops/:wid/assign` | Teacher assignment |
| GET | `/flex-friday/workshops/:wid/roster` | Fetch full workshop roster |

---

## Related

- [[calendar]] — Flex Fridays appear on the calendar
- [[notifications]] — Notifications when a Friday is published or an assignment is made

