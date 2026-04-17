---
tags: [backend, nestjs, modules]
---

# NestJS Modules

← [[index|Home]] / [[backend-overview]]

---

## What Is a Module?

A **module** is a container that groups related code. Each feature of the app (users, clubs, events) lives in its own module. Modules declare what they provide and what they import from other modules.

Every module file looks like this:

```typescript
@Module({
  imports: [],      // other modules this module needs
  controllers: [],  // HTTP route handlers
  providers: [],    // services, guards, etc.
  exports: [],      // what other modules can use from this one
})
export class ClubsModule {}
```

---

## The Feature Module Pattern

Every feature in this app has the same three-file structure:

```
clubs/
├── clubs.controller.ts   ← handles HTTP (routes, request parsing)
├── clubs.service.ts      ← handles logic (database, rules)
└── clubs.module.ts       ← wires them together
```

The module file is always simple:

```typescript
// clubs/clubs.module.ts
@Module({
  controllers: [ClubsController],
  providers: [ClubsService],
})
export class ClubsModule {}
```

NestJS reads this and knows: "when ClubsController needs something injected, look in `providers`."

---

## All Feature Modules

| Module | Handles |
|--------|---------|
| `AuthModule` | Login, JWT strategy, guards |
| `UsersModule` | User CRUD, roles, CSV import |
| `AnnouncementsModule` | Announcements + comments |
| `ClubsModule` | Clubs, members, invites, sponsors |
| `EventsModule` | Events + approval workflow |
| `CalendarModule` | Calendar entries |
| `FlexFridayModule` | Flex Fridays, sessions, registrations |
| `NotificationsModule` | Delivery, preferences, unread count |
| `ModerationModule` | Keyword rules, content reports |
| `AuditModule` | Audit log read access |
| `UploadsModule` | File upload handling |
| `PrismaModule` | Database connection (global) |

---

## The Prisma Module (Shared)

`PrismaModule` is special — it's declared `global: true` and exports `PrismaService`. This means any other module can inject `PrismaService` without explicitly importing `PrismaModule`:

```typescript
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

Every service in the app can then do:
```typescript
constructor(private prisma: PrismaService) {}
```

---

## Module Imports Between Features

Sometimes one feature module needs another. For example, when a comment is posted, the notifications module needs to run. This is handled by importing the other module:

```typescript
@Module({
  imports: [NotificationsModule],
  controllers: [AnnouncementsController],
  providers: [AnnouncementsService],
})
export class AnnouncementsModule {}
```

---

## Related

- [[backend-overview]] — NestJS overview
- [[controllers]] — What goes in a controller
- [[services]] — What goes in a service
- [[prisma]] — The PrismaService
