# Android chat verification

The supplied `Screen_Recording_20261002_104654_Chrome.mp4` shows the web chat
in Android Chrome. Verification used the visible Pixel_9 emulator, Android
Chrome, the local production web build at `http://localhost:3000`, and the
existing isolated deployment `local:local-rebanto_nath-ia_app-1`. No shared or
production deployment was changed. This does not certify the separate Expo
native client.

## Fixes

- Ordinary taps no longer trigger the navigation swipe's cancellation spring.
  A canceled or superseded close animation cannot mark a newly opened sidebar
  inert. This fixes the visible sidebar passing taps to message authors behind it.
- Android mention input waits two animation frames before taking focus, allowing
  Slate's pending IME selection flush to finish. Typing `@` now keeps the member
  picker open instead of immediately canceling it to plain text.
- Formatting and the mention toolbar activate through the button's click event
  and focus the editor before changing its contents. These tools work on a newly
  mounted empty composer after sending, including keyboard activation.

These changes preserve the existing component appearance and APIs. Source
commit: `c8ca84ba` (`chat: restore Android navigation and composer interactions`).

## Device checks performed

Checks used real Chrome touch events, Android text insertion, and native ADB
touches rather than desktop mouse interaction alone.

| Area | Verified behavior |
| --- | --- |
| Sidebar | Open each of general, announcements, resources, events, and projects; repeated close/reopen; canceled partial swipe followed immediately by menu open; vertical scroll followed by menu open; complete opening/closing swipe. Open pane stays interactive, with no inert or hidden state left behind. |
| Mentions | Type `@`, search Jane, select Jane Smith by touch; select with Enter without sending early; send and render a named mention; use Mention someone on a fresh unfocused composer. |
| Message actions | Long press opens the message drawer; select/cancel reply; open/close a thread; edit and save an own message; add/remove a Like reaction; cancel deletion of the disposable attachment, then confirm deletion and verify it disappears. |
| Overlay | Tap the message drawer backdrop over the underlying navigation button: dismisses the drawer without opening navigation. |
| Formatting | Bold, italic, and underline survive sending; Enter activates the italic toolbar button. |
| Attachments | Preview/remove a text file; send an attachment-only message; fetch its stored URL and compare all 43 bytes with the local fixture. |
| GIFs | Open/dismiss the picker; search imagination; select the SpongeBob result; send its URL and verify the rendered image preview. |
| Search | Open global search on mobile; search projects; inspect channel results; close the dialog. |

## Code checks

- Web TypeScript passed.
- Full web lint passed with zero errors and 21 existing warnings outside the
  changed files. Targeted lint of all four changed files passed without warnings.
- The production web build passed after the final composer change.
- All 17 relevant existing tests passed: channel mentions (4), Markdown (6),
  reply pings (3), and client mention serialization (4).

`direnv` is unavailable on this Windows host. Checks invoked the installed
TypeScript, ESLint, Next, and Vitest Node entry points directly. Three reply-ping
tests exceeded the default five-second timeout under host load; all passed when
rerun with a 60-second timeout.

The local backend also exceeded its default one-second query budget under host
load. Device verification used a temporary process-only
`DATABASE_UDF_USER_TIMEOUT_SECONDS=10` setting. No backend source or deployment
configuration changed; this run does not establish backend performance.

## Review scope and handoff

The member account does not expose poll creation, pinning, or manager moderation
controls, so those privileged workflows were not exercised on the emulator.
Backend mention/reply tests passed, but external push delivery was not tested.
The fixes and device coverage above address the failures shown in the recording;
they are not a certification of every Android device, browser, or account role.

The seeded local student login is `STU001` / `STU001STU001`. The emulator uses
ADB reverse ports 3000, 3210, and 3211. Keep the local web/backend processes running
while reviewing. Local QA messages remain in the isolated Robotics projects
channel; they do not affect production data.
