---
tags: [feature, clubs, membership, channels]
---

# Clubs

[Home](../index.md)

Clubs are student organizations with membership, sponsors, channels, invites,
join requests, join codes, tags, nested internal structure, and a workspace UI.

## What It Does

- Lists the current user's memberships at `/clubs` and the full active club
  directory at `/clubs/discover`.
- Shows a club workspace with announcements, people, channels, and settings.
- Lets members search channel names and message history, then open a result in
  its conversation.
- Lets signed-in users find people and every club channel they can read from the
  global command palette.
- Lets club members search the People directory by name, student ID, member or
  sponsor type, club role, and assigned unit/substructure name.
- Collects files and images previously shared in each readable channel.
- Supports direct member adds by sponsors, admins, and club roles with the
  membership-invite permission, including an idempotent bulk unique-ID CSV
  upload that leaves existing members unchanged. Also supports invitations,
  open joins, manager-approved join requests, invite-only clubs, and join
  codes.
- Lets club managers create reusable roles, assign them to members, rename
  them, remove them, and configure their permissions. Role removal explicitly
  confirms any affected channel rules and warns when a channel will become
  club-wide. Removing the default role
  leaves affected members roleless rather than granting a replacement role.
  Roles can be opted into as a People
  directory group; ungrouped roles remain visible on member rows without
  adding another People filter tab.
- Lets club managers model an arbitrary internal tree of programs, teams,
  houses, rooms, subsystems, committees, or other locally named units.
- Assigns club members to any number of units. Unit rows record presence only;
  club roles remain independent from the structure tree.
- Supports manager assignment, open self-join, and revocable code/locally
  generated QR self-join at each unit.

On web, hierarchy administration lives at
`/clubs/[clubId]/settings/structure`, a dedicated two-pane workspace for club
sponsors, club leaders, and admins; ordinary members do not see the management
action. Unit QR links return to the club overview and redeem the specific unit
code after the app confirms the viewer is already a club member.

- Supports public, private, and member-read-only channels.
- Gives every channel its own settings page, where managers can filter access
  by club roles, one structure branch, both filters together, or neither.
- Keeps explicitly selected people as access exceptions for special cases.
- Lets managers drag channels into sibling order and move them inward or
  outward through the structure tree without coupling placement to access.
- Web channel visits show a red Unread divider before the first unread post,
  using the viewer's saved read receipt. The entry boundary stays fixed while
  the channel acknowledges messages; switching channels captures a new boundary.
  Older pages load automatically when needed to locate a previous read position.
  Search results omit the divider, and already-read/empty visits do not acquire
  one when live messages arrive.
- Supports channel messages, replies, reactions, polls, pins, attachments, and
  mention/tag metadata.
- Gives every channel collaborative [whiteboards](whiteboards.md) that all
  channel readers can use.

## Source Files

- Backend: `apps/convex/src/clubs/`
- Web routes: `apps/web/src/app/clubs/`
- Shared components: `apps/web/src/components/clubs/`
- CSV parsers: `apps/web/src/lib/parse-invite-csv.ts`,
  `apps/web/src/lib/parse-unit-assignment-csv.ts`, and
  `apps/web/src/lib/parse-club-structure-csv.ts`

Managers can import a structure CSV with `name,parent,kind` from the Club
structure settings page. A separate People-page assignment CSV accepts
`name,unit,role`; it creates missing club roles when the manager can manage
roles, assigns units, and skips rows for people who are not already club
members. Unit and role changes from one assignment import commit together, and
bulk-created units honor the club's automatic unit-channel setting. It never
invites or adds people.

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
- `api.clubs.management.removeRole` (reassigns affected members to the default role)
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
- `api.clubs.invitations.addMemberDirectly`
- `api.clubs.invitations.bulkAddMembers`
- `api.clubs.invitations.bulkInvite`
- `api.clubs.invitations.respondToInvite`
- `api.clubs.invitations.generateJoinCode`
- `api.clubs.invitations.redeemJoinCode`
- `api.clubs.channels.*`
- `api.clubs.shared.listChannelAttachments`
- `api.search.global.palette`
- `api.clubs.tags.*`
- `api.clubs.peopleGroups.*`
- `api.clubs.hierarchy.*`

