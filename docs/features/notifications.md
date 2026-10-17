---
tags: [feature, notifications]
---

# Notifications

[Home](../index.md)

Notifications provide an in-app inbox, unread count, user preferences, and
browser push delivery for subscribed devices.

## What It Does

- Lists recent notification deliveries.
- Supports cursor pagination for the inbox.
- Tracks unread count.
- Marks one or many notifications as read.
- Stores per-category and scoped preferences.
- Stores per-user browser push subscriptions.
- Sends Web Push for categories configured at `PUSH` or `TIME_SENSITIVE`.
- Activates supported alert categories for push when a user explicitly enables
  browser push, while preserving explicit opt-outs.

## Source Files

- Backend: `apps/convex/src/notifications/`
- Inbox page: `apps/web/src/app/notifications/page.tsx`
- Preference controls: `apps/web/src/components/notifications/`
- Service worker: `apps/web/public/sw.js`
- Service worker registration: `apps/web/src/components/pwa/service-worker-registrar.tsx`
- Subscription drift repair and device reporting: `apps/web/src/components/notifications/push-subscription-sync.tsx`
- Enabling push and the re-enable prompt state: `apps/web/src/components/notifications/enable-push.ts`
- Re-enable prompt: `apps/web/src/components/dashboard/PushReenableAnnouncement.tsx`
- Platform detection: `apps/web/src/lib/pwa.ts`
- Unread nav badge: `apps/web/src/components/layout/AppShell.tsx`

## Convex Surface

- `api.notifications.inbox.list`
- `api.notifications.inbox.listPage`
- `api.notifications.inbox.unreadCount`
- `api.notifications.inbox.markRead`
- `api.notifications.inbox.markAllRead`
- `api.notifications.preferences.list`
- `api.notifications.preferences.upsert`
- `api.notifications.preferences.activatePush`
- `api.notifications.push.getPublicKey`
- `api.notifications.push.listMine`
- `api.notifications.push.upsertSubscription`
- `api.notifications.push.removeSubscription`
- `api.notifications.pushDevices.reportState`
- `internal.notifications.pushDevices.healthReport`
- `api.notifications.pushNode.sendTestToMe`

## Data Model

- `notificationDeliveries`
- `notificationPreferences`
- `notificationPushSubscriptions`
- `notificationPushDevices`

`notificationDeliveries.readAt` records when a delivery was first read, for
[admin analytics](analytics.md). Rows read before it was added have no time.

Preference levels are `OFF`, `IN_APP`, `PUSH`, and `TIME_SENSITIVE`. The schema
also supports category and scope keys such as global, club, and channel scopes.

## Categories

The validator includes school announcements, club announcements, club join
requests, club channel messages, mentions, thread replies, events, Flex Friday,
content moderation, feedback, friend requests, and friend schedule changes.

Feedback submissions, staff replies, and resolution updates use `FEEDBACK`,
separate from safety/moderation notices. Both inbox APIs classify older
`CONTENT_MODERATED` deliveries by the linked report's `GENERAL` content type;
titles and URLs do not determine the category. Historical deliveries are not
rewritten. A feedback preference inherits the user's previous global moderation
preference until explicitly set, preserving opt-outs and delivery levels.

## Settings surfaces

`NotificationSettingsPanel` is shared by the Settings tab on `/notifications`
and the Notifications section on `/profile`. Both expose browser push, global
categories, and club/channel preferences through the same implementation. Compact
option rows sit in a rounded group with quiet separators, and club headers use
a distinct surface. These inner groups define the bounded column without an
additional outer frame.

Club settings use an inline Radix `Collapsible` with a separate Fluid button
containing the channel count and chevron beside the club switch. Expanding a
club does not change its preference;
changing its switch does not expand it. Channel rows follow the workspace's
`ownerUnitId` / `parentUnitId` hierarchy, preserving ancestor branches and
omitting units without readable channels. These are nested lists, not an ARIA
Tree or a popup action menu. The channel switches control mentions; all-message
alerts remain in channel settings. Scoped switches inherit their category's
global setting until explicitly overridden, and an off club disables its
channel controls without erasing their saved choices.

## Browser Push

Closed-tab delivery uses the browser Push API and the app service worker.
Each Convex deployment needs its own `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`,
and `VAPID_SUBJECT`. Generate a keypair with:

```bash
bun run --cwd apps/convex web-push generate-vapid-keys
```

> **Always pass `--deployment` when setting these.** A bare `convex env set`
> targets whatever this machine is linked to, and `--prod` resolves to the
> default production deployment *of the linked project*, which is not
> necessarily real production. Production VAPID keys were previously written to
> the wrong deployment this way, leaving push silently dead in production.
> Confirm the target first with
> `bun run --cwd apps/convex convex env get SITE_URL --deployment <name>`.

