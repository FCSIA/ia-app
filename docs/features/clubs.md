---
tags: [feature, clubs, membership]
---

# Clubs

← [[index|Home]]

---

## Overview

Clubs are student organizations. Each club has sponsors (teachers/staff), members (students), and its own announcement feed.

**Files:**
- Backend: `apps/api/src/clubs/`
- Web: `apps/web/src/app/clubs/`
- Database: [[schema#Club]], [[schema#ClubMember]], [[schema#ClubSponsor]], [[schema#ClubInvite]]

---

## Roles Within a Club

| Role | Who | Capabilities |
|------|-----|--------------|
| **Sponsor** | Teacher/Staff | Invite members, remove members, promote to leader, post announcements, create events |
| **Leader** | Student | Invite members, post announcements |
| **Member** | Student | View club content, participate in announcements |

A user's club role is separate from their system role (a `STUDENT` can be a club `LEADER`).

---

## Invite Workflow

Students join clubs through an invite system — they can't join without being invited:

```
Sponsor or Leader sends invite
         ↓
ClubInvite record created (status: PENDING)
         ↓
Recipient sees invite in /clubs (pending invites section)
         ↓
Accept → ClubMember created, ClubInvite → ACCEPTED
Decline → ClubInvite → DECLINED
```

Only one pending invite per person per club is allowed (`@@unique([clubId, recipientId])`).

---

## Club Announcements

Club announcements are just `Announcement` records with `targetType: CLUB` and a `clubId`. They appear in:
- The club detail page's Announcements tab
- The global announcements list (for members only)
- Push notifications (if user has CLUB_ANNOUNCEMENT preference enabled)

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/clubs` | All active clubs |
| GET | `/clubs/mine` | Clubs I'm a member or sponsor of |
| GET | `/clubs/invites` | My pending invites |
| GET | `/clubs/:id` | Club detail with members + sponsors |
| POST | `/clubs` | Create club (admin only) |
| POST | `/clubs/:id/invite` | Send invite |
| PATCH | `/clubs/invites/:id` | Accept or decline invite |
| PATCH | `/clubs/:id/members/:uid/promote` | Promote member to leader |
| DELETE | `/clubs/:id/members/:uid` | Remove member |

---

## Permissions

| Action | Who can |
|--------|---------|
| View club list | All authenticated |
| View club detail | All authenticated (content varies by membership) |
| Create club | ADMIN, SUPER_ADMIN |
| Send invite | Sponsor, Leader, ADMIN, SUPER_ADMIN |
| Promote to leader | Sponsor, ADMIN, SUPER_ADMIN |
| Remove member | Sponsor, ADMIN, SUPER_ADMIN |
| Post announcement | Sponsor, Leader, ADMIN, SUPER_ADMIN |

---

## Web Pages

- `/clubs` — list of all clubs + pending invites card
- `/clubs/:id` — tabs: Announcements and Members

---

## Related

- [[announcements]] — Club-targeted announcements
- [[events]] — Club events go through the event approval flow
- [[notifications]] — Club announcement notifications
