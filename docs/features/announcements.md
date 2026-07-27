---
tags: [feature, announcements, comments]
---

# Announcements

[Home](../index.md)

Announcements are targeted messages shown in the global feed and, when scoped to
a club, inside club workflows.

## What It Does

- Lists announcements visible to the current user.
- Searches the visible feed by title, body, author, club, grade, and pathway
  while preserving the all, unread, and saved filters.
- Supports detail pages, comments, read/unread state, bookmarks, archives, and
  promoted/pinned announcements.
- Supports school-wide, grade, pathway, club, and intersection targeting.
- Supports pending approval for some club-scoped posts.

## Source Files

- Backend: `apps/convex/src/announcements/`
- Web list/detail: `apps/web/src/app/announcements/`
- Club announcement dialog: `apps/web/src/components/clubs/dialogs/announcement-dialog.tsx`

## Convex Surface

- `api.announcements.feed.list`
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
- `api.announcements.engagement.archive`

## Data Model

- `announcements`
- `comments`
- `announcementReads`
- `announcementBookmarks`

Targeting fields live on the announcement document. Read and bookmark state are
separate child tables so they can grow per user without bloating the
announcement document.

## Permissions

Teachers and admins can create announcements. Global announcement approval is
limited to admin/support roles; club-scoped pending announcements can also be
approved or rejected by that club's sponsors. Comment and archive permissions
are enforced inside the Convex mutations.

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
