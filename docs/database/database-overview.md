---
tags: [database, postgresql, prisma]
---

# Database Overview

← [[index|Home]]

---

## PostgreSQL

**PostgreSQL** is the database — a program whose sole job is to store, organize, and retrieve data reliably. Data is organized into:

- **Tables** — like spreadsheet sheets (one per model: `User`, `Club`, `Event`, etc.)
- **Rows** — individual records in a table
- **Columns** — the fields on each record (`firstName`, `createdAt`, etc.)
- **Relations** — links between tables (a `Comment` belongs to an `Announcement`)

In this project, PostgreSQL runs locally via Homebrew on port `5432`.

### Connect Directly

```bash
psql postgresql://ia_user:ia_password@localhost:5432/ia_db

# Useful commands inside psql:
\dt              -- list all tables
\d "User"        -- describe the User table structure
\q               -- quit
```

---

## How Data Is Related

Most tables reference other tables using **foreign keys**. For example:

```
User ──< ClubMember >── Club
              ↑
         (junction table — a user can be in many clubs,
          a club can have many members)
```

```
Announcement ──< Comment
     ↑
  (one announcement has many comments)
```

Prisma handles these relations automatically — when you fetch a club with `include: { members: true }`, it runs the JOIN for you.

---

## Prisma as the Bridge

You never write SQL in this app. Prisma translates TypeScript:

```typescript
const users = await prisma.user.findMany({
  where: { isActive: true },
  orderBy: { createdAt: 'desc' },
});
```

Into SQL:
```sql
SELECT * FROM "User" WHERE "isActive" = true ORDER BY "createdAt" DESC;
```

And maps the result rows back into TypeScript objects. See [[prisma]].

---

## The Three Database Commands

```bash
# 1. Apply schema changes to the database
pnpm db:migrate

# 2. Regenerate TypeScript types from schema
pnpm db:generate

# 3. Populate with demo data
pnpm db:seed
```

---

## Schema Location

The entire database structure is defined in one file:

```
apps/api/prisma/schema.prisma
```

See [[schema]] for every model and field documented in detail.

---

## Naming Conventions

- Model names are **PascalCase** and **singular**: `User`, `ClubMember`, `FlexFriday`
- PostgreSQL tables are automatically quoted `"User"` to match the model name exactly
- Relation fields are **camelCase**: `clubMembers`, `authorId`, `createdAt`
- All IDs are **UUIDs** (universally unique identifiers like `"a3f9-bc21-..."`) not sequential numbers

---

## Related

- [[schema]] — All 23 models documented
- [[migrations]] — How schema changes are versioned
- [[seed]] — Demo data and test accounts
- [[prisma]] — How TypeScript queries the database
