# Channel chat audit repairs — 2026-10-22

Implementation follows the owner's “do as the plan says” approval for the audit's
shared APIs and layout changes. This ledger records code coverage, not design
approval. All material visual changes await design-owner review.

## Finding ledger

| ID | Implementation | Evidence / remaining validation |
| --- | --- | --- |
| F1 | Shared `MarkdownBody` uses GFM + `remark-breaks`; chat and announcement preview/detail adopt it. | Two-line messages render as two lines in the fixture. Mobile plain text preserves newlines; formatted native Markdown remains unverified on device. |
| F2 | `MessageAvatar` owns a fixed 36px gutter. | Head and follow-up body edges align in desktop/phone diagnostics. |
| F3 | `Message grouped` owns head/follow-up padding; timeline gap removed. | Diagnostic captures; human visual review pending. |
| F4 | `MessageActions` floats above the row; text measure capped at 75ch. | Primitive repair, no page offset workaround. |
| F5 | One Toggle-based `ReactionPicker` reflects viewer state, closes on pick; Shift keeps it open. | Shared by desktop, context menu and sheet. Touch gesture checks pending. |
| F6 | Optional `editedAt` is set only by content editing; pinning leaves it and `updatedAt` unchanged. | Backend test covers edit then pin/unpin. Old records cannot recover historical edit provenance. |
| F7 | Edited metadata is plain text with edit-time Tooltip. | No dead history button. |
| F8 | Pin state no longer participates in grouping. | Grouping depends on author/day/time. |
| F9 | Pin state is a muted glyph with Tooltip. | Shared row rendering in timeline/thread. |
| F10 | One action-group model drives Fluid More, ContextMenu and touch sheet. | Labels/order/permissions are shared; native Dropdown close-focus lifecycle exposed for composer focus. |
| F11 | Context timestamp is one muted line without seconds. | Audit message URLs also open the target, including its thread when applicable. |
| F12 | Follow-up gutter contains its own timestamp, visible on hover/focus/coarse pointer. | Phone-width diagnostic. |
| F13 | Desktop reaction details use a concise Tooltip; long press opens paginated details. | ≤3 names + remaining count. Physical touch/hold check pending. |
| F14 | Inline editor is inside `MessageContent`; Check saves, Enter saves, Escape cancels, hints are clickable. | ArrowUp opens editor; rich and legacy Markdown source receive focus. Escape returns focus to composer. |
| F15 | Delete dialog shows avatar/name/two-line preview and plain deletion copy; Shift+Delete bypasses it. | Copy states deletion for everyone; does not promise full retained content that the backend does not store. |
| F16 | Labeled header search is available at every width and calls backend `searchMessages`. | Older result, term highlight and jump verified in fixture; backend access test covers older item. |
| F17 | Single-line Thread header matches 56px header; docks share a 64px minimum and omit competing top rules. | Variable-height composers can grow independently; exact alignment with multiline drafts still needs owner review. |
| F18 | Mention suggestions include avatar + club role, with People/Groups sections. | Backend projection test covers role/avatar; shared MentionInput rendering. |
| F19 | Reply segment belongs to composer wrapper; placeholder names target; target row highlights; Escape cancels. | Reply focus/placeholder/Escape verified. |
| F20 | Empty channel uses the start-of-channel name/description. | Dashed repeated empty card removed. |
| F21 | Channel actions share `ClubWorkspace` header; phone secondary actions live in Channel options. | Removed second toolbar; fixture header uses actual action content but mocks outer workspace. |
| F22 | Pin count uses shared Button `badge` slot anchored outside icon content. | Parent owns Button contract; chat adopts it. |
| F23 | Removed forced 13px text; 75ch cap; chat-only list-item flow token tightens list rhythm. | Actual typeset scale visible in desktop/phone fixture. |
| F24 | Mention surface/rail use theme tokens and an inset rounded rail. | Parent supplies theme-specific tokens. Six-theme review pending. |
| F25 | Composer `clear()` replaces value in place and restores selection/focus without remounting. | Failed and consecutive successful sends leave the contenteditable focused. Native iOS keyboard check pending. |
| F26 | Failed sends retain original payload/files/poll and display server reason with Retry/Delete; retry reuses client identity. | Failure/retry fixture + backend idempotency test. Retention is workspace memory, not persistence across reload/closing the tab. |
| F27 | Independent indexed `listPinned` query returns up to 100 pins + hasMore. | Pin outside newest 40 messages and private/outsider refusal tested. Header displays bounded count honestly with +. |
| F28 | Server search replaces loaded-window filtering; one-line empty text. | Search outside initial history and authorization tested. Results bounded to 30 with + indicator. |
| F29 | Posting advances author's receipt; unread boundary skips own/optimistic posts. | Backend receipt and shared unread tests. |
| F30 | Reaction tap toggles with optimistic state/haptic; hold opens details. | Physical touch behavior remains unverified. |
| F31 | Removed passive touch-listener `preventDefault`. | Source verification; real swipe check pending. |
| F32 | Composer tools use shared control sizes, including coarse-pointer 44px targets. | Parent owns shared InputControlButton fix. |
| F33 | Read-only notice is a single inline line in the dock. | No framed two-line replacement card. |
| F34 | Removed dock top rule; empty Send is ghost; composer uses shared InputControl surface. | Fixture shows single composer edge. |
| F35 | History-start sentinel automatically requests older pages with fallback control; new-message button carries count. | Source/compilation checked; long live-history scroll restoration remains integration validation. |
| F36 | Sidebar/header share `ClubChannelVisibilityIcon`. | Removed duplicate trailing visibility glyph in sidebar. |
| F37 | Group window reduced to seven minutes; every follow-up has its own time. | Shared grouping source; visual diagnostic. |
| F38 | Timeline/composer anchor left; only body measure is capped. | Width diagnostics; actual resizable workspace integration unverified. |
| F39 | GIF picker is an anchored Popover with search and a three-column aspect-ratio grid. | Modal/list anatomy removed. |
| F40 | Selection toolbar offers B/I/U; shortcuts remain. | Formatting removed from nested tools panel. |
| F41 | ContextMenu/HoverCard adopt popup shape/surface contract; chat popup shape overrides removed. | Current Fluid rendered/Code/API/registry and local adapters inspected. Parent owns Popover repair. |
| F42 | Sidebar and thread use surface-1; timeline/dock use card. | Six-theme and full-workspace owner review pending. |
| F43 | Resize grip appears only on hover/focus/active drag. | Installed v4 separator's `data-separator="active"` confirmed in source. |
| F44 | Presence avatar ring uses card surface. | Shared component repair. |
| F45 | Double-tap tutorial is remembered after learned gesture/preference change; subsequent holds use compact control. | localStorage state; physical gesture review pending. |
| F46 | Whiteboards repeated heading removed; shared edges; pins stay in header. | Whiteboard app was mocked in fixture; live integration pending. |
| F47 | Poll builder is an anchored Popover; inputs share defaults; dock keeps a compact summary. | Source/compilation checked. |
| F48 | Escape cancels reply/edit/thread; empty ArrowUp edits last own message; channel-scoped typing uses installed presence component. | ArrowUp/Escape fixture checks; typing auth, room isolation and disconnect backend test. Native keyboard review pending. |
| F49 | Undefined context renders skeleton rows/title/navigation; null renders access failure. | Loading fixture shows skeleton and no false access error. |
| F50 | Reaction chips use Toggle pressed fill + ring, and shared touch targets. | Uses primitive state instead of styling Button's missing border. |
| F51 | Message authors project sponsor/custom club role; muted role follows name. | Role serialization and mention projection tested; sponsor visible in fixture. |

