---
tags: [feature, announcements, comments]
---

# Announcements

[Home](../index.md)

Announcements are targeted messages shown in the global feed and, when scoped to
a club, inside club workflows.

## What It Does

- Lists announcements visible to the current user, with their personal pins
  first, promoted posts second, and remaining posts ordered newest-first.
- Automatically places announcements more than 14 days old in the collapsed
  Past Announcements section without changing their stored publication status.
- Treats an active announcement as expired when its `expiresAt` time has passed;
  it remains stored as `ACTIVE` and appears under Past Announcements.
- Searches the visible feed by title, body, author, club, grade, and pathway
  while preserving the all, unread, and saved filters.
- Supports detail pages, comments, read/unread state, bookmarks, archives, and
  personal pin/unpin actions. Archived and expired posts stay collapsed
  under Past Announcements until requested.
- Supports school-wide, grade, pathway, club, and intersection targeting.
- Supports pending approval for some club-scoped posts.
- Supports up to three signed PNG, JPEG, GIF, or WebP image uploads per post,
  plus up to three HTTPS link embeds rendered as safe outbound cards.
- Authors can use the visual editor for common formatting or switch to Markdown
  for links, lists, tables, code blocks, and other supported Markdown.

## Feed interaction

The feed exposes All, Unread, and Saved as labeled icon toggle choices. Search
and the advanced audience/read/saved filters compose with these choices; clearing filters
also clears the search. Both the current feed and the expanded past section use
the same matcher, including human-readable grade and pathway metadata. Results
reflect the loaded pages; loading more continues the current filter.
The compact filter panel keeps Read, Saved, and Audience visible and discloses
grade, major pathway, minor pathway, and club choices in independent accordions.
Collapsed facets summarize their selections; changing a scope preserves the
other criteria. The creation action is a plus button with an accessible label
and tooltip.

Unread posts use the owner-approved shared Card attention state: a neutral,
rounded surface and a stronger title. The full feed gives every post the same
quiet outline, so reading changes emphasis without removing its boundary.
Per-post read badges are omitted; both states retain foreground title contrast. Reading preserves ordering in All.
Attention is independent of selection and composes with the shared translucent
hover layer. Both views use the owner-approved compact CardGroup corners (12px),
including hover and focus. Read state is also included
in the card's accessible name. Audience metadata shows actual
grades and pathways: a graduation-cap badge identifies grade numbers, while
pathway and club names remain readable text. The list, dashboard, club previews,
and detail share the same audience model, including legacy/array targeting and
intersection conditions. Accessible text preserves the complete audience.

The dashboard's “Unread Announcements” widget derives a compact preview from the same component, with the title
followed by metadata beside independent actions. Its header establishes that the
collection is unread, so individual previews omit repeated read labels and the
excerpt. Its empty state uses the shared unframed Empty composition within the
existing widget boundary. Both surfaces use the approved separated CardGroup layout so adjacent
rounded surfaces have breathing room, with shared proximity hover. Neither uses
a left accent border that conflicts with the rounded
hover treatment. Widget text aligns with the panel heading, with an explicit
gap before the first card. Panel titles wrap within their available width while
keeping the adjacent action on the same row.

Personal pins are labeled “Pinned for you” and keep posts at the top of that
user's feed. The full feed groups personal pins, Important, and Latest without
reordering posts when their read state changes. Pin/unpin keeps keyboard focus
with the moved post's action trigger. Admin-promoted posts are labeled “Important,” including the composer
option “Mark important for one month.” Saved is the personal bookmark collection; it is
not presented as another form of pinning. The shared Card owns navigation,
including passive footer text and gaps. Read/save/comments remain independent;
personal pin and archive commands are in the existing Dropdown action menu.
Saved bookmarks use a filled primary-color icon and the existing outlined,
active Button treatment. The persistent circle differs from an unsaved button's
transient hover surface. Comment counts use the
serialized count rather than the obsolete relation-count field. With no comments,
the action uses its recognizable icon instead of a redundant Reply label, keeping
the four touch actions together at 320px. Actions remain
visible in the dashboard. Read actions use icons with tooltips and accessible
labels. The full feed keeps the sender's name beside a reusable clickable avatar
that opens the existing profile dialog. Its author projection includes photo and
roles without adding sign-in identifiers or contact fields. Failed read/save
writes surface a toast so users can retry.

The desktop toolbar places feed choices, search, filters, and the plus button together.
Narrow layouts deliberately split search/filter controls from feed/create
controls. Section headings have a separate gap before the cards. Filter headings
align with the leading controls, while the shared primitives retain ownership of
option padding and corners. Read and Saved use compact Select controls; the
bounded ScrollArea preserves access to long facet lists. Select and Dropdown
share fixed concentric popup corners, independent of the trigger shape and
application radius token. Nested portals share an overlay layer so the inner
menu paints above its parent and restores focus when dismissed. RadioGroup resolves hover in two dimensions so wrapping choices
cannot highlight a different option from the pointer target.

## Source Files

- Backend: `apps/convex/src/announcements/`
- Web list/detail: `apps/web/src/app/announcements/`
- Club announcement dialog: `apps/web/src/components/clubs/dialogs/announcement-dialog.tsx`

## Convex Surface

- `api.announcements.feed.listPage` (cursor-paginated; accepts archived, unread, and saved filters)
- `api.announcements.feed.list` (bounded compatibility list for compact consumers)
- `api.announcements.feed.listPinnedPage` (cursor-paginated personal pins)
- `api.announcements.feed.listPastStatusPage` (cursor-paginated recent archived, rejected, and expired records)
- `api.announcements.feed.get`
- `api.announcements.feed.create`
- `api.announcements.feed.approve`
- `api.announcements.feed.reject`
- `api.announcements.comments.list`
- `api.announcements.comments.add`
- `api.announcements.comments.remove`
- `api.announcements.engagement.markRead`
- `api.announcements.engagement.markUnread`
- `api.announcements.engagement.bookmark`
- `api.announcements.engagement.unbookmark`
- `api.announcements.engagement.pin`
- `api.announcements.engagement.unpin`
- `api.announcements.engagement.archive`

## Data Model

- `announcements`
- `announcementImages`
- `comments`
- `announcementReads`
- `announcementBookmarks`
- `announcementPins`

Targeting fields live on the announcement document. Read, bookmark, and pin state are
separate child tables so they can grow per user without bloating the
announcement document. Image uploads are staged as user-owned records, checked
against storage metadata and file signatures, then consumed into
`announcementImages` only when the announcement is created. Arbitrary iframe
markup is not accepted; embeds are validated HTTPS URLs and open externally.

## Permissions

Teachers and admins can create announcements. Global announcement approval is
limited to admin/support roles; club-scoped pending announcements can also be
approved or rejected by that club's sponsors. Any user who can view an active
announcement can pin or unpin it for their own feed. Comment and archive permissions are enforced inside the Convex
mutations.

## Side Effects

Announcement creates, approvals, rejections, read/unread changes, archives, and
comment writes create audit events where implemented.

## Known Limits

Notification fanout for announcement creation is modeled in the notification
schema but is not the main active delivery path yet. Add explicit delivery logic
before relying on announcement notifications.

## Related

- [Clubs](clubs.md)
- [Moderation](moderation.md)
- [Notifications](notifications.md)