## Data Model

Core tables:

- `clubs`, `clubMembers`, `clubSponsors`
- `clubUnits`, `clubUnitMembers`
- `clubInvites`, `clubJoinRequests`
- `clubChannels`, `clubChannelMemberships`
- `clubTags`, `clubTagMembers`
- `clubPeopleGroups`, `clubPeopleGroupRules`
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

### Chat GIFs

The GIPHY storage integration is held pending written provider approval. The
owner chose to retain object storage. A beta key is configured only in the GIF
worktree's local deployment; `GIPHY_STORAGE_APPROVED=false` blocks provider
verification and new downloads. The key alone cannot enable them. The approved
GIPHY picker replacement, caching revalidation and attribution requirements
remain to be implemented after provider approval.

Chat accepts uploaded GIFs through the existing file picker (up to five files,
10 MB each), preserving the original animation. Web and mobile also preview
GIPHY and Tenor links, including Markdown links: share links and direct `.gif`
URLs on their media CDNs (`media*.giphy.com`, `i.giphy.com`, `media*.tenor.com`,
`c.tenor.com`). GIFs on any other host stay ordinary links; the backend
downloader is restricted to these providers rather than acting as an open proxy.
Before storing a linked GIF, the backend requests its GIPHY metadata with
`rating=g` and requires an explicit `g` rating for the exact item. It downloads
the returned rendition, with redirects restricted to the same item. Missing
keys, unavailable or malformed metadata, unknown ratings, and non-G ratings
block storage with a recoverable preview error. Earlier unchecked cache entries
are hidden and revalidated. This check covers picker thumbnails as well.
Tenor links currently fail closed: its documented ID lookup has no rating
filter, and new API clients are no longer accepted. The existing Tenor picker
collection is therefore unavailable until a verified replacement is selected.
Uploaded files continue through their separate file-validation flow; they do
not have provider ratings.
Previews are deduplicated and limited to five per message; code examples stay
text. Web and native composers also offer a searchable, fixed collection of
nine existing online reaction GIFs (SpongeBob, Pikachu, Homer, Spider-Man,
typing cat, Kermit, Jim, Leonardo applause, and Pedro raccoon). The collection
contains no generated media and exposes no provider-wide search. Each entry in
`apps/shared/chat/school-gifs.ts` retains its source page and static thumbnail;
review the complete clip before adding or replacing an entry. Selecting a GIF
adds a GIF draft item, preserving existing text and mentions.

Pasting or selecting a GIF immediately adds a composer preview card and removes
its URL from the editable caption. Loaded previews show the rounded GIF directly,
with no heading or padded frame and a Remove button over its top-right corner. It shows
Preparing GIF with a spinner while the backend downloads the bytes into Convex
object storage, then renders the stored GIF. Send and Save wait for every preview
to be ready. Errors preserve the draft and explain unavailable, oversized, unsupported,
or failed downloads, with Retry and Remove actions. Remove deletes only that
GIF draft item, preserving captions, mentions, and other formatting. URLs are
serialized with the caption only when sending or persisting a native draft;
editing/restoring separates them back into cards.

Sent GIFs render without a filename/status card or Open link. A compact icon button
in the lower-right corner controls playback. Previewed links are hidden from the
message text; surrounding prose and code examples remain. The message's own
context menu (right-click or long-press on web, the message actions sheet on
mobile) offers Copy GIF URL, so a GIF never opens a second menu over the
message actions. GIFs autoplay by default. Appearance settings let
users disable autoplay for this browser/device, starting animations paused while
keeping each play button available. Playback preferences persist locally. Users with
reduced motion enabled start with a paused preview. Enabling
reduced motion stops playback; users can opt in again with Play. Offscreen GIFs,
covered chat timelines, inactive viewer slides, and background pages/apps suspend
playback without changing the user's play/pause choice. They resume only if that
choice permits it when they become visible again.

