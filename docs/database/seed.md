---
tags: [database, seed, demo-data]
---

# Database Seed

← [[index|Home]] / [[database-overview]]

---

## What Is Seeding?

**Seeding** is populating the database with initial demo data so you have something to work with during development. Without it, you'd log in to an empty app.

The seed file is at `apps/api/prisma/seed.ts`.

---

## Running the Seed

```bash
pnpm db:seed
```

This runs the seed file using `ts-node`. 

### Reset Strategy
Unlike earlier versions, the current seed script is **destructive**. It begins by performing a `TRUNCATE` on all public tables (except migrations) with `RESTART IDENTITY CASCADE`. This ensures a perfectly clean slate every time you run it.

---

## Seeding Statistics

When the seed script completes, the following environment is created:

| Category | Count | Notes |
|----------|-------|-------|
| **Students** | 1,500 | 375 per grade level; distributed across pathways |
| **Staff** | 119 | Includes Admins, Teachers, and Support Staff |
| **Courses** | 103 | Full academic catalog including AP and Pathway courses |
| **Clubs** | 26 | Pathway, Academic, Competitive, and Service clubs |
| **Announcements**| 12 | Targeted school-wide, by grade, or by pathway |
| **Schedules** | 1,500 | One per student, with 8 period entries per day |
| **Friendships** | 180 | "Accepted" friend pairs for schedule comparison testing |

---

## Key Accounts

### Anchor Users
| uniqueId | Name | Roles | Grade | Major Pathway |
|----------|------|-------|-------|---------------|
| `SUPER001` | Super Admin | SUPER_ADMIN, ADMIN | — | — |
| `ADMIN001` | School Admin | ADMIN | — | — |
| `TCH001` | Jane Smith | TEACHER, SPONSOR | — | — |
| `STU001` | Alex Johnson | STUDENT | 9 | INFORMATION_TECHNOLOGY |
| `STU002` | Sam Lee | STUDENT | 10 | HEALTH_SCIENCE |
| `STU003` | Jordan Park | STUDENT | 11 | ENGINEERING |
| `STU004` | Taylor Kim | STUDENT | 12 | INFORMATION_TECHNOLOGY |
| ... | ... | ... | ... | ... |
| `STU010` | Jamie Flores | STUDENT | 11 | HEALTH_SCIENCE |

**Password = uniqueId** for all accounts.

---

## What Gets Created

### Academic Data
- **103 Courses**: Ported to Convex fixtures in `apps/convex/seed-data/courses.ts` and loaded through `api.courses.seedFromStaticData`.
- **Schedules**: Every student has a full 5-day schedule (8 periods/day) mapped to valid courses for their grade level and pathway.
- **Friendships**: A pool of students are pre-linked as friends to test schedule comparison features.

### Clubs & Communication
- **26 Clubs**: Defined in `seed-data/clubs.ts`. Each club is assigned:
    - **Sponsors**: 1-2 Staff members.
    - **Channels**: Standard channels (`general`, `announcements`) plus category-specific ones (`projects`, `competition-prep`, etc.).
    - **Members**: Weighted distribution based on student pathways.
    - **Leadership**: 3-4 student leaders (President, etc.) per club.
- **Announcements**: 12 demo announcements covering various target types (School-wide, Grade 9, IT Pathway, etc.).

### System Configuration
- **Keyword Rules**: 3 moderation keywords (`violence`, `weapon`, `drugs`).
- **Notification Preferences**: Default "enabled" preferences created for all 1,619 users.

---

## Related

- [[database-overview]] — Database concepts
- [[migrations]] — Setting up the structure before seeding
- [[schema]] — The models being populated
- [[roles-and-permissions]] — What each seeded role can do
