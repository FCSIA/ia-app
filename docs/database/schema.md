---
tags: [database, schema, models]
---

# Database Schema — All Models

← [[index|Home]] / [[database-overview]]

---

## Enums

Enums are fixed lists of allowed values. TypeScript enforces you can only use values from the list.

### Role
```prisma
enum Role {
  STUDENT
  STUDENT_LEADER
  STUDENT_ADMIN
  TEACHER
  SPONSOR
  SUPPORT_STAFF
  ADMIN
  SUPER_ADMIN
}
```
Users can hold **multiple roles** at once (stored as an array). See [[roles-and-permissions]].

### AnnouncementTarget
```prisma
enum AnnouncementTarget {
  SCHOOL_WIDE   // everyone
  GRADE         // specific grade level
  PATHWAY       // specific academic pathway
  CLUB          // club members only
}
```

### AnnouncementStatus
```prisma
enum AnnouncementStatus { ACTIVE | ARCHIVED | EXPIRED }
```

### EventStatus (Approval Workflow)
```prisma
enum EventStatus {
  DRAFT            // just created
  PENDING_APPROVAL // submitted for review
  APPROVED         // sponsor approved
  PUBLISHED        // visible to all
  CANCELLED
}
```

### Pathway
```prisma
enum Pathway {
  INFORMATION_TECHNOLOGY
  HEALTH_SCIENCE
  ENGINEERING
}
```
Represents a student's academic track at FCS Innovation Academy. Every student has a **major** pathway and an optional **minor** from the remaining two.



### NotificationCategory
```prisma
enum NotificationCategory {
  SCHOOL_ANNOUNCEMENT
  CLUB_ANNOUNCEMENT
  EVENT
  FLEX_FRIDAY
}
```

---

## Core Models

### User
The central model. Everyone in the system is a User.

