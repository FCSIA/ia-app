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
Users can hold multiple roles at once.

### Pathway
```prisma
enum Pathway {
  INFORMATION_TECHNOLOGY
  HEALTH_SCIENCE
  ENGINEERING
}
```
Represents a student's academic track. Every student has a **major** and an optional **minor** from the remaining two.

### Announcement Enums
- **AnnouncementTarget**: `SCHOOL_WIDE` | `GRADE` | `PATHWAY` | `CLUB`
- **AnnouncementStatus**: `ACTIVE` | `ARCHIVED` | `EXPIRED`

### Club Enums
- **ClubJoinPolicy**: `OPEN` | `REQUEST`
- **ClubChannelVisibility**: `PUBLIC` | `PRIVATE` | `MEMBER_READONLY`
- **InviteStatus**: `PENDING` | `ACCEPTED` | `DECLINED`
- **ClubJoinRequestStatus**: `PENDING` | `APPROVED` | `DECLINED`
- **ClubMentionKind**: `USER` | `BUILT_IN_TAG` | `CUSTOM_TAG`

### Event & Approval Enums
- **EventType**: `GENERAL` | `CLUB`
- **EventStatus**: `DRAFT` | `PENDING_APPROVAL` | `APPROVED` | `PUBLISHED` | `CANCELLED`
- **ApprovalStatus**: `PENDING` | `APPROVED` | `REJECTED`

### Flex Friday Enums
- **FlexFridayType**: `ALL_STUDENT` | `GRADE_SPECIFIC` | `PATHWAY_SPECIFIC` | `TEACHER_PD`
- **FlexSessionType**: `STUDENT_CHOICE` | `TEACHER_ASSIGNED`

### Notification Enums
- **NotificationCategory**:
    - `SCHOOL_ANNOUNCEMENT`
    - `CLUB_ANNOUNCEMENT`
    - `CLUB_JOIN_REQUEST`
    - `EVENT`
    - `FLEX_FRIDAY`
    - `CLUB_CHANNEL_MENTION`
    - `FRIEND_REQUEST`

### Other Enums
- **CourseCatalogSource**: `COURSE_CATALOG` | `AP_CATALOG` | `MERGED`
- **ScheduleWeekday**: `MONDAY` | `TUESDAY` | `WEDNESDAY` | `THURSDAY` | `FRIDAY`
- **ReportStatus**: `PENDING` | `REVIEWED` | `RESOLVED` | `DISMISSED`
- **ContentType**: `ANNOUNCEMENT` | `COMMENT` | `EVENT`


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
  email        String?  @unique
  passwordHash String?              // bcrypt hash
  roles        Role[]   @default([STUDENT])
  gradeLevel   Int?                 // 9-12 (students)
  major        Pathway?             // primary pathway (students)
  minor        Pathway?             // optional secondary pathway (students)
  isActive     Boolean  @default(true)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

Key points:
- `uniqueId` is the primary login identifier.
- `roles` is an array; users frequently hold multiple roles (e.g., `[TEACHER, SPONSOR]`).
- `gradeLevel`, `major`, and `minor` are **student-only** fields.

---

### Course
Represents an academic course offered at the school.

During the Convex port, the active course-catalog model is
`apps/convex/src/schema.ts` table `courses`. It uses native Convex `_id`
values, a `by_slug` index, department/pathway indexes, and a `search_courses`
search index. The Prisma model below is legacy reference only while the old API
is being deleted.

```prisma
model Course {
  id                String              @id @default(cuid())
  slug              String              @unique // e.g. "ap-computer-science-a"
  title             String
  courseNumbers     String[]            // list of course codes
  department        String
  pathway           Pathway?
  catalogSource     CourseCatalogSource
  term              String?             // e.g. "YEAR", "SEMESTER"
  gradeText         String?             // e.g. "9-12"
  minGrade          Int?
  maxGrade          Int?
  prerequisitesText String?
  summary           String?
}
```

---

### AuthSession
Tracks active login sessions.

```prisma
model AuthSession {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  createdAt DateTime @default(now())
}
```


---

## Student Schedule Models

### ScheduleWeekday
```prisma
enum ScheduleWeekday {
  MONDAY
  TUESDAY
  WEDNESDAY
  THURSDAY
  FRIDAY
}
```

This enum is used by both the bell-schedule blocks and per-student schedule entries.

