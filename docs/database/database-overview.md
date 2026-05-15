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

In this project, PostgreSQL runs locally on port `5432`. The common macOS path uses Homebrew services, Windows uses `setup_pg.ps1`, and the optional Nix + direnv path starts a repo-local database from `.pgdata`.

### Local App Database

The local app database is defined by `DATABASE_URL`:

```bash
postgresql://ia_user:ia_password@localhost:5432/ia_db
```

That URL breaks down as:

| Part | Meaning |
|------|---------|
| `ia_user` | Local PostgreSQL role the API and Prisma use |
| `ia_password` | Local development password for `ia_user` |
| `localhost:5432` | Local PostgreSQL server and port |
| `ia_db` | Local development database owned by `ia_user` |

Manual setup creates that role and database with:

```sql
CREATE USER ia_user WITH PASSWORD 'ia_password';
CREATE DATABASE ia_db OWNER ia_user;
ALTER USER ia_user CREATEDB;
```

`CREATEDB` is required by Prisma Migrate because `prisma migrate dev` creates a temporary shadow database while calculating schema changes. The optional Nix + direnv route runs those SQL commands automatically against the repo-local `.pgdata` server.

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
