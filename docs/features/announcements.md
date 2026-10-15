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