### StudentSchedule
```prisma
model StudentSchedule {
  id        String   @id @default(cuid())
  userId    String   @unique
  isPublic  Boolean  @default(false)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### StudentScheduleEntry
```prisma
model StudentScheduleEntry {
  id           String          @id @default(cuid())
  scheduleId   String
  courseId     String?         // link to official Course catalog
  weekday      ScheduleWeekday
  periodNumber Int
  className    String          // display name (redundant if courseId set)

  @@unique([scheduleId, weekday, periodNumber])
}
```

### StudentScheduleFriend
Tracks friendship requests and accepted relationships for schedule sharing.

```prisma
model StudentScheduleFriend {
  id          String           @id @default(cuid())
  requesterId String
  addresseeId String
  status      FriendshipStatus // PENDING | ACCEPTED
  createdAt   DateTime         @default(now())
  acceptedAt  DateTime?

  @@unique([requesterId, addresseeId])
}
```
A record exists for both sides of an accepted friendship to facilitate easy querying.


### SchoolDayBlock
```prisma
model SchoolDayBlock {
  id           String          @id @default(cuid())
  weekday      ScheduleWeekday
  label        String
  periodNumber Int?
  startTime    String
  endTime      String
  createdById  String
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt
}
```

Admins define the school day using these blocks:
- if `periodNumber` is `1` through `8`, students see their matching class during that time
- if `periodNumber` is `null`, the block behaves like a custom label such as lunch, advisory, or assembly

---

## Announcement Models

### Announcement
```prisma
model Announcement {
  id             String             @id @default(cuid())
  authorId       String
  title          String
  body           String
  targetType     AnnouncementTarget
  targetGrade    Int?
  targetPathway  Pathway?
  targetValue    String?            // additional flexible target
  clubId         String?
  allowComments  Boolean            @default(false)
  isAdminGeneral Boolean            @default(false)
  status         AnnouncementStatus @default(ACTIVE)
  expiresAt      DateTime?
  createdAt      DateTime           @default(now())
}
```

### AnnouncementRead
Tracks which users have viewed which announcements.

```prisma
model AnnouncementRead {
  id             String   @id @default(cuid())
  announcementId String
  userId         String
  readAt         DateTime @default(now())

  @@unique([announcementId, userId])
}
```

### Comment
```prisma
model Comment {
  id             String   @id @default(cuid())
  announcementId String
  authorId       String
  body           String
  createdAt      DateTime @default(now())
}
```


---

## Club Models

### Club
```prisma
model Club {
  id                String         @id @default(cuid())
  name              String         @unique
  description       String?
  joinPolicy        ClubJoinPolicy @default(OPEN)
  joinCode          String?        // alphanum code for joining
  joinCodeUpdatedAt DateTime?
  isActive          Boolean        @default(true)
  createdAt         DateTime       @default(now())
}
```

### ClubMember
```prisma
model ClubMember {
  id       String   @id @default(cuid())
  clubId   String
  userId   String
  role     String?  // custom title (e.g. "President")
  joinedAt DateTime @default(now())

  @@unique([clubId, userId])
}
```

### ClubJoinRequest
Managed request workflow for clubs with `REQUEST` policy.

```prisma
model ClubJoinRequest {
  id          String                @id @default(cuid())
  clubId      String
  requesterId String
  status      ClubJoinRequestStatus // PENDING | APPROVED | DECLINED
  createdAt   DateTime              @default(now())

  @@unique([clubId, requesterId])
}
```

### ClubInvite
```prisma
model ClubInvite {
  id          String       @id @default(cuid())
  clubId      String
  senderId    String
  recipientId String
  status      InviteStatus // PENDING | ACCEPTED | DECLINED
  createdAt   DateTime     @default(now())

  @@unique([clubId, recipientId])
}
```

### ClubSponsor
```prisma
model ClubSponsor {
  id      String   @id @default(cuid())
  clubId  String
  userId  String
  addedAt DateTime @default(now())

  @@unique([clubId, userId])
}
```

### ClubChannel
```prisma
model ClubChannel {
  id          String                @id @default(cuid())
  clubId      String
  name        String
  description String?
  visibility  ClubChannelVisibility // PUBLIC | PRIVATE | MEMBER_READONLY
  createdById String
  createdAt   DateTime              @default(now())

  @@unique([clubId, name])
}
```
In `MEMBER_READONLY` channels, only leaders and sponsors can post.


### ClubChannelMembership
```prisma
model ClubChannelMembership {
  id        String   @id @default(cuid())
  channelId String
  userId    String
  createdAt DateTime @default(now())

  @@unique([channelId, userId])
}
```

### ClubTag
```prisma
model ClubTag {
  id          String   @id @default(cuid())
  clubId      String
  name        String
  slug        String
  createdById String
  createdAt   DateTime @default(now())

  members ClubTagMember[]

  @@unique([clubId, slug])
}
```

### ClubTagMember
```prisma
model ClubTagMember {
  id        String   @id @default(cuid())
  tagId     String
  userId    String
  createdAt DateTime @default(now())

  @@unique([tagId, userId])
}
```

### ClubChannelMessage
```prisma
model ClubChannelMessage {
  id        String   @id @default(cuid())
  channelId String
  authorId  String
  body      String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  mentions ClubChannelMessageMention[]
}
```

### ClubChannelMessageMention
```prisma
model ClubChannelMessageMention {
  id        String          @id @default(cuid())
  messageId String
  userId    String?
  tagId     String?
  kind      ClubMentionKind
  token     String
  createdAt DateTime        @default(now())
}
```

---

## Event Models

### Event
```prisma
model Event {
  id                   String      @id @default(cuid())
  authorId             String
  clubId               String?
  categoryId           String?
  status               EventStatus @default(DRAFT)
  type                 EventType   @default(GENERAL)
  title                String
  description          String?
  location             String?
  flyerUrl             String?
  startAt              DateTime
  endAt                DateTime?
  publishedAt          DateTime?
  createdAt            DateTime    @default(now())
}
```

### EventApproval
```prisma
model EventApproval {
  id        String         @id @default(cuid())
  eventId   String
  sponsorId String
  status    ApprovalStatus @default(PENDING)
  note      String?
  decidedAt DateTime?
  createdAt DateTime       @default(now())

  @@unique([eventId, sponsorId])
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
  id          String         @id @default(cuid())
  date        DateTime       @unique
  type        FlexFridayType @default(ALL_STUDENT)
  gradeLevel  Int?
  pathway     Pathway?
  isSchoolDay Boolean        @default(true)
  notes       String?
}
```

### FlexSession
A thematic grouping of workshops (e.g. "Computer Science Workshops").

```prisma
model FlexSession {
  id            String          @id @default(cuid())
  flexFridayId  String
  title         String
  description   String?
  sessionType   FlexSessionType
  targetPathway Pathway?
  targetGrade   Int?
}
```

### FlexWorkshop
A specific instance of a session (e.g. "Intro to AI with Mr. Smith").

```prisma
model FlexWorkshop {
  id            String   @id @default(cuid())
  sessionId     String
  teacherId     String?
  title         String
  description   String?
  location      String?
  capacity      Int?
}
```

### FlexRegistration
Student signs up for a workshop (STUDENT_CHOICE type).

```prisma
model FlexRegistration {
  id         String @id @default(cuid())
  workshopId String
  studentId  String

  @@unique([workshopId, studentId])
}
```

### FlexAssignment
Teacher assigns a student to a workshop (TEACHER_ASSIGNED type).

```prisma
model FlexAssignment {
  id         String @id @default(cuid())
  workshopId String
  studentId  String
  assignedBy String

  @@unique([workshopId, studentId])
}
```


---

## Moderation Models

### KeywordRule
```prisma
model KeywordRule {
  id        String   @id @default(cuid())
  keyword   String   @unique
  addedById String
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
}
```

### Report
```prisma
model Report {
  id             String       @id @default(cuid())
  submitterId    String
  contentType    ContentType  // ANNOUNCEMENT | COMMENT | EVENT
  contentId      String
  reportedUserId String?
  reason         String
  status         ReportStatus @default(PENDING)
  reviewNote     String?
  reviewedAt     DateTime?
  createdAt      DateTime     @default(now())
}
```

---

## Notification Models

### NotificationPreference
Per-user toggle for each notification category.

```prisma
model NotificationPreference {
  id       String               @id @default(cuid())
  userId   String
  category NotificationCategory
  clubId   String?
  enabled  Boolean              @default(true)

  @@unique([userId, category, clubId])
}
```

### NotificationDelivery
An actual notification sent to a user.

```prisma
model NotificationDelivery {
  id             String               @id @default(cuid())
  userId         String
  category       NotificationCategory
  announcementId String?
  eventId        String?
  clubId         String?
  channelId      String?
  messageId      String?
  title          String
  body           String
  isRead         Boolean              @default(false)
  createdAt      DateTime             @default(now())
}
```
In-app notifications are linked to their source entity for deep-linking.


---

## Audit

### AuditEvent
```prisma
model AuditEvent {
  id         String   @id @default(cuid())
  actorId    String?  // who did it (null = system)
  action     String   // e.g. "USER_DEACTIVATED"
  entityType String   // e.g. "User"
  entityId   String?  // the affected record's id
  meta       Json?    // any extra context
  createdAt  DateTime @default(now())
}
```

---

## Related

- [[database-overview]] — PostgreSQL concepts
- [[prisma]] — How to query these models
- [[migrations]] — How the schema was applied
- [[seed]] — Current seeding statistics and demo data
- [[roles-and-permissions]] — Role-based access control rules
