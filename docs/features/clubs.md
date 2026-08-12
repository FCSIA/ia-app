---
tags: [feature, clubs, membership, channels]
---

# Clubs

[Home](../index.md)

Clubs are student organizations with membership, sponsors, channels, invites,
join requests, join codes, tags, nested internal structure, and a workspace UI.

## What It Does

- Lists active clubs and the current user's club memberships.
- Shows a club workspace with announcements, people, channels, and settings.
- Lets members search channel names and message history, then open a result in
  its conversation.
- Lets signed-in users find people and every club channel they can read from the
  global command palette.
- Collects files and images previously shared in each readable channel.
- Supports direct invites, bulk CSV invites, open joins, join requests, and join
  codes.
- Lets club managers create reusable roles, assign them to members, rename
  them, and configure their permissions. Roles can be opted into as a People
  directory group; ungrouped roles remain visible on member rows without
  adding another People filter tab.
- Lets club managers model an arbitrary internal tree of programs, teams,
  houses, rooms, subsystems, committees, or other locally named units.
- Assigns club members to any number of units as members or leaders, with an
  optional unit-local leadership title.
- Supports manager assignment, open self-join, and revocable code/QR self-join
  at each unit.

On web, hierarchy administration lives at
`/clubs/[clubId]/settings/structure`, a dedicated two-pane workspace for club
sponsors, club leaders, and admins; ordinary members do not see the management
action. Unit QR links return to the club overview and redeem the specific unit
code after the app confirms the viewer is already a club member.
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
- `api.clubs.management.deletePermanently` (`SUPER_ADMIN` only; exact-name confirmation)
- `api.clubs.management.setMemberRole`
- `api.clubs.management.listRoles`
- `api.clubs.management.createRole`
- `api.clubs.management.renameRole`
- `api.clubs.management.setRolePermission`
- `api.clubs.management.setRolePermissionGroup`
- `api.clubs.management.setRoleDirectoryVisibility`
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
- `api.search.global.palette`
- `api.clubs.tags.*`
- `api.clubs.hierarchy.*`

## Data Model

Core tables:

- `clubs`, `clubMembers`, `clubSponsors`
- `clubUnits`, `clubUnitMembers`
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

### Arbitrary hierarchy contract

`clubUnits` is an adjacency-list tree scoped to one club. `parentUnitId` is
optional, so a club can have several roots, and every node uses the same shape
at every depth. `kind` is a display label rather than an enum: examples include
Program, Team, House, Room, Subsystem, and Committee. This deliberately avoids
encoding Robotics, Pathway Leadership, TSA, or a fixed subclub/group depth in
the schema. A safety limit of 12 levels and 250 active units per club prevents
pathological trees without prescribing the school's organization model.

`clubUnitMembers` records direct assignments only. A student must first be a
member of the containing club, may belong to several units, and can be a
`MEMBER` or `LEADER` independently in each one. Leaders may have a free-form
local title such as Executive, Logistics, House Leader, or Room Leader.
Ancestor membership is not synthesized into database rows; the tree supplies
organizational context while explicit assignments remain auditable.

Existing club sponsors, club leaders, and admins can manage the full tree.
Unit leadership does not grant club-wide administration. Units do not create a
second announcement or club-role system. Channels remain club-owned, but may
use a unit-aware audience: club-wide, a unit and its descendants, unit leaders,
or explicitly selected members. Sidebar placement is independent from audience,
so a club-wide channel can appear under a House without making the House its
only audience. The backend resolves unit ancestry at every channel read/write
boundary; it does not copy unit membership into channel rows. Join codes are
scoped to one unit and can only be redeemed by an existing club member.

Channel managers can enable a club-level default that creates a unit-aware,
private channel whenever a new unit is added. Existing units can be backfilled
through Channel settings; units that already own a channel are left unchanged.

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

Only `SUPER_ADMIN` users can permanently delete a club. The web action lives in
the club overview's existing three-dots menu and requires the club name to be
entered exactly. Deletion immediately deactivates the club, records the actor,
and starts bounded background cleanup for club-owned memberships, hierarchy,
channels and chat storage, tags, announcements, and events. Audit and moderation
history are retained.

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
Hierarchy creation, updates, assignment changes, code rotation, joins, and
archival create club-unit audit rows.
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
