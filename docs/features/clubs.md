---
tags: [feature, clubs, membership, channels]
---

# Clubs

[Home](../index.md)

Clubs are student organizations with membership, sponsors, channels, invites,
join requests, join codes, tags, and a workspace UI.

## What It Does

- Lists active clubs and the current user's club memberships.
- Shows a club workspace with announcements, people, channels, and settings.
- Supports direct invites, bulk CSV invites, open joins, join requests, and join
  codes.
- Supports public, private, and member-read-only channels.
- Supports channel messages, replies, reactions, polls, pins, attachments, and
  mention/tag metadata.

## Source Files

- Backend: `apps/convex/src/clubs/`
- Web routes: `apps/web/src/app/clubs/`
- Shared components: `apps/web/src/components/clubs/`
- CSV parser: `apps/web/src/lib/parse-invite-csv.ts`

## Convex Surface

- `api.clubs.management.getAll`
- `api.clubs.management.getOne`
- `api.clubs.management.create`
- `api.clubs.management.update`
- `api.clubs.management.deactivate`
- `api.clubs.management.setMemberRole`
- `api.clubs.management.removeMember`
- `api.clubs.management.getMyClubs`
- `api.clubs.management.listMyInvites`
- `api.clubs.detail.get`
- `api.clubs.invitations.joinOpenClub`
- `api.clubs.invitations.requestToJoin`
- `api.clubs.invitations.respondToJoinRequest`
- `api.clubs.invitations.sendInvite`
- `api.clubs.invitations.bulkInvite`
- `api.clubs.invitations.respondToInvite`
- `api.clubs.invitations.generateJoinCode`
- `api.clubs.invitations.redeemJoinCode`
- `api.clubs.channels.*`
- `api.clubs.tags.*`

## Data Model

Core tables:

- `clubs`, `clubMembers`, `clubSponsors`
- `clubInvites`, `clubJoinRequests`
- `clubChannels`, `clubChannelMemberships`
- `clubTags`, `clubTagMembers`
- `clubChannelMessages` plus attachments, reactions, poll votes, and mentions

Channel messages keep `body` as a searchable plain-text projection. New rich
clients may also write portable GFM to `bodyMarkdown`; the web client renders it
first and falls back to legacy Plate `bodyRich` content. Edits replace stale
rich representations so mobile and web show the same message.

## Permissions

Admins create clubs. Sponsors and leaders manage most club-local settings.
Sponsors retain visibility into private channels. Channel read/post permissions
are enforced through `apps/convex/src/clubs/access.ts`.

## Side Effects

Club management and channel changes create audit rows where implemented.
Channel attachment uploads use Convex storage.

## Known Limits

Mention and notification categories are modeled, but full channel notification
fanout should be verified before treating it as production-complete.

## Related

- [Announcements](announcements.md)
- [Events](events.md)
- [Uploads](uploads.md)
- [Notifications](notifications.md)
