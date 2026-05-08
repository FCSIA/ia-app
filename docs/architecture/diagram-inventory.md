---
tags: [architecture, diagram, features, deployment]
---

# Architecture Diagram Details

← [[index|Home]]

This page is a detailed list of the app pieces, features, data areas, and deployment pieces that exist in the project.

The old word "inventory" just means "a complete list of what exists." It does **not** mean warehouse inventory, school inventory, or database records. In this doc, it means: "here are the things the app has, so they can be named accurately when explaining the system."

This page intentionally does not prescribe the layout of any architecture diagram.

---

## Baseline Runtime

For a generic non-cloud diagram, the runtime can be described as:

| Piece | What it contains |
|-------|------------------|
| **User devices** | Browser clients used by students, teachers, sponsors, admins, and support staff |
| **Web app** | Next.js frontend, React UI, TanStack Query state, Axios API client |
| **Server** | NestJS API, authentication, business logic, file upload handling, static upload serving |
| **Database** | PostgreSQL data store accessed through Prisma |
| **Uploaded file storage** | Local server upload directory for flyers, club images, and chat attachments |
| **Shared contracts** | Workspace package with shared TypeScript types for auth, clubs, courses, and schedule |

### Runtime Responsibilities

| Runtime piece | Main responsibilities |
|---------------|-----------------------|
| **User devices** | Render pages, store JWT and user profile in browser local storage, send HTTP requests to the API, upload files through multipart forms |
| **Web app** | Routes, UI screens, authenticated shell, form state, client-side filtering/search, TanStack Query cache, API calls through Axios |
| **Server** | Auth checks, role checks, validation, business rules, Prisma queries, notification delivery, audit logging, moderation, upload handling |
| **Database** | Users, roles, sessions, announcements, comments, clubs, chat, events, calendar, Flex Friday, schedules, moderation records, notifications, audit events |
| **Uploaded file storage** | Binary files only; database stores URLs and metadata, not the file contents |
| **Shared contracts** | TypeScript shapes used by both apps so frontend and backend agree on auth, clubs, schedule, and course structures |

### Main Data Flow

```text
Browser
  sends request with JWT
    ↓
Next.js frontend API client
    ↓
NestJS API controller
    ↓
NestJS service layer
    ↓
Prisma
    ↓
PostgreSQL
```

For file uploads:

```text
Browser file input
  sends multipart upload
    ↓
NestJS upload endpoint
    ↓
Server upload directory
    ↓
API returns /uploads/... URL
    ↓
Database stores metadata and URL
```

---

## Cross-Cutting Platform Features

### Authentication and Authorization
- Unique-ID/password login.
- Password hashing with bcrypt.
- JWT sessions and logout.
- Password change flow.
- Current-user lookup through `/auth/me`.
- Global JWT guard and role guard.
- Role-based access control for students, student leaders, student admins, teachers, support staff, admins, and super admins.
- Active/inactive account enforcement.
- Auth session records persisted in the database.
- Frontend stores the JWT as `ia_token` and user profile as `ia_user` in local storage.
- Axios request interceptor attaches the JWT to API calls.
- Unauthorized API responses clear local auth state and redirect the user back to login.

Authentication flow:

```text
User enters unique ID + password
  ↓
POST /auth/login
  ↓
Server validates password hash and active status
  ↓
Server creates JWT/session response
  ↓
Browser stores token and user profile
  ↓
Future requests include Authorization: Bearer <token>
```

### User and Admin Management
- User directory and user detail lookup.
- Manual user creation and update.
- Role assignment.
- Account activation/deactivation.
- Password reset.
- Student CSV import.
- Student CSV export.
- Audit logging for administrative user actions.
- CSV import can generate passwords.
- Admin pages support account lifecycle operations without direct database access.
- Roles are multi-value on each user, but many UI decisions also use a primary/effective role.

### Notifications
- In-app notification inbox.
- Unread-count API.
- Mark selected notifications read.
- Mark all notifications read.
- Per-category notification preferences.
- Delivery hooks from announcements, comments, events, Flex Friday, clubs, channels, schedule friends, and moderation.
- Notification records include category, title, body, read state, and optional links to related entities such as announcement, event, club, or channel.
- Preferences can disable delivery for specific notification categories.
- Notifications are in-app only in the current implementation; there is no email, SMS, or push notification provider.

### Audit Log
- Admin-facing audit feed.
- Audit entry detail.
- Entity-specific audit history.
- Logs for login/logout/password changes, user changes, club changes, event approvals, Flex Friday actions, moderation actions, schedule actions, and report handling.
- Audit entries store actor, action, entity type, entity ID, timestamp, and metadata.
- Audit history is used for accountability around privileged actions and moderation decisions.

