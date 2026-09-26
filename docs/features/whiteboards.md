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
  cursors are shown and smoothed between updates.
- **Version history** lists every change, coalescing consecutive edits by one
  person (removals always get their own entry, so there is a restore point just
  before anything was erased). Any version can be previewed and restored;
  restoring is itself a new version, so it can be undone the same way.
- Archiving hides a board and makes it read-only. Archived boards stay listed
  under **Archived** and can be restored by anyone in the channel. Nothing is
  hard-deleted.
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
| `clubWhiteboards` | Board per channel: title, `seq` logical clock, live element count, archive state. |
| `clubWhiteboardElements` | Latest state of each element (JSON), indexed by board and `seq`. |
| `clubWhiteboardHistory` | Append-only record of every accepted element write. |
| `clubWhiteboardRevisions` | Member-facing version history (coalesced saves and restores). |
| `clubWhiteboardThumbnails` | Small WebP/PNG preview, kept apart from the board row. |
| `clubWhiteboardCursors` | One presence/pointer row per viewer per board. |

## Sync Design

Every accepted element write takes the board's next `seq`. Clients load and
follow a board through `listChanges({ boardId, afterSeq })`, advancing the
window as rows arrive, so a re-run reads only the recent tail of the board
instead of the whole board. Wall-clock time cannot serve as the cursor because
concurrent mutations may commit out of timestamp order.

Writes follow Excalidraw's reconciliation rule: a higher element version wins,
and a version tie goes to the lower `versionNonce`. Stale writes are ignored.

Clients hold back elements that are still being drawn, typed, dragged, resized,
or rotated, so one gesture becomes one save. Pointer positions are sent about
six times a second and animated between updates on the receiving side.

## Permissions

Access is resolved through the channel's existing `getChannelAccess`: `canView`
grants full whiteboard use. Outsiders receive `null` from queries and
`Not authorized` from mutations. Board snapshots for audit review require
`ADMIN`, `SUPER_ADMIN`, or `SUPPORT_STAFF`, matching the audit log.

## Audit

Every create, edit, rename, archive, unarchive, and restore writes an
`auditEvents` row with entity type `ClubWhiteboard`. Edit and restore rows
itemize up to 25 element changes with text previews and record the `seq` range.
The admin audit detail resolves the board's current title, club, and channel,
links to the board, and renders the board as it stood right after that change
from the retained history.

## Retention

Deleting a channel clears its boards' live elements, cursors, and previews, and
archives the boards. Board rows, element history, revisions, and audit rows are
kept so staff can still review what was drawn.

## Known Limits

- Mobile (Expo) has no whiteboard view yet.
- Boards hold up to 5,000 live elements; a channel holds up to 100 active boards.
- Restoring a version is limited to boards whose history fits one transaction
  (about 10,000 writes to scan and 3,000 changes to apply).
- Cursor presence is polled from a small Convex table rather than a websocket
  relay, so cursors move at roughly six updates a second.

## Related

- [Clubs](clubs.md)
- [Audit log](audit-log.md)
- [Moderation](moderation.md)
