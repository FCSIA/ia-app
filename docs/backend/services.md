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
- Assigns roles and activates/deactivates accounts
- Parses and imports CSV files of users

### AnnouncementsService
- Creates announcements (with keyword check)
- Filters by target type (SCHOOL_WIDE, GRADE, PATHWAY, CLUB)
- Manages reading-status tracking and comments

### ClubManagementService
- Creates and updates clubs
- Manages membership (add, remove, promote)
- Manages sponsors and join codes

### ClubInvitationsService
- Handles the invite workflow (send, accept, decline)
- Manages join requests for private/restricted clubs

### ClubChannelsService
- Creates channels with specific visibility (Public, Private, Read-Only)
- Manages channel memberships and messaging features

### EventsService
- Creates events and moves them through approval workflow
- Manages event categories and flyer uploads

### CoursesService
- Provides searchable course catalog
- Filters by department, pathway, and grade-level eligibility

### ScheduleService
- High-performance student schedule management
- Handles friend requests and accepted sharing relationships
- Manages the school "bell schedule" (SchoolDayBlocks)

### CalendarService
- Fetches calendar entries filtered by date range
- Aggregates entries from standalone records and published Events

### FlexFridayService
- Manages Flex Friday dates, sessions, and workshops
- Handles student registration with capacity enforcement
- Manages teacher assignments and rosters

### NotificationsService
- Delivers `NotificationDelivery` rows based on user preferences
- Supports deep-linking back to source entities (Announcements, Events, etc.)

### ModerationService
- Manages keyword rules and automated content scanning
- Handles the reporting lifecycle (PENDING → RESOLVED/DISMISSED)

### AuditService
- Captures system-wide `AuditEvent` records for tracking sensitive actions


---

## Related

- [[controllers]] — What calls services
- [[prisma]] — How services query the database
- [[modules]] — How services are registered and injected
