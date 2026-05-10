---
tags: [feature, clubs, membership, channels]
---

# Clubs

← [[index|Home]]

---

## Overview

Clubs are student organizations with a full workspace model: announcements, channels, mention tags, invites, and a searchable member directory.

### Access Control
Clubs can be joined in three ways:
1. **Invite**: A sponsor or leader sends a direct invite.
2. **Join Code / QR**: A club can generate a unique alphanumeric code and QR/link; students with either can join instantly.
3. **Request**: If a club's `joinPolicy` is `REQUEST`, students must submit a join request that leaders or sponsors must then approve.

Every club must have **at least one teacher sponsor**. Sponsors automatically retain visibility into **every** channel, including private channels.

---

## Join Workflows

### 1. Direct Invite
```
Sponsor or Leader sends invite
         ↓
ClubInvite record created (status: PENDING)
         ↓
Recipient accepts in /clubs
```

### 2. Join Request (Optional Policy)
If the club `joinPolicy` is set to `REQUEST`:
```
Student clicks "Request to Join"
         ↓
ClubJoinRequest created (status: PENDING)
         ↓
Sponsor or Leader approves/declines in the club management tab
```

### 3. Join Code
Sponsors can generate or rotate a **Join Code**. The people page also exposes a QR/link for the active code. Any student who enters the code or opens the link joins the club immediately, bypassing the request/invite flow.

---

## Club Announcements

Club announcements are `Announcement` records with `targetType: CLUB`. Admins and sponsors publish directly. Student leaders submit proposals that sponsors/admins approve; approval immediately publishes the announcement to the club workspace and global feed for members.

---

## Club Channels and Visibility

Channels now support a 3-tier visibility model:

| Visibility | Who can see/read | Who can post |
|------------|------------------|--------------|
| **Public** | All club members | All club members |
| **Private** | Explicitly assigned members | Assigned members |
| **Member Read-Only** | All club members | Leaders & Sponsors only |

Direct user mentions trigger `CLUB_CHANNEL_MENTION` notifications. Built-in and custom tag mentions (`@all`, `@leaders`, `@sponsors`, `@tag-name`) trigger `CLUB_CHANNEL_TAG_MENTION` notifications. Users can opt into all-message channel notifications with `IN_APP`, `PUSH`, or `TIME_SENSITIVE` preference levels.

---

## API Surface

| Method | Path | Description |
|--------|------|-------------|
| GET | `/clubs` | All active clubs |
| GET | `/clubs/:id` | Detailed club workspace data |
| POST | `/clubs/:id/join` | Join via Join Code |
| POST | `/clubs/:id/request` | Submit a Join Request |
| POST | `/clubs/:id/invite` | Send invite by `uniqueId` |
| POST | `/clubs/:id/channels` | Create Public, Private, or Read-Only channel |
| POST | `/clubs/:id/requests/:rid/respond` | Approve/Decline a join request |
| PATCH | `/clubs/:id/join-code` | Rotate or clear the club's join code |

Only admins can create new clubs. Within a club, Sponsors and Leaders manage membership and content.

---

## Related

- [[announcements]] — Club-targeted announcements
- [[events]] — Club events go through the event approval flow
- [[notifications]] — Club announcement and channel-mention notifications