### Uploads and Attachments
- Multipart upload endpoints for event flyers, chat attachments, and club images.
- Disk-backed storage through `UPLOAD_DIR`, defaulting to `./uploads`.
- Static file serving from `/uploads/...`.
- 5 MB upload size limit.
- Image-only validation for club images.
- Chat attachment metadata persisted with messages: file name, URL, MIME type, size, created time.
- Club logos and banners reference uploaded image URLs.
- Event flyers use uploaded file URLs.
- Uploaded files are served by the API from the static `/uploads/` path.
- The current file storage is local-disk based, so backups must include both the database and upload directory.
- The current database stores attachment metadata; it does not store the binary attachment itself.

---

## Main Product Features

### Dashboard
- Authenticated landing page.
- Dashboard widgets backed by announcements, schedule, calendar, notifications, clubs, and activity data.
- Per-user dashboard layout storage in browser local storage.
- App shell navigation and page context.
- Current-class style schedule widgets.
- Quick access into common school workflows.

### Announcements
- Announcement feed.
- Announcement detail page.
- Announcement creation by authorized users.
- Targeting by school-wide audience, grade, pathway, club, or custom target value.
- Club-targeted announcements.
- Optional comments.
- Comment creation and deletion.
- Read/unread tracking per user.
- Archive flow.
- Expiration support.
- Notification delivery to targeted users.
- Profanity masking and automated moderation report creation.
- Keyword-match scanning for admin review.
- Author relationship to the user who created it.
- Comment authorship and delete behavior.
- Announcement read records allow unread indicators and read/unread toggling.
- Target types include general school-wide posts and more specific audiences like grade, pathway, club, and custom values.
- Club announcements are still announcement records; the club targeting changes where they appear and who receives notifications.

Announcement flow:

```text
Authorized user creates announcement
  ↓
Server validates target and roles
  ↓
Profanity/keyword moderation runs
  ↓
Announcement is stored
  ↓
Notifications are delivered to matching users
  ↓
Reads/comments/audit records accumulate over time
```

### Clubs
- Club directory.
- "My clubs" view.
- Club detail/workspace.
- Club creation by admins.
- Club update and deactivation.
- Club sponsors.
- Club members.
- Club member roles and role updates.
- Member removal.
- Sponsor assignment.
- Club categories, meeting schedule, location, logo, banner, and overview fields.
- Join policies: open or request-based.
- Direct join.
- Join request submission.
- Join request approval/decline.
- Join-code redeem flow.
- Join-code generation/rotation.
- Direct invites by student unique ID.
- Bulk invite by CSV.
- Invite accept/decline flow.
- Membership notification preferences created automatically.
- Club workspace pulls together announcements, events, channels, people, tags, and membership state.
- Each club can have teacher sponsors and student/member leadership roles.
- Sponsors have management visibility even when channels are private.
- Join requests and invites are separate workflows.
- Join codes allow direct membership without manual approval when enabled.
- CSV invite import resolves students by unique ID and records per-row results.

### Club Channels and Chat
- Club channel list.
- Channel creation, update, and deletion.
- Channel visibility modes: public, private, and member read-only.
- Explicit private-channel membership.
- Sponsors retain visibility into club channels.
- Channel messages.
- Rich-text message body support.
- Message replies/threads through parent message IDs.
- User mentions.
- Built-in mentions such as leaders/sponsors/all-style groups.
- Custom club tags and tag membership.
- Mention notifications.
- Message reactions.
- Attachment upload and attachment gallery.
- Profanity masking on channel names, descriptions, message bodies, and rich-text bodies.
- Automated moderation reports when chat content is filtered.
- Channel membership records control private-channel access.
- Read-only channels allow broad viewing with restricted posting.
- Message mentions can point to users, built-in groups, or custom tags.
- Mention parsing creates mention records and notification deliveries.
- Reaction records capture the reacting user and emoji.
- Replies are represented by parent message IDs, so threads are stored in the same message model.
- Attachments are uploaded first, then attached to the created message by metadata.

Channel message with attachment flow:

```text
User selects files and writes message
  ↓
Frontend uploads each file to /uploads/chat-attachment
  ↓
API stores files and returns metadata
  ↓
Frontend posts message with attachment metadata
  ↓
Server moderates text and rich text
  ↓
Server stores message, mentions, attachments, and notifications
```