## Cross-page and cleanup coverage

- Shared Markdown renderer covers chat, announcement detail and editor preview.
- `PersonTrigger` (audit repair agent) replaces chat's bespoke profile preview.
- Parent owns ClubMark/ClubListRow and canonical ClubPersonAvatar migration,
  Button badge, Empty/Panel, theme tokens and common control dimensions.
- Pinned-message destinations use CardGroup/Card navigation composition.
- Removed zero-importer AI `input-message` / `chat-message` adapters and chat's
  no-op Bubble wrappers. No remaining importer was found before deletion.
- Announcement comments Message/comment composer and shared media ImageViewer
  adoption are the next coherent follow-up, not covered by the initial chat UI
  commit. Timestamp formatter consolidation remains a cross-page follow-up.

## Verification

All project commands used `direnv exec .`. No shared backend was deployed,
seeded or reset. The temporary fixture mocks router/auth/Convex/outer workspace;
it bundles actual chat, composer and primitive source.

- Focused Convex tests: **20 passed across 5 files** (`channelAuditRepairs`,
  `channelUnreadBoundary`, `channelReplyPings`, `channelMessageJump`,
  `channelMarkdown`). Includes private/outsider refusal, older pins/search,
  idempotent retry, own read receipt, edit provenance, author role, mention
  projection, typing room isolation and disconnect.
- Backend typecheck passed after backend implementation. Combined checks are
  coordinated by the parent agent.
- Web lint passed: **0 errors, 19 existing warnings**. Latest web typecheck had
  only concurrent dashboard MyClubsWidget inferred-union errors; no chat errors.
  Parent is repairing that independent slice and running final combined checks.
- Production build is a parent integration check; not independently repeated.
- Browser fixture: focus retained after failed send and consecutive sends; server
  rejection text retained; Retry succeeds; ArrowUp editor focuses Markdown source;
  Escape cancels and restores focus; Reply names target and cancels with Escape;
  older search/pin result appears and jumps; loading is a skeleton. Diagnostics at
  320px and 390px show no page overflow. Actual sidebar/global-header integration,
  live multi-user presence, native touch and iOS keyboard were not exercised.
- Diagnostic captures and fixture source: `/tmp/ia-chat-audit-repairs/`, including
  `failed-send.png`, `loading.png`, `phone-390.png`, `phone-320.png`. These are
  ephemeral diagnostic artifacts, not approved designs.

Material visual changes remain awaiting the design owner. Native device checks,
six-theme review, and live backend integration are remaining validation gates.