```bash
bun run --cwd apps/convex convex env set VAPID_PUBLIC_KEY "<public-key>" --deployment <name>
bun run --cwd apps/convex convex env set VAPID_PRIVATE_KEY "<private-key>" --deployment <name>
bun run --cwd apps/convex convex env set VAPID_SUBJECT "mailto:admin@example.com" --deployment <name>
```

Use a **separate keypair per deployment**, so a dev backend never holds the
production signing key.

`NEXT_PUBLIC_VAPID_PUBLIC_KEY` in the web env is an optional fallback only. The
client prefers `api.notifications.push.getPublicKey`, which reads the key from
Convex, so setting the key on the deployment is sufficient and keeps the web
build and backend from drifting apart.

Verify a deployment is correctly configured with:

```bash
bun run --cwd apps/convex convex run notifications/push:getPublicKey --deployment <name>
```

A `null` result means `configureWebPush()` will bail and every send will be
dropped without an error.

Push is a best-effort delivery channel. Expired browser subscriptions are
disabled when push services return a permanent failure (`404`/`410`). Auth
failures (`401`/`403`) are deliberately not treated as permanent, because they
indicate a bad VAPID configuration rather than a dead endpoint.

### Notification display rules

The service worker never lets one notification silently replace another. A
`tag` replaces any showing notification carrying the same tag, and without
`renotify` the replacement is completely silent — no sound, no vibration, no
heads-up banner. Tagging every notification with its category therefore made
Android look broken: the first announcement arrived and every one after it
swapped in behind the shade unannounced.

Each notification now gets a unique tag unless the payload sets `tag`
explicitly, and every tagged notification sets `renotify: true` so the device
alerts again. `renotify` without a tag is a `TypeError`, so the two always
travel together. A sender that genuinely wants grouping — collapsing a busy
channel into a single entry, say — opts in by putting a stable `tag` in the
push payload.

### Diagnosing a silent device

`api.notifications.pushNode.sendTestToMe` sends a push to every browser the
caller has registered and returns the push service's own status codes. The
Browser push panel exposes it as **Send test** once push is on, and surfaces
the last delivery error recorded against the current browser.

The test send deliberately skips preference resolution: it answers "can this
browser receive a push at all", so a category opt-out is not reported as a
transport failure. It reuses the same send path as real deliveries, so a pass
means real notifications take a working route.

### Service worker install must not be able to fail

`cache.addAll()` rejects as a unit, and a rejected `install` handler aborts the
whole registration: no active worker, no push, no install prompt, and nothing
the user can see. One renamed icon was enough to disable notifications on every
device that had not already activated an older worker. Static assets are now
cached individually with `Promise.allSettled` and failures are swallowed —
caching is an optimisation, delivery is not.

For the same reason `getServiceWorkerRegistration` returns only a registration
with an *active* worker, racing `navigator.serviceWorker.ready` against a
timeout. `ready` never rejects; it hangs forever when installation failed, so
without the race a broken worker showed up as a spinner that never stopped
instead of an error.

### Subscription rotation on Android

Chrome on Android invalidates push subscriptions on its own — after a WebAPK
update, an FCM registration refresh, or storage pressure. The service worker
handles `pushsubscriptionchange` by re-subscribing with the same application
server key and posting `PUSH_SUBSCRIPTION_CHANGED` to open clients;
`PushSubscriptionSync` listens for that message and sends the new endpoint to
the server without waiting for the next cold start.

### Platform requirements

| Platform | Works in a browser tab | Notes |
| --- | --- | --- |
| Android Chrome / Edge / Firefox | Yes | Also works installed. |
| Desktop Chrome / Edge / Firefox | Yes | |
| Desktop Safari (macOS 13+) | Yes | |
| **iOS / iPadOS Safari** | **No** | Push requires the app to be added to the Home Screen. |

iOS only exposes the Push API to Home Screen web apps. In a plain Safari tab
`window.Notification` is undefined, so the settings panel detects iOS and shows
Add to Home Screen instructions instead of reporting an unsupported browser.

Android needs no install step for push, but the manifest still declares an
explicit `scope` so the installed WebAPK and the service worker agree on what
the app covers.

Two iOS constraints shape the client code:

- `Notification.requestPermission()` must be called synchronously inside the
  tap handler. Awaiting anything first (a service worker lookup, a Convex
  query) spends the user activation and the prompt fails. See
  `requestNotificationPermission` in `apps/web/src/lib/push-notifications.ts`.
- The manifest must use `display: standalone` or `fullscreen`.

### Subscription drift

