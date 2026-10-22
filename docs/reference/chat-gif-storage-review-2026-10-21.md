# Chat GIF storage review — October 21, 2026

Issue: [#167](https://github.com/virajdas/ia-app/issues/167).
Branch: `codex/chat-gif-storage`, based on `57e7ddb4`.

## Behavior and composition

Pasting a supported GIF or selecting a catalog entry immediately shows a
composer card. Preparing GIF uses a spinner; completion renders the stored
animation. Send/Save waits for all downloads. Errors explain the failure and
offer Retry and Remove without discarding the caption. Sent GIFs and the
nine catalog posters also use app object storage.

The follow-up separates GIF items from caption state on both clients. Pasted
URLs disappear from the editor, removal updates only the item list, and
serialization/restoration retains the existing message/draft format. Each
card's Remove action shares its header above the image; it no longer reserves
a full-height side column. The rich-text conversion lives in a focused Slate
adapter with tests for marked leaves, mentions, repeated URLs and selection.
Duplicate URL-removal parsing and an unused resolution cache were removed;
in-flight requests now need only a Set.

This is a supported composition of the existing Attachment states
(`processing`, `done`, `error`), Attachment content/actions, Spinner, and Button.
The existing Command/Dialog picker and Plate editor retain their semantics.
Fluid InputMessage's attachment example was considered; its local-file composer
does not replace the established rich-text/mention editor. No shared UI
primitive API or visual language changed. The app-owned AnimatedGif accepts an
error callback so the composer can offer recovery.

References inspected: Fluid's live rendered examples, Code examples, API and
exact registry sources for [InputMessage](https://www.fluidfunctionalism.com/docs/input-message)
and [Button](https://www.fluidfunctionalism.com/docs/button), plus the local
`attachment.tsx`, `spinner.tsx`, and `button.tsx` adapters.
The project remains on the Radix shadcn base.

## Verification

- Follow-up: 15 draft/serialization tests and 31 targeted backend GIF tests pass.
  Regression cases cover a URL split across marked leaves, preserved mention
  identity and selection, duplicate links, code examples, caption edits,
  GIF-only drafts and the five-item bound. Native input synchronization also
  observes the draft revision so a GIF-only paste can clear its URL even when
  its normalized caption stays empty.
- Follow-up browser checks on the isolated local deployment (web 3100,
  backend 3310/3311) confirm URL-free captions, compact headers at desktop and
  390px, loading/error/retry, removal with continued caption editing, send,
  reopening for edit, save and reload. Saved GIF image sources remain
  `/api/storage/` URLs. These temporary servers were stopped after testing;
  the separately running primary checkout was left alone.
- All 466 backend tests across 88 files pass. After the live provider exposed
  static GIFs at its .png poster URLs, the validator was corrected and the
  relevant 21 download/parser tests pass again.
- Backend, web and mobile typechecks pass. Web lint passes with 21 pre-existing
  warnings. The final production build passes.
- The backend review found no outstanding auth, source-validation, bounded-read,
  scheduling, or validator defects in the new functions. Downloads reject
  private/local redirects, bad signatures, wrong media types, oversized bodies,
  and non-cacheable responses. Tests cover retries, expiry and stale completions.
- Live testing used a freshly seeded disposable local Convex deployment in this
  worktree and the production web build. No shared/prod deployment changed.
- Desktop and 390px diagnostics cover actual clipboard paste, immediate loading,
  ready previews, disabled Send, unavailable-media errors, Retry, Remove with
  caption/focus preservation, keyboard picker search/selection, send, and reload.
  DOM inspection confirms timeline GIFs and all nine loaded posters use
  `/api/storage/` URLs. The production CSP excludes GIPHY/Tenor image origins.
- No browser console errors appeared in the tested flow.

After captures are in `/tmp/ia-gif-review/`: `ready-desktop.png`,
`ready-mobile.png`, `error-mobile.png`, and `picker-mobile.png`.
There are no before captures. Reproduce through `/clubs` → Robotics Club →
`#general` in the isolated seeded local app. The channel IDs are local fixtures.
Follow-up captures in the same directory are `followup-ready-desktop.png`,
`followup-ready-mobile.png` and `followup-error-desktop.png`.

## Human review remaining

Material visuals are ready for owner review. Inspect processing, ready, error,
retry, keyboard focus, removal, disabled Send, narrow layout, picker open/selected
states, light/alternate themes and reduced motion. Browser diagnostics used the
current dark theme; alternate themes were not visually reviewed.
Native code was typechecked; native device interaction was not tested.
A school-managed laptop/network must still confirm that the app's storage host
is allowed. No production deployment or GitHub issue update was performed.