Web uses shared intersection observers for actual playback and nearby loading.
Paused previews retain a still frame and detach the animated image; far-away
previews also release their canvas backing buffers while preserving layout.
Native uses FlashList viewability plus measured image/scrollport intersections,
keyboard insets, route focus, and one shared app-state subscription. Native playback commands are
serialized so a late start cannot override a newer pause. Unseen images and share
links download only as they approach the viewport (when visible on native).
Reactive cache subscriptions share completion across composers and viewers.
No idle scroll polling is used. Uploaded originals keep their quality and frame rate.

The web fullscreen viewer animates only its active slide while keeping zoom,
swipe, sharing, and original-file access. Its share-file cache is bounded to
eight files/32 MB, and obsolete fetches are cancelled. Uploaded-file composer
and feedback thumbnails show still frames; linked composer previews use the
normal playback preference. The school GIF picker uses static posters.
Unavailable media shows an error and Retry action; its source URL remains
available in the message's context menu. Linked GIFs and catalog posters load
from app object storage on both platforms. The web image policy no longer permits
direct GIPHY/Tenor images.

Tenor share pages are resolved on the backend
with a five-second timeout, a 512 KB response limit, and at most two redirects
within validated Tenor share URLs; a short link that redirects straight to the
Tenor CDN returns that media. Only Tenor CDN GIF URLs are returned; provider
HTML and scripts are never rendered. GIPHY links use their public media URL.
Authenticated mutations coalesce cache misses into one scheduled download per
source in `chatGifAssets`. Only misses and explicit retries count toward the
per-user rate limit. Media downloads have an eight-second deadline, at most two
allowlisted redirects, signature/MIME checks, and a 10 MB limit (1 MB for catalog
posters). Provider cache headers determine expiry, capped at 24 hours;
responses forbidding caching are rejected. Expiry deletes the stored bytes.
Failures are retained for an hour with explicit, rate-limited retry available.
A 30-second watchdog and generation checks prevent stuck requests,
stale completions, or orphaned files. The legacy URL-resolution endpoint remains
available for older clients, with successful resolutions refreshed after 24 hours.

Pasted GIFs remain in the message body, so channel permissions, edits, deletion,
and moderation apply to the message as usual. Uploads retain the existing
signature validation, ownership, staged-upload, and storage-cleanup rules.

### Arbitrary hierarchy contract

`clubUnits` is an adjacency-list tree scoped to one club. `parentUnitId` is
optional, so a club can have several roots, and every node uses the same shape
at every depth. `kind` is a display label rather than an enum: examples include
Program, Team, House, Room, Subsystem, and Committee. This deliberately avoids
encoding Robotics, Pathway Leadership, TSA, or a fixed subclub/group depth in
the schema. A safety limit of 12 levels and 250 active units per club prevents
pathological trees without prescribing the school's organization model.

`clubUnitMembers` records direct, presence-only assignments. A student must
first be a member of the containing club and may belong to several units.
Ancestor membership is not synthesized into database rows; explicit
assignments remain auditable.

Existing club sponsors, club leaders, and admins can manage the full tree.
Units do not create a second role or permission system. Channel roles, access,
and sidebar placement remain independent. A channel may select several club
roles (OR within that filter), one structure unit, or both (AND across the two
filters). An assignment at the selected unit or any ancestor matches the unit
filter, so higher nodes can see descendant channels; child assignments never
gain access to parent or sibling branches. Explicitly selected people are an OR
exception. Club managers, sponsors, admins, and roles with the private-channel
bypass permission can access all channels. The backend resolves these rules at
every channel read/write boundary rather than copying unit membership into
channel rows. Join codes are scoped to one unit and can only be redeemed by an
existing club member.

Channel administration lives at `/clubs/[clubId]/settings/channels`, which owns
sidebar order and structure placement. Each channel's details and access rules
are edited at `/clubs/[clubId]/settings/channels/[channelId]`.

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
`@all` is manager-only and mention delivery is capped. Role names and active
structure branch names are also available as group mentions: their compact
tokens remove spaces and punctuation, so a `School Leads` role can be mentioned
as `@schoolleads`. Structure mentions include descendant units. Every group
mention is intersected with the channel's readable audience before delivery.
Message reports accept only a message id and reason from clients, then derive
the club and author after checking channel access.

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
