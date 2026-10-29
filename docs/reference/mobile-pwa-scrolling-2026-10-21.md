# Mobile PWA scrolling verification — October 21, 2026

The iPhone recording shows a channel repeatedly returning toward the latest
message while GIF loading states change. The fix starts from main
`57e7ddb4` (v0.8.38).

## Cause and repair

The main timeline and replies shared a 160px `scrollEdgeThreshold`. The
MessageScroller primitive uses that threshold to resume following the live
edge, as well as to show its scroll control. An upward gesture still inside
that range could resume following; a subsequent content resize then scrolled
to the end. The same behavior can occur with new text, without GIFs.

Both timelines now use the primitive's normal 8px tolerance. Its existing
touch, keyboard, history anchoring, and jump controls retain scroll ownership.

Separately, releasing a far-offscreen GIF's canvas resets its ready state.
The loading label previously entered document flow again, adding a 16px line
until the image reloaded. Loading feedback now overlays the already-reserved
canvas space, preserving loaded message geometry through release and reload.

## Verification

A temporary browser harness compiled the actual local AnimatedGif,
MessageScroller, ScrollArea, AppShell, navigation, header, ScrollPageLayout,
and message-press hook. Account/query services and route navigation were
mocked; GIFs were locally generated animated test media. No live school data
or backend deployment was changed.

The regression was measured before the fix: after scrolling up 80px, resizing
the latest row moved Chromium's viewport from 2232px to 2336px (the live edge)
with the 160px threshold. With 8px it remained at 2232px. Releasing loaded GIFs
previously increased their row heights by 16px; their heights now stay stable.

The browser matrix covers 320, 390, 430, and 1024px widths in Chromium and
WebKit with touch-capable iPhone-style contexts. Checks cover initial live-edge
position, a short upward scroll followed by resize/new messages, loaded GIF
release/re-entry, pause geometry, jump-to-latest and resumed following,
prepended history preserving its visible anchor, and viewport resizing while
reading. Chromium also exercises native touch swipes through the actual
message-press and shell-navigation handlers, including no accidental action
sheet, navigation opening, or rebound. WebKit uses keyboard scrolling because
its mobile automation driver does not support wheel input.

Shared-layout checks cover document scrolling, bounded native ScrollArea panes,
visual-shell document locking, keyboard-sized viewport changes, landscape
overflow, and returning from bounded panes to ordinary document pages.

Web typecheck, production build, and 19 focused media-visibility, navigation
gesture, and viewport tests pass. Web lint passes with 21 existing warnings.
Windows has no direnv; commands used the repository-pinned Bun 1.4.2 directly.
Stale generated types for a deleted preview route were moved aside before the
successful build; no source workaround or typecheck exclusion was added.

These are simulated component/layout checks, not a signed-in route-by-route
production audit or a physical iPhone PWA test. Device-specific Safari behavior
and design-owner visual approval remain outside this verification.

## Device reproduction checklist

Open a channel with several GIFs and text messages. Scroll upward a short
distance from the newest message; incoming messages and GIF state changes
should preserve the reading position. Scroll several screens away and back,
pause/play a GIF, load older messages, open a reply thread, and jump to latest.
Open/close the composer keyboard, rotate the device, then navigate through
ordinary document pages and bounded calendar/admin panes. Each scroll owner
should remain usable without a stuck document lock or horizontal page overflow.

References: [MessageScroller contract](https://ui.shadcn.com/docs/components/base/message-scroller),
[Fluid Scrollbars examples/API](https://www.fluidfunctionalism.com/docs/scrollbars),
and [exact Fluid registry source](https://www.fluidfunctionalism.com/r/scroll-area.json).
The shadcn CLI reports Radix, new-york, and Lucide. The installed headless
MessageScroller source and types were inspected alongside its local adapter;
no primitive implementation or shared API was replaced.
