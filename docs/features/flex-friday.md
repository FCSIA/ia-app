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
    └── FlexSession (a session offered that day — e.g., "Coding Workshop")
            ├── FlexRegistration (student signs up — STUDENT_CHOICE)
            └── FlexAssignment (teacher assigns a student — TEACHER_ASSIGNED)
```

---

## FlexFriday Types

| Type | Description |
|------|-------------|
| `ALL_STUDENT` | All students participate |
| `FRESHMAN_WORKSHOP` | Only 9th graders |
| `PATHWAY_SPECIFIC` | A specific academic pathway |
| `TEACHER_PD` | Teacher professional development (no students) |

---

## FlexSession Types

| Type | How students get placed |
|------|------------------------|
| `STUDENT_CHOICE` | Students register themselves (up to `capacity`) |
| `TEACHER_ASSIGNED` | Teacher assigns specific students via `FlexAssignment` |

---

## Workflows

### Student Choice Flow
```
Admin creates FlexFriday
      ↓
Teachers create FlexSessions (type: STUDENT_CHOICE, set capacity)
      ↓
Students see available sessions and register
      ↓ (if session is full, can't register)
Student can unregister and choose another session
```

### Teacher Assigned Flow
```
Admin creates FlexFriday
      ↓
Teacher creates FlexSession (type: TEACHER_ASSIGNED)
      ↓
Teacher assigns specific students → FlexAssignment records created
      ↓
Students see their assignment on the flex-friday page
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/flex-friday` | All Flex Fridays |
| GET | `/flex-friday/:id` | One Flex Friday |
| POST | `/flex-friday` | Create a Flex Friday (admin) |
| GET | `/flex-friday/:id/sessions` | Sessions for a Friday |
| POST | `/flex-friday/:id/sessions` | Create a session (teacher) |
| POST | `/flex-friday/:fid/sessions/:sid/register` | Register for a session |
| DELETE | `/flex-friday/:fid/sessions/:sid/register` | Unregister |
| POST | `/flex-friday/:fid/sessions/:sid/assign` | Assign a student (teacher) |
| GET | `/flex-friday/:fid/sessions/:sid/roster` | Get full roster |
| GET | `/flex-friday/my-registrations` | My registered sessions |
| GET | `/flex-friday/my-assignments` | Sessions I've been assigned to |

---

## Permissions

| Action | Who can |
|--------|---------|
| Create FlexFriday | ADMIN, SUPER_ADMIN |
| Create sessions | TEACHER, ADMIN |
| Register for session | STUDENT (STUDENT_CHOICE only) |
| Assign students | Session's teacher, ADMIN |
| View roster | Session's teacher, ADMIN |

---

## Capacity Check

When a student tries to register for a `STUDENT_CHOICE` session:

```typescript
const count = await prisma.flexRegistration.count({
  where: { sessionId },
});
if (session.capacity && count >= session.capacity) {
  throw new BadRequestException('Session is full');
}
```

---

## Related

- [[calendar]] — Flex Fridays appear on the calendar
- [[notifications]] — Notifications when a Friday is published
