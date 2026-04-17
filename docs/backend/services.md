---
tags: [backend, nestjs, services]
---

# Services

← [[index|Home]] / [[backend-overview]]

---

## What Is a Service?

A service contains the **business logic** of your application. It:
- Has no knowledge of HTTP (no request/response objects)
- Talks to the database via Prisma
- Enforces rules (e.g., "only sponsors can invite members")
- Can call other services
- Is injected into controllers via dependency injection

---

## Basic Structure

```typescript
@Injectable()
export class ClubsService {
  constructor(private prisma: PrismaService) {}

  async getAll(user: User) {
    return this.prisma.club.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { members: true } },
        sponsors: { include: { user: true } },
      },
    });
  }

  async getOne(id: string, user: User) {
    const club = await this.prisma.club.findUnique({
      where: { id },
      include: {
        members: { include: { user: true } },
        sponsors: { include: { user: true } },
      },
    });

    if (!club) throw new NotFoundException('Club not found');
    return club;
  }
}
```

`@Injectable()` marks this class as something NestJS can inject into other classes.

---

## Business Logic Examples

### Permission Checks

```typescript
async removeMember(clubId: string, memberId: string, user: User) {
  // Only sponsors and admins can remove members
  const isSponsor = await this.prisma.clubSponsor.findFirst({
    where: { clubId, userId: user.id },
  });
  const isAdmin = user.roles.some(r => ['ADMIN', 'SUPER_ADMIN'].includes(r));

  if (!isSponsor && !isAdmin) {
    throw new ForbiddenException('Not authorized to remove members');
  }

  return this.prisma.clubMember.delete({
    where: { clubId_userId: { clubId, userId: memberId } },
  });
}
```

### Side Effects

When something happens, other things need to happen too. For example, when an announcement is published, notifications are created:

```typescript
async create(dto: CreateAnnouncementDto, user: User) {
  const announcement = await this.prisma.announcement.create({ data: { ... } });

  // Side effect: check for keyword violations
  await this.moderationService.checkContent(announcement.body, announcement.id);

  // Side effect: create notifications for all relevant users
  await this.notificationsService.notifyAnnouncement(announcement);

  return announcement;
}
```

---

## Error Handling

Services throw NestJS HTTP exceptions when something goes wrong. NestJS automatically converts these to proper HTTP responses:

```typescript
throw new NotFoundException('Club not found');       // 404
throw new ForbiddenException('Not a member');        // 403
throw new BadRequestException('Already a member');   // 400
throw new ConflictException('Invite already sent');  // 409
```

The controller doesn't need any try/catch — NestJS handles it.

---

## All Services and Their Responsibilities

### AuthService
- Validates uniqueId + password (bcrypt comparison)
- Signs and returns JWT
- Handles password changes

### UsersService
- CRUD for user records
- Assigns roles
- Activates/deactivates accounts
- Parses and imports CSV files of users

### AnnouncementsService
- Creates announcements (with keyword check)
- Filters by target type (SCHOOL_WIDE, GRADE, PATHWAY, CLUB)
- Manages comments (add, delete)
- Archives expired announcements

### ClubsService
- Creates and updates clubs
- Manages membership (add, remove, promote)
- Handles invite workflow (send, accept, decline)
- Manages sponsors

### EventsService
- Creates events (starts as DRAFT)
- Moves through approval workflow
- Sends notifications on publish

### CalendarService
- Fetches calendar entries filtered by date range and tags
- Aggregates entries from both CalendarEntry model and published Events

### FlexFridayService
- Creates Flex Friday dates and sessions
- Handles student registration with capacity checks
- Handles teacher assignment
- Returns rosters per session

### NotificationsService
- Creates `NotificationDelivery` rows for affected users
- Returns unread count (polled every 30s by the web app)
- Marks notifications as read

### ModerationService
- Adds/removes keyword rules
- Scans content against all active rules
- Creates `KeywordMatch` records on violation
- Manages report lifecycle (PENDING → RESOLVED/DISMISSED)

### AuditService
- Creates `AuditEvent` records
- Returns paginated audit log

---

## Related

- [[controllers]] — What calls services
- [[prisma]] — How services query the database
- [[modules]] — How services are registered and injected