### Events
- Event listing and event detail.
- General events and club events.
- Event creation by admins/support staff/student admins or eligible club roles.
- Event title, description, location, start/end time, flyer URL, and club association.
- Immediate publishing for admins/sponsors/general events.
- Pending approval flow for club events submitted by non-sponsor club roles.
- Sponsor approval records.
- Approve/reject endpoints.
- Event cancellation.
- Calendar entry creation for published events.
- Event notifications.
- Profanity masking and keyword-match scanning.
- Automated moderation reports for filtered event content.
- Event records support status values such as pending approval, published, rejected, and canceled.
- Club event permissions depend on club context: admin, sponsor, or eligible club role.
- Sponsor approvals are stored separately from the event record.
- Published events create calendar entries, making the calendar a derived view of approved event activity.
- Event flyers are stored as uploaded file URLs.

Club event approval flow:

```text
Club role creates event
  ↓
If not auto-published, event becomes PENDING_APPROVAL
  ↓
Sponsor approval records are created
  ↓
Sponsor approves or rejects
  ↓
Approved events publish, notify users, and appear on calendar
```

### Calendar
- Calendar list API with date filters.
- Source filters: district, school, club, personal.
- Tag filters.
- Personal calendar entries.
- Personal calendar deletion.
- Published events mirrored as calendar entries.
- Flex Friday entries mirrored as school calendar entries.
- Public sources are visible broadly.
- Personal entries are visible only to the creator.
- Calendar entries can link back to events or Flex Friday records.
- Tags support filtering and visual grouping.

### Flex Friday
- Flex Friday day creation.
- Flex Friday type, grade-level, pathway, school-day flag, and notes.
- Calendar mirroring for Flex Friday days.
- Session creation, update, and deletion.
- Workshop creation, update, and deletion.
- Workshop/session associations.
- Workshop registration and unregistering.
- Teacher/admin assignment of students to workshops.
- Roster view.
- Attendance marking.
- Bulk attendance marking.
- Attendance removal.
- Student credit counts.
- Student assignment view.
- Student registration view.
- Annual credit requirement: 12 credits.
- Semester credit target: 6 credits.
- Pathway-specific workshop credit tracking.
- Notifications for created/updated sessions and workshops, assignments, and Flex Friday changes.
- Profanity masking and automated moderation reports for notes, sessions, workshops, and locations.
- Flex Friday days can be full-school, grade-specific, or pathway-specific depending on type/fields.
- Sessions define time windows.
- Workshops can span one or more sessions through workshop-session join records.
- Registrations represent student choice.
- Assignments represent teacher/admin placement of a student into a workshop.
- Attendance drives credit counts.
- Present attendance counts toward the annual Wrapped and Flex credit summaries.
- The calendar mirror uses the earliest session start and latest session end for the Flex Friday calendar entry.

Flex credit flow:

```text
Admin/teacher creates Flex Friday day
  ↓
Sessions and workshops are added
  ↓
Students register or are assigned
  ↓
Roster is used for attendance
  ↓
Present attendance creates credits
  ↓
Credit summaries and Wrapped use those records
```

### Schedule
- Student schedule editor.
- Schedule dashboard response.
- Schedule entries by weekday and period.
- Public/private schedule visibility.
- School day block management.
- Admin-created school day blocks.
- Schedule search.
- Friend request creation.
- Friend request acceptance.
- Friend removal.
- Friend schedule comparison support.
- Notifications for friend requests and school day block changes.
- Profanity masking on school day block labels.
- Schedule entries can reference course catalog records.
- Weekday and period number identify where a class appears.
- Friend records have pending and accepted states.
- Friend comparison depends on accepted friendship relationships.
- Admin day blocks define school-wide schedule structure such as periods or custom blocks.
- Schedule visibility affects whether other users can see a student's schedule.

### Courses
- Course catalog list.
- Search/filter support.
- Course detail pages by slug.
- Course title, department, pathway, course numbers, catalog source, term, grade range, prerequisites, summary, major topics, and workload fields.
- Course references from student schedule entries.
- Course data comes from seeded catalog data.
- Courses can be tied to pathways.
- Course detail pages expose richer catalog metadata than the list page.
- Schedule entries can either link to a known course or store a freeform class name.

### Moderation and Safety
- Admin-managed keyword rules.
- Soft removal of keyword rules.
- Profanity filtering through `glin-profanity`.
- Custom keyword masking.
- Configurable test words through `PROFANITY_TEST_WORDS`.
- Rich-text moderation for Plate/Slate JSON trees.
- Keyword match records for announcements and events.
- Recent keyword-match review list.
- User-submitted reports.
- Automated reports when filtered content is created.
- Report status updates: pending, resolved, dismissed.
- Review notes and reviewed timestamps.
- Audit logging for keyword changes, report submission, automated flags, and report review.
- Moderation masks text before storing the final user-visible content.
- Keyword matches are stored for announcements and events.
- Automated reports are created when content is filtered in supported areas.
- User reports can point at a content type, content ID, reason, and optionally a reported user.
- Admin report review changes status and records a review note.
- Content moderation notification tells authors when words were replaced.