```prisma
model User {
  id           String   @id @default(cuid())
  uniqueId     String   @unique      // e.g. "STU001", "TCH001"
  firstName    String
  lastName     String
  email        String?
  passwordHash String?              // bcrypt hash, never plain text
  roles        Role[]               // array — user can have multiple roles
  gradeLevel   Int?                 // 9, 10, 11, or 12 — students only
  major        Pathway?             // primary academic pathway — students only
  minor        Pathway?             // optional secondary pathway — students only
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

Key points:
- `uniqueId` is the login username (not the `id` CUID)
- `roles` is an array — a Teacher who is also a Club Sponsor has `[TEACHER, SPONSOR]`
- `gradeLevel`, `major`, and `minor` are **student-only** — teachers and admins leave these `null`
- `minor` is always one of the other two pathways that is not the student's `major`
- `isActive: false` = soft-deleted account (data preserved, user can't log in)

---

### AuthSession
Tracks active login sessions for future "log out everywhere" functionality.

```prisma
model AuthSession {
  id        String   @id @default(uuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  user      User     @relation(...)
}
```

---

## Announcement Models

### Announcement
```prisma
model Announcement {
  id             String               @id @default(cuid())
  title          String
  body           String
  authorId       String
  targetType     AnnouncementTarget
  targetGrade    Int?                 // if targetType = GRADE (9,10,11,12)
  targetPathway  Pathway?             // if targetType = PATHWAY
  clubId         String?              // if targetType = CLUB
  isAdminGeneral Boolean @default(false) // pinned admin message
  allowComments  Boolean @default(true)
  status         AnnouncementStatus  @default(ACTIVE)
  expiresAt      DateTime?           // auto-archive after this date
  createdAt      DateTime            @default(now())

  author   User          @relation(...)
  club     Club?         @relation(...)
  comments Comment[]
}
```

### Comment
```prisma
model Comment {
  id             String   @id @default(uuid())
  body           String
  authorId       String
  announcementId String
  createdAt      DateTime @default(now())

  author       User         @relation(...)
  announcement Announcement @relation(...)
}
```

---

## Club Models

### Club
```prisma
model Club {
  id          String  @id @default(uuid())
  name        String
  description String?
  isActive    Boolean @default(true)
  createdAt   DateTime @default(now())

  members   ClubMember[]
  sponsors  ClubSponsor[]
  invites   ClubInvite[]
}
```

### ClubMember
Junction table — links Users to Clubs with a role.

```prisma
model ClubMember {
  clubId    String
  userId    String
  role      ClubMemberRole @default(MEMBER)  // MEMBER or LEADER
  joinedAt  DateTime       @default(now())

  club Club @relation(...)
  user User @relation(...)

  @@unique([clubId, userId])  // can't be in same club twice
}
```

### ClubSponsor
Separate from ClubMember because sponsors are teachers/staff, not students.

```prisma
model ClubSponsor {
  clubId String
  userId String

  club Club @relation(...)
  user User @relation(...)

  @@unique([clubId, userId])
}
```

### ClubInvite
```prisma
model ClubInvite {
  id          String       @id @default(uuid())
  clubId      String
  senderId    String       // who sent the invite
  recipientId String       // who received it
  status      InviteStatus @default(PENDING)  // PENDING | ACCEPTED | DECLINED
  createdAt   DateTime     @default(now())

  @@unique([clubId, recipientId])  // can't invite same person twice
}
```

---

## Event Models

### Event
```prisma
model Event {
  id          String      @id @default(uuid())
  title       String
  description String
  type        EventType   // GENERAL or CLUB
  status      EventStatus @default(DRAFT)
  clubId      String?
  creatorId   String
  location    String?
  flyerUrl    String?     // uploaded image
  startAt     DateTime
  endAt       DateTime
  publishedAt DateTime?
  createdAt   DateTime    @default(now())

  creator   User            @relation(...)
  club      Club?           @relation(...)
  approvals EventApproval[]
}
```

### EventApproval
```prisma
model EventApproval {
  id         String         @id @default(uuid())
  eventId    String
  approverId String
  status     ApprovalStatus @default(PENDING)
  note       String?
  createdAt  DateTime       @default(now())
}
```

---

## Calendar

### CalendarEntry
Can be linked to an Event or standalone (e.g., school holidays).

```prisma
model CalendarEntry {
  id          String   @id @default(uuid())
  eventId     String?
  title       String
  description String?
  location    String?
  startAt     DateTime
  endAt       DateTime
  tags        String[]  // e.g. ["holiday", "academic"]
  createdAt   DateTime  @default(now())

  event Event? @relation(...)
}
```

---

## Flex Friday Models

### FlexFriday
Represents a specific Friday with scheduled sessions.

```prisma
model FlexFriday {
  id          String          @id @default(cuid())
  date        DateTime        @unique  // the actual Friday date
  type        FlexFridayType          // ALL_STUDENT | FRESHMAN_WORKSHOP | etc.
  pathway     Pathway?                // set for PATHWAY_SPECIFIC type
  isSchoolDay Boolean         @default(true)
  notes       String?

  sessions FlexSession[]
}
```

### FlexSession
A specific session offered on a Flex Friday (e.g., "Coding Workshop with Mr. Smith").

```prisma
model FlexSession {
  id            String          @id @default(cuid())
  flexFridayId  String
  teacherId     String?
  title         String
  description   String?
  location      String?
  capacity      Int?
  sessionType   FlexSessionType // STUDENT_CHOICE | TEACHER_ASSIGNED
  targetPathway Pathway?        // restrict to a specific pathway
  targetGrade   Int?            // restrict to a specific grade (9,10,11,12)
  createdAt     DateTime        @default(now())

  flexFriday    FlexFriday        @relation(...)
  registrations FlexRegistration[]
  assignments   FlexAssignment[]
}
```

### FlexRegistration
Student signs up for a session (STUDENT_CHOICE type).

```prisma
model FlexRegistration {
  sessionId  String
  studentId  String
  registeredAt DateTime @default(now())

  @@unique([sessionId, studentId])
}
```

### FlexAssignment
Teacher assigns a student to a session (TEACHER_ASSIGNED type).

```prisma
model FlexAssignment {
  sessionId  String
  studentId  String
  assignedAt DateTime @default(now())

  @@unique([sessionId, studentId])
}
```

---

## Moderation Models

### KeywordRule
```prisma
model KeywordRule {
  id        String   @id @default(uuid())
  keyword   String   @unique
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
}
```

### Report
```prisma
model Report {
  id          String        @id @default(uuid())
  submitterId String
  contentType ContentType   // ANNOUNCEMENT | COMMENT | EVENT
  contentId   String
  reason      String
  status      ReportStatus  @default(PENDING)
  reviewNote  String?
  reviewedAt  DateTime?
  createdAt   DateTime      @default(now())

  submitter User @relation(...)
}
```

---

## Notification Models

### NotificationPreference
Per-user toggle for each notification category.

```prisma
model NotificationPreference {
  id       String               @id @default(uuid())
  userId   String
  category NotificationCategory
  clubId   String?              // null = school-wide preference
  enabled  Boolean              @default(true)

  @@unique([userId, category, clubId])
}
```

### NotificationDelivery
An actual notification sent to a user.

```prisma
model NotificationDelivery {
  id        String               @id @default(uuid())
  userId    String
  category  NotificationCategory
  title     String
  body      String?
  isRead    Boolean              @default(false)
  createdAt DateTime             @default(now())

  user User @relation(...)
}
```

---

## Audit

### AuditEvent
```prisma
model AuditEvent {
  id         String   @id @default(uuid())
  actorId    String?             // who did it (null = system)
  action     String              // e.g. "USER_DEACTIVATED"
  entityType String              // e.g. "User"
  entityId   String?             // the affected record's id
  meta       Json?               // any extra context
  createdAt  DateTime @default(now())

  actor User? @relation(...)
}
```

---

## Related

- [[database-overview]] — PostgreSQL concepts
- [[prisma]] — How to query these models
- [[migrations]] — How the schema was applied
- [[seed]] — What demo data exists
