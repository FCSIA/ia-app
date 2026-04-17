---
tags: [feature, clubs, membership, channels]
---

# Clubs

← [[index|Home]]

---

## Overview

Clubs are student organizations with a full workspace model: announcements, channels, mention tags, invites, and a searchable member directory.

Every club must have **at least one teacher sponsor**. Sponsors are faculty oversight for the club and automatically retain visibility into **every** channel, including private channels.

**Files:**
- Backend: `apps/api/src/clubs/`
- Web: `apps/web/src/app/clubs/`
- Database: [[schema#Club]], [[schema#ClubMember]], [[schema#ClubSponsor]], [[schema#ClubInvite]], [[schema#ClubChannel]], [[schema#ClubTag]], [[schema#ClubChannelMessage]]

---

## Roles Within a Club

| Role | Who | Capabilities |
|------|-----|--------------|
| **Sponsor** | Teacher sponsor | Invite members, remove members, promote to leader, post announcements, create events, create channels/tags |
| **Leader** | Student | Invite members, post announcements, create channels/tags |
| **Member** | Student | View club content, participate in announcements, post in accessible channels |

A user's club role is separate from their system role (a `STUDENT` can be a club `LEADER`).

### Sponsor Invariant

- `POST /clubs` requires `sponsorIds`
- each sponsor must be an active user with the system `SPONSOR` role
- at least one sponsor is mandatory for every club
- sponsors always see all channels, even when the channel has a private member list

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

### Invite Input Formats

- Single invite accepts a user's `uniqueId` (for example `STU001`) on `POST /clubs/:id/invite`.
- Bulk invite accepts a CSV upload on `POST /clubs/:id/invite/csv`.
- CSV headers may use `unique_id`, `student_id`, `user_id`, `recipient_id`, or a single populated column with one ID per row.
- `ClubInvite.recipientId` stores the recipient user's internal database `id` after lookup.

---

## Club Announcements

Club announcements are just `Announcement` records with `targetType: CLUB` and a `clubId`. They appear in:
- The club workspace overview and related announcement views
- The global announcements list (for members only)
- Push notifications (if user has CLUB_ANNOUNCEMENT preference enabled)

---

## Club Channels, Tags, and Mentions

Each club can define Teams-like channels:

- Public channels are visible to any club member or sponsor.
- Private channels are limited to explicitly assigned channel members, plus club sponsors and admins.
- Leaders, sponsors, admins, and super admins can create channels and custom tags.
- Channel creation prefers `memberIds` from the club directory UI. `memberUniqueIds` is still accepted for backward compatibility.
- Custom tags are built from the **current club member list** in the UI rather than free-typed comma-separated student IDs.

Supported mention styles inside channel messages:

- `@all` for everyone who can currently access the channel
- `@leaders` for club leaders
- `@sponsors` for club sponsors
- `@tag-name` for custom club tags
- `@STU001` for a direct user mention by `uniqueId`

Mentions create `CLUB_CHANNEL_MENTION` notifications. Those notifications appear in the web app and deep-link into the matching club channel.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/clubs` | All active clubs |
| GET | `/clubs/my` | Clubs I'm a member or sponsor of |
| GET | `/clubs/my/invites` | My pending invites |
| GET | `/clubs/:id` | Club detail with visible channels, tags, sponsors, and a combined member directory |
| GET | `/clubs/:id/channels` | List club channels + tags |
| POST | `/clubs` | Create club with required `sponsorIds` (admin only) |
| POST | `/clubs/:id/invite` | Send invite by `uniqueId` |
| POST | `/clubs/:id/invite/csv` | Bulk invite from CSV |
| POST | `/clubs/:id/channels` | Create a public or private channel using `memberIds` / `memberUniqueIds` |
| POST | `/clubs/:id/tags` | Create a reusable mention tag using `memberIds` / `memberUniqueIds` |
| GET | `/clubs/:id/channels/:channelId/messages` | Fetch channel messages |
| POST | `/clubs/:id/channels/:channelId/messages` | Post a channel message with mentions |
| POST | `/clubs/invites/:inviteId/respond` | Accept or decline invite |
| POST | `/clubs/:id/members/:uid/promote` | Promote member to leader |
| POST | `/clubs/:id/members/:uid/remove` | Remove member |

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
| Create channel/tag | Sponsor, Leader, ADMIN, SUPER_ADMIN |
| Read/post in public channel | Club members, sponsors, ADMIN, SUPER_ADMIN |
| Read/post in private channel | Explicit channel members, sponsors, ADMIN, SUPER_ADMIN |

---

## Web Pages

- `/clubs` — workspace landing page with pending invites, club search, sponsor-aware club creation, and membership/sponsorship sections
- `/clubs/:id` — club workspace with channel rail, quick-action sheets, searchable directory, and member-based tag creation
- `/clubs/:id/channels/:channelId` — three-pane chat layout with channel rail, live composer, mention helpers, and audience visibility panel

---

## Related

- [[announcements]] — Club-targeted announcements
- [[events]] — Club events go through the event approval flow
- [[notifications]] — Club announcement and channel-mention notifications