Moderation flow:

```text
User submits content
  ↓
Server loads active keyword rules and configured test words
  ↓
Server masks custom keywords and built-in profanity
  ↓
Filtered content is saved
  ↓
Optional keyword match, automated report, notification, and audit records are created
```

### IA Wrapped
- End-of-year Wrapped-style experience.
- Availability window: May only for normal users.
- Admin override access outside the May window.
- School-year range: August 1 through July 31.
- Animated slide deck in the web app.
- Messages sent.
- Average messages per week display.
- Channels engaged.
- Top channel and club.
- New schedule friends.
- Club count.
- Most-mentioned user.
- Pathway summary with major, minor, label, lanyard color, and peer count.
- Pathway-specific Flex workshop credits.
- Flex credits earned versus 12-credit requirement.
- Most-used non-stopword in channel messages.
- Peak messaging hour in America/New_York time.
- Most active messaging day.
- Longest consecutive daily message streak.
- Reactions received on the user's messages.
- Most-used emoji among the user's reactions.
- Longest message length.
- Stopword filtering prevents common filler words from dominating the most-used-word stat.
- Message dates and hours are normalized to America/New_York for day/hour stats.
- Wrapped data is computed from existing records rather than stored as a separate annual snapshot.
- The frontend builds a slide list dynamically, skipping some slides when the user has no relevant activity.

Wrapped data sources:

| Wrapped stat area | Data source |
|-------------------|-------------|
| Messages, channels, top channel, streaks, most-used word, peak hour | Club channel messages |
| Mentions | Club channel message mention records |
| Reactions received | Reactions on messages authored by the user |
| Top emoji | User's reaction records |
| Friends | Accepted schedule friend records |
| Clubs | Club member records |
| Flex credits | Present Flex attendance records |
| Pathway summary | User profile and pathway peer count |

---

## Feature-to-Data Map

| Feature | Important data created/read |
|---------|-----------------------------|
| Login/auth | `User`, `AuthSession`, JWT payload |
| User admin | `User`, roles, audit events |
| Announcements | `Announcement`, `AnnouncementRead`, `Comment`, notifications, reports, keyword matches |
| Clubs | `Club`, `ClubMember`, `ClubSponsor`, `ClubInvite`, `ClubJoinRequest`, notification preferences |
| Club channels | `ClubChannel`, channel memberships, tags, messages, mentions, reactions, attachments |
| Events | `Event`, `EventApproval`, calendar entries, notifications, reports, keyword matches |
| Calendar | `CalendarEntry`, linked events, linked Flex Fridays, personal entries |
| Flex Friday | `FlexFriday`, `FlexSession`, `FlexWorkshop`, registrations, assignments, attendance |
| Schedule | `StudentSchedule`, schedule entries, friends, school day blocks, courses |
| Courses | `Course`, schedule entry links |
| Notifications | `NotificationDelivery`, `NotificationPreference` |
| Moderation | `KeywordRule`, `KeywordMatch`, `Report`, audit events |
| Audit | `AuditEvent` |
| Uploads | Local files plus DB metadata/URL references |
| IA Wrapped | Derived from messages, reactions, mentions, friends, clubs, Flex attendance, and profile data |

---

## External Boundaries

These are the main boundaries between parts of the system:

| Boundary | What crosses it |
|----------|-----------------|
| Browser → Web app | Page navigation, local UI state, local storage auth data |
| Web app → API | JSON requests, multipart file uploads, JWT bearer token |
| API → Database | Prisma queries and mutations |
| API → Upload storage | Uploaded file writes and static file reads |
| API → Shared contracts | Type-level agreement during build/development |

Current implementation does not include third-party email, SMS, push notifications, payment processing, external identity provider login, or external object storage.

---

## Frontend Pages

