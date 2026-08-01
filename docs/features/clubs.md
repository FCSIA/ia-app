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
- Lets members search channel names and message history, then open a result in
  its conversation.
- Collects files and images previously shared in each readable channel.
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
- `api.clubs.shared.listChannelAttachments`
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
rich representations so mobile and web show the same message. Web authoring
uses Plate for rich marks and structured mentions, while read-only timelines use
`react-markdown`, `remark-gfm`, and shadcn/typeset. Markdown-style `http` and
`https` links remain clickable after Plate content is serialized.
Person mentions show the member's name while their portable `user://` link
keeps the stable school unique ID used for backend resolution.

The club workspace shell uses a narrow navigation query rather than subscribing
every club route to the full member, tag, request, and message-count payload.
Channel pages fetch only their header and permission context at first; the
bounded people/tag mention audience is loaded when a composer receives focus.
This keeps live chat subscriptions focused on data that can actually change the
conversation being viewed.

## Permissions

Admins create clubs. Sponsors and leaders manage most club-local settings.
Sponsors retain visibility into private channels. Channel read/post permissions
are enforced through `apps/convex/src/clubs/access.ts`. The backend resolves
user, built-in, and custom-tag mentions against that readable audience;
`@all` is manager-only and mention delivery is capped. Message reports accept
only a message id and reason from clients, then derive the club and author after
checking channel access.

`SUPER_ADMIN` club access is presented as administrative rather than personal
membership. The web and mobile club directories omit personal club groups for
super admins, and the web workspace shows the current club without a
membership-based club picker. Membership-only notification controls and the
dashboard's My Clubs widget are also unavailable to that role.

Deleting a channel message immediately removes its body, rich content, poll,
pin, attachments, and reactions from reads. A deleted root remains as a
content-free tombstone while replies still reference it, so an existing thread
does not become structurally orphaned. A bounded scheduled cleanup removes
attachment storage objects and all message-owned relation rows; leaf messages
and empty tombstones are then removed entirely. Deleted messages cannot be
edited, reacted to, pinned, reported, or used as the parent of a new reply.

Shared-content discovery pages through channel messages newest-first, then
returns their attachment rows. This keeps reads bounded, includes thread
replies, and reuses the same private/read-only channel access rules as chat.

## Side Effects

Club management and channel changes create audit rows where implemented.
Channel attachment uploads use Convex storage. A finalized upload becomes a
short-lived, user-owned stage; posting consumes that stage, rechecks storage
metadata, and derives the download URL server-side. Unused stages expire after
one hour and can also be discarded explicitly by the uploader. Message deletion
cleans the consumed attachment rows and their owned storage objects; upload
stages are not retained as message relationships.

## Known Limits

Mention and notification categories are modeled, but full channel notification
fanout should be verified before treating it as production-complete.

## Related

- [Announcements](announcements.md)
- [Events](events.md)
- [Uploads](uploads.md)
- [Notifications](notifications.md)
