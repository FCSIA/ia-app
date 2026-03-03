# Initial Prompt: Build IA School App

You are a senior product architect and full-stack engineer.  
Your task is to **design and build a complete school app** for IA, accessible on web and downloadable/installable on mobile.

This is a school operations and communication platform for students and staff.  
Do not treat this as a generic social app.

---

## 1) Critical Build Constraint (Non-Negotiable)

You must choose a tech stack that is **fully free** to use for development and deployment of this project.

Requirements for stack selection:
- No paid services
- No “free tier” of paid services
- No trial plans
- No usage-locked plans that require upgrading to continue core functionality
- No mandatory paid account for publishing core app functionality
- Prefer open-source, self-hostable tools/services

When you propose the stack, explicitly prove it satisfies the above.

---

## 2) Product Goal

Build a secure, role-based school platform supporting:

- Announcements
- Club announcements
- Events
- Unified calendar
- Flex Friday workflows
- Reporting and moderation
- Full audit logging for all important actions
- Granular notifications

---

## 3) School and Identity Constraints

- Single school only
- Accounts are pre-created by CSV upload
- Store only: first name, last name, unique ID, grade level (avoid unnecessary PII)
- Users are students and school staff only (no parents/guardians)

---

## 4) Roles and Assignment Rules

Roles:
- Student
- Student Leader
- Student Admin
- Teacher
- Sponsor
- Support Staff
- Admin
- Super Admin

Rules:
- Roles are global
- A user can have multiple roles
- Super Admin initially creates student accounts and assigns roles
- Club Sponsors can assign roles to existing students (club context)

---

## 5) Channels and Core Areas

- Flex Friday
- Clubs
- Calendar

---

## 6) Functional Requirements

### Announcements
- Admin announcements (admin-controlled channel)
- Teachers can post announcements (with proper role assignment)
- Announcements can target:
  - School-wide
  - Grade subsets
  - Pathway subsets
- Poster can set expiration timestamp
- Expired announcements auto-archive
- Users can view archived announcements through “See old” access

### Club Announcements
- Club visibility is invite-only
- Club content visible only to members of that club
- Announcement-focused communication
- Per-announcement “Allow comments” toggle

### Events
- General events: Admin + Support Staff can post
- Club events: Student Leader creates; Sponsor approval required
- Club events are invisible until approved
- After approval, event is published and appears on calendar
- Event details include:
  - title
  - description
  - date/time
  - location
  - optional flyer
- No RSVP/capacity/check-in requirement

### Messaging
- No 1:1 DMs (strictly disallowed)

### Notifications
- Granular user preferences (per category/club)
- Default preferences: all notifications ON
- Override rule: general admin announcements notify everyone regardless of preferences

### Moderation and Governance
- Reporting system required
- Keyword filters required
- Immutable audit log required for every important action

---

## 7) Schedule Logic Appendix (Must Be Modeled)

- Regular Mon–Thu: 8 periods, 8:55 AM–4:15 PM
- Lunch during 4th or 5th period
- Club Weeks (monthly):
  - special schedule replaces normal
  - all 8 periods still meet
  - flex club period inserted between 4th and 5th (typically Tue–Thu)
  - Monday reserved for other activities
- Flex Fridays:
  - shorter 4-period schedule
  - some Fridays are freshman workshop days
  - some are pathway-specific
  - some are all-student days
  - if Friday is teacher PD/in-service, school is not in session
- Students register for some Flex Friday sessions
- Some Flex Friday sessions are teacher-assigned

---

## 8) UX Requirements

- Main dashboard that aggregates key items
- Separate tabs/areas for announcements, clubs, events, calendar, flex Friday
- Clear role-based views
- Admin panel for account/role/club management
- Student onboarding preferences for calendar/notification filtering

---

## 9) Required Output Format (Comprehensive Markdown)

Return one complete blueprint with these sections:

1. Executive summary
2. Chosen fully-free architecture and why it meets the cost constraint
3. Role-permission matrix (action-by-action)
4. Data model (entities, fields, relationships)
5. Authorization model
6. API contract
7. Workflow specs:
   - announcement lifecycle
   - club event approval lifecycle
   - flex Friday creation/assignment/registration lifecycle
8. Notification rules matrix
9. Moderation design (reporting + keyword filtering)
10. Audit log event model
11. UI information architecture (web + mobile)
12. Deployment model (fully free)
13. Security/privacy approach
14. Testing strategy
15. Implementation phases and milestones
16. Risks, edge cases, and mitigations
17. Explicit assumptions and contradiction handling

---

## 10) Build Execution Instruction

After the blueprint, provide implementation-ready artifacts:
- Initial project structure
- Initial schema/migrations
- Permission/authorization scaffolding
- Core route/endpoint map
- First screens/pages
- Audit logging utilities
- Moderation utilities
- Seed/import flow for CSV accounts

If information is missing, state assumptions clearly and proceed.
Do not provide generic advice. Provide concrete, build-ready decisions.