| Route | Feature surface |
|-------|-----------------|
| `/` | App entry/redirect surface |
| `/login` | Login |
| `/dashboard` | Dashboard |
| `/admin` | Admin, users, moderation, audit, imports/exports |
| `/announcements` | Announcement feed |
| `/announcements/:id` | Announcement detail and comments |
| `/calendar` | Calendar |
| `/clubs` | Club directory and user club hub |
| `/clubs/:id` | Club workspace |
| `/clubs/:id/people` | Club people/membership |
| `/clubs/:id/tags` | Club tags |
| `/clubs/:id/channels/:channelId` | Club channel chat |
| `/courses` | Course catalog |
| `/courses/:slug` | Course detail |
| `/events` | Events |
| `/flex-friday` | Flex Friday management and registration |
| `/flex-friday/pass` | Flex Friday pass |
| `/notifications` | Notification inbox |
| `/profile` | Profile/settings |
| `/schedule` | Student schedule and friends |
| `/wrapped` | IA Wrapped |

---

## Backend API Areas

| Area | Base path |
|------|-----------|
| Auth | `/auth` |
| Users | `/users` |
| Announcements | `/announcements` |
| Clubs, channels, invites, members | `/clubs` |
| Events | `/events` |
| Calendar | `/calendar` |
| Flex Friday | `/flex-friday` |
| Schedule | `/schedule` |
| Courses | `/courses` |
| Uploads | `/uploads` |
| Notifications | `/notifications` |
| Moderation | `/moderation` |
| Audit | `/audit` |
| IA Wrapped | `/wrapped` |

---

## Primary Data Domains

| Domain | Main models |
|--------|-------------|
| Identity | `User`, `AuthSession`, `Role`, `Pathway` |
| Courses and schedules | `Course`, `StudentSchedule`, `StudentScheduleEntry`, `StudentScheduleFriend`, `SchoolDayBlock` |
| Announcements | `Announcement`, `AnnouncementRead`, `Comment` |
| Clubs | `Club`, `ClubMember`, `ClubSponsor`, `ClubInvite`, `ClubJoinRequest` |
| Club chat | `ClubChannel`, `ClubChannelMembership`, `ClubTag`, `ClubTagMember`, `ClubChannelMessage`, `ClubChannelMessageAttachment`, `ClubChannelMessageReaction`, `ClubChannelMessageMention` |
| Events and calendar | `Event`, `EventApproval`, `EventCategory`, `CalendarEntry` |
| Flex Friday | `FlexFriday`, `FlexSession`, `FlexWorkshop`, `FlexWorkshopSession`, `FlexRegistration`, `FlexAssignment`, `FlexAttendance` |
| Safety | `KeywordRule`, `KeywordMatch`, `Report` |
| Notifications | `NotificationPreference`, `NotificationDelivery` |
| Auditing | `AuditEvent` |

---

## Hypothetical Azure Environment

One conservative Azure environment for this app could be:

| Generic piece | Azure equivalent |
|---------------|------------------|
| User devices | Student/staff browsers on school or home networks |
| DNS/TLS edge | Azure DNS or school DNS pointing to HTTPS endpoint |
| Server | One Azure Linux VM running Docker Compose |
| Web app | Next.js container on the VM |
| API | NestJS container on the VM |
| Reverse proxy | Caddy or Nginx container on the VM |
| Database | PostgreSQL container on the VM, or Azure Database for PostgreSQL if managed DB is allowed |
| Uploaded file storage | VM-mounted persistent disk, or Azure Blob Storage if separate storage is allowed |
| Secrets | VM environment file initially, or Azure Key Vault if separate secret management is allowed |
| Backups | Azure VM Backup plus database dump and upload-directory backup |
| Network controls | Network Security Group rules; optional school IP allowlist or VPN/private access |

### Changes to the Baseline Inventory

If the diagram moves from generic "server and DB" to this Azure version, the feature list does not change. The infrastructure labels change:

- Replace **Server** with **Azure Linux VM / Docker host**.
- Add **Reverse proxy / HTTPS termination** in front of the web and API containers.
- Keep **Next.js web app** and **NestJS API** as separate runtime containers.
- Replace generic **Database** with either **PostgreSQL container** or **Azure Database for PostgreSQL**.
- Replace generic **Uploaded file storage** with either **VM persistent disk upload directory** or **Azure Blob Storage**.
- Add **Azure Backup** or another explicit backup mechanism for the database and uploads.
- Add **Network Security Group** or equivalent access-control boundary.
- Add **DNS/TLS** as named infrastructure pieces if public HTTPS access is represented.
- Add **Key Vault** only if secrets are separated from VM environment files.

The application-level boxes remain the same: auth, users, announcements, clubs, channels, events, calendar, Flex Friday, schedule, courses, moderation, notifications, audit, uploads, and IA Wrapped.

---

## Related

- [[overview]] — High-level app architecture
- [[data-flow]] — Request flow through frontend, API, and database
- [[wrapped]] — IA Wrapped feature details
- [[moderation]] — Moderation and safety feature details
