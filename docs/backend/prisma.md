---
tags: [backend, database, prisma, orm]
---

# Prisma — Database ORM

← [[index|Home]] / [[backend-overview]] | Also see: [[database-overview]]

---

## What Is Prisma?

**Prisma** is an ORM (Object-Relational Mapper). It sits between your TypeScript code and PostgreSQL, letting you write TypeScript instead of raw SQL.

Without Prisma:
```sql
SELECT u.*, c.name as club_name
FROM "User" u
JOIN "ClubMember" cm ON cm."userId" = u.id
JOIN "Club" c ON c.id = cm."clubId"
WHERE u."isActive" = true;
```

With Prisma:
```typescript
await prisma.user.findMany({
  where: { isActive: true },
  include: { clubMembers: { include: { club: true } } },
});
```

Same result, but type-safe and auto-completed.

---

## PrismaService

The database connection lives in `apps/api/src/prisma/prisma.service.ts`:

```typescript
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect(); // connect when NestJS starts
  }
}
```

It extends `PrismaClient` (the generated client) and is injected into every service:

```typescript
constructor(private prisma: PrismaService) {}
```

---

## Query Methods

Every model in the schema gets these methods:

| Method | What it does | SQL equivalent |
|--------|-------------|----------------|
| `findMany()` | Fetch multiple records | `SELECT` |
| `findUnique()` | Fetch one by unique field | `SELECT WHERE id = ...` |
| `findFirst()` | Fetch first matching | `SELECT LIMIT 1` |
| `create()` | Insert a new record | `INSERT` |
| `createMany()` | Insert multiple records | `INSERT (batch)` |
| `update()` | Update one record | `UPDATE WHERE` |
| `updateMany()` | Update multiple records | `UPDATE WHERE (batch)` |
| `upsert()` | Insert or update | `INSERT ON CONFLICT` |
| `delete()` | Delete one record | `DELETE WHERE` |
| `deleteMany()` | Delete multiple | `DELETE WHERE (batch)` |
| `count()` | Count records | `SELECT COUNT(*)` |

---

## Query Options

### where — Filtering

```typescript
// Simple equality
await prisma.user.findMany({ where: { isActive: true } });

// Multiple conditions (AND by default)
await prisma.announcement.findMany({
  where: {
    status: 'ACTIVE',
    targetType: 'SCHOOL_WIDE',
  },
});

// OR condition
await prisma.user.findMany({
  where: {
    OR: [
      { roles: { has: 'ADMIN' } },
      { roles: { has: 'SUPER_ADMIN' } },
    ],
  },
});

// Contains (like LIKE '%text%' in SQL)
await prisma.user.findMany({
  where: {
    firstName: { contains: 'john', mode: 'insensitive' },
  },
});
```

### include — Joining Related Data

```typescript
await prisma.club.findUnique({
  where: { id },
  include: {
    members: {
      include: {
        user: {
          select: { firstName: true, lastName: true, uniqueId: true },
        },
      },
    },
    sponsors: { include: { user: true } },
    _count: { select: { members: true } }, // just the count, not all records
  },
});
```

### select — Choose Specific Fields

```typescript
// Only fetch the fields you need (more efficient)
await prisma.user.findMany({
  select: {
    id: true,
    firstName: true,
    lastName: true,
    // passwordHash is NOT selected — never expose this
  },
});
```

### orderBy — Sorting

```typescript
await prisma.announcement.findMany({
  orderBy: { createdAt: 'desc' },  // newest first
});
```

### skip / take — Pagination

```typescript
const page = 2;
const perPage = 20;

await prisma.user.findMany({
  skip: (page - 1) * perPage,  // skip 20 records
  take: perPage,                // take next 20
});
```

---

## Composite Unique Keys

Some models have a unique constraint across multiple fields:

```prisma
model ClubMember {
  clubId String
  userId String
  @@unique([clubId, userId])  // can't be in same club twice
}
```

Prisma handles this as a compound key:
```typescript
await prisma.clubMember.delete({
  where: { clubId_userId: { clubId: 'abc', userId: 'xyz' } },
});
```

---

## Transactions

When multiple database operations must succeed or fail together:

```typescript
await prisma.$transaction(async (tx) => {
  const member = await tx.clubMember.delete({ where: { ... } });
  await tx.auditEvent.create({
    data: { action: 'MEMBER_REMOVED', entityId: member.userId },
  });
  // If either fails, both are rolled back
});
```

---

## The Generated Client

When you run `pnpm db:generate`, Prisma reads `schema.prisma` and generates TypeScript code in `node_modules/@prisma/client`. This gives you:
- Type-safe query methods for every model
- Auto-completion in your editor
- Compile-time errors if you query a non-existent field

You must re-run `pnpm db:generate` every time you change the schema.

---

## Related

- [[database-overview]] — PostgreSQL and the schema
- [[schema]] — Every model explained
- [[migrations]] — How schema changes are applied
- [[services]] — Where Prisma queries live
