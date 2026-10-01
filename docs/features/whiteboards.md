---
tags: [feature, clubs, channels, whiteboards, audit]
---

# Whiteboards

[Home](../index.md)

Club channels have collaborative whiteboards built on the MIT-licensed
[Excalidraw](https://github.com/excalidraw/excalidraw) editor, synced and stored
entirely in Convex. No third-party service receives board content.

## What It Does

- Each channel has any number of named whiteboards under its **Whiteboards** tab.
  The list shows a preview, who edited last, and how many people are on each
  board now.
- Everyone who can read the channel can open, draw on, rename, duplicate,
  archive, and restore every board in it. Boards are never narrower than their
  channel; read-only channels restrict chat posting, not whiteboards. Admins
  reach every board through their elevated channel access.
- Changes save automatically about a quarter second after each finished stroke,
  shape, text edit, or move, and appear live for everyone. Other people's
  cursors are shown and smoothed between updates. A shape the server cannot
  store (for example an oversized freehand stroke) is reported and stays on the
  drawer's screen without blocking later saves; shapes refused because the board
  is full are retried the next time that person erases something.
- **Duplicate** copies every live element on the server in bounded batches, so
  large boards copy completely; an open board sends its unsent strokes first.
- **Version history** lists every change, coalescing consecutive edits by one
  person (removals always get their own entry, so there is a restore point just
  before anything was erased). Any version can be previewed and restored;
  restoring is itself a new version, so it can be undone the same way.
- Archiving hides a board and makes it read-only. Archived boards stay under
  **Archived**, which loads on demand a page at a time, and anyone in the
  channel can restore them. Nothing is hard-deleted.
- A channel can have up to 100 active boards. The archive is unlimited and
  never counts toward that limit; restoring a board is refused while the
  channel is at the limit.
- Excalidraw's own menu exports PNG and SVG.
- Images, embeds, and iframes are rejected until they have reviewed storage and
  an allowlist; element links are limited to `http(s):` and `mailto:`.

## Source Files

- Backend: `apps/convex/src/clubs/whiteboards.ts` (functions) and
  `apps/convex/src/clubs/whiteboardElements.ts` (validation, reconciliation,
  restore planning)
- Web: `apps/web/src/components/clubs/whiteboard/`
- Admin snapshot: `apps/web/src/app/admin/_components/audit/whiteboard-audit-snapshot.tsx`
- Fonts: `scripts/copy-excalidraw-assets.mjs` copies Excalidraw's fonts into
  `apps/web/public/excalidraw-assets/` before `dev` and `build`, because the
  site CSP only allows same-origin fonts. The copy is generated, not committed.

## Data Model

| Table | Purpose |
| --- | --- |
| `clubWhiteboards` | Board per channel: title, last activity, `isArchived` (indexed with channel and last edit so active and archived boards are read separately). Drawing refreshes the activity at most every 30 seconds, through one deferred catch-up, so the board list does not re-run on every stroke. |
| `clubWhiteboardClocks` | A board's high-churn write state: the `seq` logical clock, exact live element count, and latest edit. |
| `clubWhiteboardChannelCounts` | Exact active and archived board counts per channel, updated by create, archive, unarchive, and cleanup. |
| `clubWhiteboardElements` | Latest state of each element (JSON), indexed by board and `seq`. Erased elements stay as tombstones for 24 hours so stale clients cannot resurrect them, then a cron prunes them. Elements created and erased before their first save are never stored. |
| `clubWhiteboardHistory` | Append-only record of every accepted element write, indexed by board and `seq`, and by board, element, and `seq`. |
| `clubWhiteboardRevisions` | Member-facing version history (coalesced saves and restores), each linked to its audit row. |
| `clubWhiteboardThumbnails` | Small WebP/PNG preview, kept apart from the board row. |
| `clubWhiteboardCursors` | Pointer positions, read only by the open board's cursor subscription. |
| `clubWhiteboardPresence` | Who has a board open, refreshed at most every ten seconds per viewer; the board list counts these rows, so pointer movement never re-runs it. |

## Sync Design

Every accepted element write takes the board's next `seq`. Clients load and
follow a board through `listChanges({ boardId, afterSeq })`, advancing the
window as rows arrive, so a re-run reads only the recent tail of the board
instead of the whole board. Wall-clock time cannot serve as the cursor because
concurrent mutations may commit out of timestamp order.

Writes follow Excalidraw's reconciliation rule: a higher element version wins,
and a version tie goes to the lower `versionNonce`. Stale writes are ignored.
Clients count a received element as synced only when the scene adopted it, so
a local edit that wins a version tie is still sent. Within a save, removals are
applied before additions.

Version previews and restores roll the live board back through the history
written after the chosen version (looked up per element), so their cost follows
how much changed since then, not how long the board has existed. Previews are
fetched once per selection rather than subscribed to.

Clients hold back elements that are still being drawn, typed, dragged, resized,
or rotated, so one gesture becomes one save. Pointer positions are sent about
six times a second and animated between updates on the receiving side.

## Permissions

Access is resolved through the channel's existing `getChannelAccess`: `canView`
grants full whiteboard use. Outsiders receive `null` from queries and
`Not authorized` from mutations. Board snapshots for audit review require
`ADMIN`, `SUPER_ADMIN`, or `SUPPORT_STAFF`, matching the audit log.

## Channel Setting

Whiteboards are on in every channel by default (`clubChannels.whiteboardsEnabled`
is absent). Anyone who can edit channels can turn them off for a single
channel in that channel's settings, under **Whiteboards**. While off, the
channel's Whiteboards tab is hidden, its whiteboard links open the chat,
queries return `null`, and mutations fail with "Whiteboards are turned off in
this channel". Other channels are unaffected. Nothing is deleted: turning
whiteboards back on restores every board as it was, and staff audit snapshots
keep working throughout. Each change writes a `CLUB_CHANNEL_WHITEBOARDS_ENABLED`
or `CLUB_CHANNEL_WHITEBOARDS_DISABLED` audit row.

## Audit

Every create, rename, archive, unarchive, and restore writes an `auditEvents`
row with entity type `ClubWhiteboard`, and so does every edit revision. Edits
coalesce into their revision's audit row the same way revisions do (one person,
within five minutes, removals never merged with additions), and only while that
row is still the board's newest audit entry, so the log's order stays truthful.
Coalesced rows record `saveCount`, the full `seq` range, summed counts, and up to
25 itemized changes with text previews; `clubWhiteboardHistory` keeps every
individual write.
The admin audit detail resolves the board's current title, club, and channel,
links to the board, and renders the board as it stood right after that change
from the retained history.

## Retention

Deleting a channel clears every board's live elements, cursors, presence, and previews,
one bounded batch per scheduled run, and archives the active boards. Board rows, element history, revisions, and audit rows are
kept so staff can still review what was drawn.

## Known Limits

- Mobile (Expo) has no whiteboard view yet.
- Boards hold up to 5,000 live elements; a channel holds up to 100 active
  boards and any number of archived boards.
- Search filters active boards and the archived boards loaded so far.
- Restoring a version is limited to about 10,000 writes made since that version
  and 3,000 elements to change. Previews of versions further back are rebuilt
  from history and may be shown partially.
- Cursor presence is polled from a small Convex table rather than a websocket
  relay, so cursors move at roughly six updates a second. Presence is
  hand-rolled rather than the `@convex-dev/presence` component, which would need
  component code generation against a deployment to adopt.

## Related

- [Clubs](clubs.md)
- [Audit log](audit-log.md)
- [Moderation](moderation.md)