Push subscriptions can go stale without any user-visible error: push services
rotate endpoints, the stored row can be disabled after failures, and rotating
the VAPID key invalidates every existing subscription. `PushSubscriptionSync`
re-registers an already-granted subscription on load, and
`subscribeBrowserToPush` replaces a subscription whose `applicationServerKey`
no longer matches the configured VAPID key. Neither path prompts the user.

**Disable push** leaves notification permission granted, so the sync would
otherwise re-subscribe on the next launch and undo the choice. It records a
per-browser opt-out instead, which the sync respects and the next explicit
enable clears.

### Silent loss on iOS

iOS can drop a Home Screen app's subscription, sometimes resetting its
notification permission to "ask", without firing `pushsubscriptionchange`.
Apple's push service keeps answering `201` for the dead endpoint for roughly a
week before it starts returning `410`. Until then the server believes delivery
works, and **Send test** counts the dead endpoint as delivered.

Only the device knows what it can receive, so on every launch
`PushSubscriptionSync` calls `api.notifications.pushDevices.reportState` with a
per-install device id, its platform, display mode, permission, and the endpoint
it holds. The server then:

- disables every other endpoint that device registered, since a browser holds at
  most one subscription. A subscription that could not be read disables nothing;
- records the report in `notificationPushDevices`, skipping unchanged reports
  for a few hours so launches don't write every time; and
- answers whether to offer a re-enable. A device whose permission is back to
  "ask" after having had push, and that did not opt out, gets a one-tap card on
  the dashboard. Asking for permission needs a tap, so this cannot be automatic.

Endpoints registered before device reporting have no device id. Each live device
claims its endpoint on its first launch with this code. For an iOS Home Screen
app, an unclaimed Apple endpoint from the same kind of device also counts as
evidence that the device used to have push.

To see how many devices can actually receive push, run the internal health
report with a start time in milliseconds:

```bash
pnpm --filter cvx exec convex run notifications/pushDevices:healthReport '{"since": <ms>}' --deployment <name>
```

`lostPush` counts devices that held a subscription and now cannot receive push
without having opted out. `unclaimedSubscriptions` counts enabled endpoints that
no device has reported holding. Until every live device has launched once with
this code, that includes working devices as well as dead endpoints.

### Shared devices

A web push endpoint or native push token identifies one browser or app install,
so it delivers only for the account that registered it most recently. Registering
it disables any other account's row for the same endpoint or token; otherwise
signing a second account into a shared device kept delivering the first
account's notifications there. Signing out on the web releases the browser's
endpoint for that account while the session is still valid. The browser keeps
its subscription for whoever signs in next. A session that merely expires keeps
receiving push, since users who don't open the app for a week still expect
notifications.

The service worker is registered at app startup by `ServiceWorkerRegistrar`.
This is also what makes the app installable on Android, since Chrome requires
an active worker with a fetch handler before offering the install prompt.

Enabling Browser push registers the current browser and upgrades the user's
active alert preferences to `PUSH`. A global `OFF` preference remains off, and
all-message channel alerts remain separately opt-in in channel settings.

Channel-message fanout runs in a scheduled mutation after the sender's message
transaction commits. Preference resolution uses exact indexed scope and global
fallback lookups, so fanout does not scan a user's full category preference set.

## Current Delivery

The inbox, preference system, and Web Push subscription flow are active.
Announcements, events, Flex Friday entries, club activity, channel messages and
mentions, friend requests, material public-schedule changes, and moderation
reports create delivery rows. Schedule-change fanout is cursor-paginated after
the save transaction, rechecks that the source schedule is still public and
current, and contains no class details. Eligible rows fan out to browser push
when the recipient has an active subscription and a push-enabled preference.

## Known Limits

Unread count is currently a bounded read suitable for alpha/demo data. Use a
counter-backed design before production-scale exact counts.

Inbox and chat read state are not yet converged. Opening the notification inbox
still requires a manual read action, and reading a club channel advances its
channel receipt without clearing related notification deliveries. The planned
behavior is:

- acknowledge the inbox automatically only while its loaded view is foregrounded;
- reconcile message, mention, and thread-delivery rows through the last visible
  channel message;
- make delayed notification fanout and push jobs recheck that read boundary so
  a read message does not alert later; and
- process bulk acknowledgement in bounded batches with an entry-time cutoff.

Browser and native notification-center cleanup is best effort and follows a
successful durable acknowledgement. Web can close matching service-worker
notifications when the payload carries a delivery ID; Expo can dismiss the
app's presented notifications and clear its launcher badge, although Android
launcher badge support varies. Native cold-start notification responses also
need explicit startup handling before tap routing is considered complete.

Browsers may throttle or drop push events, and users can revoke notification
permission outside the app. Keep in-app deliveries as the durable source of
truth.

## Related

- [Schedule](schedule.md)
- [Clubs](clubs.md)
- [Indexes and search](../database/indexes-and-search.md)
