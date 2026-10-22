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
loaded preview is the rounded GIF itself, with no heading, numbering or padded
frame. Remove overlays its top-right corner; playback remains at bottom-right.
The media renderer owns the corners for both animated and paused frames on web
and native. The rich-text conversion lives in a focused Slate
adapter with tests for marked leaves, mentions, repeated URLs and selection.
Duplicate URL-removal parsing and an unused resolution cache were removed;
in-flight requests now need only a Set.

This is a supported composition of the existing Attachment states
(`processing`, `error`), Attachment content/actions, Spinner, and Button.
Ready media follows the existing composer attachment tile's overlay-action
pattern, also present in Fluid InputMessage's FilePreviewTile. It does not
override Attachment padding or corners to force it into a media-only tile.
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
  backend 3310/3311) confirm URL-free captions at desktop and
  390px, loading/error/retry, removal with continued caption editing, send,
  reopening for edit, save and reload. Saved GIF image sources remain
  `/api/storage/` URLs. These temporary servers were stopped after testing;
  the separately running primary checkout was left alone.
- The final shape pass passes web/native typechecks, web lint (the same 21
  existing warnings), and the production build. Desktop and 390px browser
  checks confirm no visible title, matching preview/media bounds, 0px media
  padding, 12px corners, overlaid Remove, and preserved captions after removal.
  Preparing, error, disabled Send, Retry and Remove still work. This pass used
  typed link entry; actual clipboard paste was covered in the earlier pass.
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
The final shape captures are `rounded-ready-desktop.png`,
`rounded-ready-mobile.png` and `rounded-error-mobile.png`.

## Human review remaining

### Rating follow-up

The backend now verifies GIPHY metadata with `rating=g`, requires an explicit
`g` rating and exact item ID, then downloads the returned media rendition.
Cross-item CDN redirects, missing metadata, provider failures and missing keys
fail closed. This applies to catalog posters too. A safety version prevents
unchecked cache entries or outdated in-flight completions from becoming ready.
Unchecked bytes are deleted when their entry is requested for revalidation.
Uploaded files use their separate validation flow and are not provider-rated.

All 501 backend tests across 89 files pass, including 60 focused GIF cases.
Backend/web/native typechecks, web lint (21 existing warnings), the production
build and the isolated local function push pass. Browser diagnostics confirm
that old unchecked timeline GIFs disappear, a missing key produces the safety
verification error, Send stays disabled, and Remove preserves the caption.
Capture: `/tmp/ia-gif-review/safety-unverified-desktop.png`. No console errors
appeared. Successful provider verification is covered with mocked metadata;
no live provider verification or GIPHY media download has been performed.

The user authorized API-key setup via Computer, signed in, chose to replace
the Tenor picker with GIPHY, and explicitly approved API Terms acceptance.
The free beta web API key for "Innovation Academy Chat" was created and
configured only on the worktree's local anonymous backend (3310/3311).
Readback matches the created key without printing its value; the temporary
secret file was removed. No production/shared key configuration was performed.
Tenor's current quickstart says new API clients have not been
accepted since January 2026. Its ID endpoint does not document content filtering,
so Tenor previews and the existing Tenor picker remain blocked.

GIPHY's current [integration requirements](https://developers.giphy.com/docs/api/#prohibited-integration-practices)
require client-side API/media requests and prohibit media caching, rewriting or
storage without prior written approval. Its [API Terms](https://support.giphy.com/hc/en-us/articles/360028134111-GIPHY-API-Terms-of-Service)
also restrict building a GIF directory and require provider/source attribution.
These requirements conflict with the implemented server verification, fixed
catalog and object-storage delivery. The owner chose to retain object storage
and wait for written GIPHY approval. `GIPHY_STORAGE_APPROVED=false` is configured
locally, and the backend defaults to disabled unless the exact value `true` is
provided. The gate runs before any provider request, so adding the key cannot
activate new downloads. All 51 focused GIF tests, backend typecheck and the local
function push pass. Tests include absent/false/invalid approval values and an
authenticated request with a key present that fetches nothing and stores no
media. The picker replacement, provider-required revalidation and attribution
remain pending approval. No shared deployment was changed.

### Written approval request — October 22, 2026

With the owner's explicit authorization, the approval request was first attempted
via Gmail to `developers@giphy.com` at 11:22 UTC, subject "Written integration
approval request: Innovation Academy Chat (server-side delivery and caching)".
A delivery failure received immediately afterward says the Google Group may not
exist or may not permit posting. This attempt did not reach a confirmed support
intake; Gmail's Sent label alone was not delivery confirmation.

After the owner requested an inbox check, the complete request was resent to
`support@giphy.com` at 13:04 UTC with the same subject and an explanation of the
bounce. This address is published on GIPHY's official
[account help page](https://giphy.com/howtogiphy/your-giphy-account).
The message asks support to route it to API partnerships/licensing and confirm
receipt. Sent-mail readback confirms the new recipient and subject; delivery,
ticket creation and review are not yet confirmed. The request identifies the
Innovation Academy Chat beta application without including its API key,
student information or credentials.

The request asks for written permission for server-side metadata verification,
media fetching, expiring Convex storage and alternate delivery URLs. It also asks
whether a fixed nine-reaction picker is permitted, the required retention,
revalidation-before-serving and purge behavior, provider/creator/source attribution,
platform-key requirements, beta testing and production licensing, and review timing.
It explains the observed Tenor school-network failure without claiming GIPHY's
CDN has been tested there. It does not activate a paid plan or constitute provider
approval. Cache expiry alone is explicitly not presented as compliant revalidation.

No approval response or ETA has been received. `GIPHY_STORAGE_APPROVED=false`
remains in place, and the picker/revalidation/attribution implementation remains
pending the provider's requirements. PR [#169](https://github.com/virajdas/ia-app/pull/169)
and the status comments on issues [#167](https://github.com/virajdas/ia-app/issues/167#issuecomment-6339036856)
and [#170](https://github.com/virajdas/ia-app/issues/170#issuecomment-6339037194)
record the request and remaining work. A production-key application is separate
and has not been submitted by this work.

### Visual and device review

Material visuals are ready for owner review. Inspect processing, ready, error,
retry, keyboard focus, removal, disabled Send, narrow layout, picker open/selected
states, light/alternate themes and reduced motion. Browser diagnostics used the
current dark theme; alternate themes were not visually reviewed.
Native code was typechecked; native device interaction was not tested.
A school-managed laptop/network must still confirm that the app's storage host
is allowed. No production deployment was performed; GitHub status is recorded above.
