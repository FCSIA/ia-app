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

This runs the seed file using `ts-node`. It's idempotent — you can run it multiple times safely. Each user is `upsert`ed (created if not exists, updated if exists), so re-seeding always resets passwords to the defaults.

---

## What Gets Created

### Users

| uniqueId | Name | Roles | Grade | Major Pathway | Password |
|----------|------|-------|-------|---------------|----------|
| `SUPER001` | — | SUPER_ADMIN, ADMIN | — | — | `SUPER001` |
| `ADMIN001` | — | ADMIN | — | — | `ADMIN001` |
| `TCH001` | — | TEACHER, SPONSOR | — | — | `TCH001` |
| `STU001` | Alex Johnson | STUDENT | 9 | INFORMATION_TECHNOLOGY | `STU001` |
| `STU002` | Sam Lee | STUDENT | 10 | HEALTH_SCIENCE | `STU002` |
| `STU003` | Jordan Park | STUDENT_LEADER | 11 | ENGINEERING | `STU003` |
| `STU004` | Taylor Kim | STUDENT_ADMIN | 12 | INFORMATION_TECHNOLOGY | `STU004` |

**Password = uniqueId** for all accounts.

Passwords are stored as bcrypt hashes — the seed file hashes them before storing:
```typescript
const hash = await bcrypt.hash('STU001', 12);
await prisma.user.upsert({
  where: { uniqueId: 'STU001' },
  update: { passwordHash: hash },
  create: { uniqueId: 'STU001', passwordHash: hash, ... },
});
```

### Demo Clubs
- Chess Club (TCH001 as sponsor, STU001 and STU002 as members)
- Coding Club (TCH001 as sponsor, STU003 as member)

### Demo Announcements
- A school-wide welcome announcement
- A chess club announcement

### Demo Events
- A school talent show event

### Demo Flex Fridays
- An upcoming Flex Friday with several sessions

### Notification Preferences
Default preferences (all enabled) are created for every user using `createMany({ skipDuplicates: true })`.

---

## How Upsert Works

`upsert` = update if exists, insert if not:

```typescript
await prisma.user.upsert({
  where: { uniqueId: 'STU001' },  // find by this
  update: {
    gradeLevel: 9,
    major: Pathway.INFORMATION_TECHNOLOGY,
  },
  create: {                       // if not found: create with all fields
    uniqueId: 'STU001',
    firstName: 'Alex',
    lastName: 'Johnson',
    passwordHash: await bcrypt.hash('STU001', 12),
    roles: [Role.STUDENT],
    gradeLevel: 9,
    major: Pathway.INFORMATION_TECHNOLOGY,
  },
});
```

The `update` includes `passwordHash` so re-seeding always resets passwords to known values — useful if you accidentally change a password during testing.

---

## Resetting Completely

To wipe the database and start fresh:

```bash
pnpm db:reset
```

⚠️ `migrate reset` deletes all data. Only do this in development.

---

## Related

- [[database-overview]] — Database concepts
- [[migrations]] — Setting up the structure before seeding
- [[schema]] — The models being populated
- [[roles-and-permissions]] — What each seeded role can do
