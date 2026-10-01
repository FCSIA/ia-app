---
tags: [reference, environment, configuration]
---

# Environment Variables

[Home](../index.md)

The current app uses Convex for backend data and Better Auth for authentication.
Old Prisma/PostgreSQL API environment variables are not part of active local
development.

## Local Files

| File                     | Purpose                                                               |
| ------------------------ | --------------------------------------------------------------------- |
| `.env`                   | Local root defaults                                                   |
| `.env.example`           | Template for local defaults                                           |
| `apps/convex/.env.local` | Worktree-local Convex selection and URLs written by the Convex CLI    |
| `apps/web/.env.local`    | Local web-only public values such as Convex URLs and VAPID public key |

## Convex Variables

The Convex CLI writes the selected deployment. Local selection is the default:

```env
CONVEX_DEPLOYMENT=...
CONVEX_URL=...
CONVEX_SITE_URL=...
```

The web app also needs public Convex URLs when deployed:

```env
NEXT_PUBLIC_CONVEX_URL=https://...
NEXT_PUBLIC_CONVEX_SITE_URL=https://...
```

## Worktrees And Deployment Selection

`pnpm worktree:bootstrap` creates/selects an isolated local Convex backend by
default, so `pnpm dev` is safe to use after bootstrap. Use `--shared-convex`
only for an explicit short-lived UI task. Shared mode links the primary
worktree's local state and makes `pnpm dev` start only the web server, avoiding
a second Convex watcher. Use `--no-convex` to leave backend configuration
untouched. See [Git worktrees](worktrees.md) for configuration and opt-out
options.

For ordinary worktree development, initialize each worktree's own local backend:

```bash
pnpm setup:convex-local
pnpm dev
```

`pnpm setup:convex-local` creates or selects the worktree-local deployment,
repairs its local URL pair from the Convex port configuration, generates
`BETTER_AUTH_SECRET` only when it is missing, defaults `SITE_URL` only when it
is missing, and then runs `pnpm sync:convex-env`. Existing deployment variables
are preserved. Use `pnpm sync:convex-env` by itself after ordinary URL or mobile
host changes; it does not create deployments or modify deployment-scoped
secrets.

After selection, both `CONVEX_URL` and `CONVEX_SITE_URL` must be local URLs (or
both must identify the same named cloud deployment). `pnpm sync:convex-env`
refuses to copy a mixed local/cloud configuration into the web and mobile apps.
Use `direnv exec . pnpm ...` when the system Node version is not supported by
Convex local; the repo shell provides Node 24.

### Physical-device clients

A loopback URL such as `http://127.0.0.1:3210` points back to the phone when it
is used by a mobile browser, installed web app, or native client. For a device
on the same Wi-Fi, rewrite only the public client URLs to the development
machine's LAN address, then restart the web development server:

```bash
pnpm sync:convex-env -- --host auto
pnpm dev
```

`--host auto` picks this machine's current LAN IPv4 address (pass
`--host <LAN IPv4>` to choose one). The server-side Convex URLs remain on
loopback. The rewritten public URLs are used by the web PWA, the Expo client,
and the desktop browser alike, so a phone and the desktop can test at the same
time against one backend. An HTTPS frontend tunnel cannot connect to a local
HTTP Convex backend because browsers block mixed content; use the named cloud
development deployment flow below for HTTPS tunnels.

The selected LAN host is retained for later environment syncs. When the machine
changes networks, `pnpm dev` notices that the saved address is no longer its
own and re-points the clients to the current LAN address, or to loopback when
there is none, instead of timing out at the old address (a
`ConnectTimeoutError` to port `3211`). For desktop-only work, reset the public
URLs to loopback explicitly:

```bash
pnpm sync:convex-env -- --host 127.0.0.1
pnpm dev
```

Some networks give the machine no address other devices can reach. A phone
hotspot on an IPv6-only carrier network, for example, leaves macOS with only
`192.0.0.2`, and `--host auto` then refuses. On such a network, test the native
app in the iOS Simulator (loopback works for it and the desktop browser
together) or the Android emulator (`--android`), join a shared Wi-Fi, or use a
named cloud dev deployment.

Both cases require the local Convex watcher started by `pnpm dev`; a connection
refused or timeout on local ports can also mean that watcher is not running.

For a feature that needs a public URL, off-LAN mobile-device access, webhooks,
an HTTPS tunnel, or a shared dashboard, create a named cloud dev deployment
instead:

```bash
pnpm --filter cvx exec convex deployment create dev/<feature-name> \
  --type dev --select --expiration "in 7 days"
pnpm sync:convex-env
pnpm dev
```

Free and Starter plans allow named deployments, but their usage is summed
team-wide. Expire or delete a temporary cloud deployment only after confirming
that nobody needs its data or deployment-scoped environment variables. Deleting
it does not undo database I/O or other usage already metered this month.

## Secrets

Runtime secrets such as Better Auth credentials belong in the Convex deployment
environment. Demo seed/reset does not use `BOOTSTRAP_SECRET`; invoke the
internal `bootstrap:resetAndSeed` function through the Convex CLI or Dashboard.

### Google Cloud Vision schedule import

Schedule image import requires a Google Cloud service account with the Cloud
Vision API enabled. Store the complete service-account JSON as the deployment
secret `GOOGLE_VISION_SERVICE_ACCOUNT_JSON`; never add it to `.env`, a client
bundle, or git. The action exchanges its signed JWT for a short-lived OAuth token
and sends image bytes directly to the Google Vision API.

```bash
direnv exec . pnpm --filter cvx exec convex env set GOOGLE_VISION_SERVICE_ACCOUNT_JSON "$(cat service-account.json)"
```

Run this only after selecting the intended non-production or production
deployment and obtaining the appropriate data-processing approval.

## Web Push

Browser push notifications require VAPID keys. The public key is needed by the
web client and Convex; the private key belongs only in the Convex deployment
environment.

```env
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@example.com
```

Generate keys with:

```bash
pnpm --filter cvx exec web-push generate-vapid-keys
```

Then set the same public key in the web app and Convex, and keep the private
key only in Convex:

```bash
# apps/web/.env.local
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...

pnpm --filter cvx exec convex env set VAPID_PUBLIC_KEY "..."
pnpm --filter cvx exec convex env set VAPID_PRIVATE_KEY "..."
pnpm --filter cvx exec convex env set VAPID_SUBJECT "mailto:admin@example.com"
```

If `pnpm` is only available through the repo's Nix/direnv shell, run the same
commands as `direnv exec . pnpm ...`.

## Mobile / Expo

Mobile uses the same Convex deployment directly. Local and EAS environments
should set:

```env
EXPO_PUBLIC_APP_SCHEME=ia-app
EXPO_PUBLIC_CONVEX_URL=https://...
EXPO_PUBLIC_CONVEX_SITE_URL=https://...
EXPO_PUBLIC_UNIVERSAL_LINK_HOST=app.innovationacademy.fcsia.org
```

Store and EAS account values are intentionally external to the repo:

```env
EXPO_ACCOUNT_OWNER=...
EAS_PROJECT_ID=...
IOS_BUNDLE_IDENTIFIER=org.fcsia.app
IOS_BUILD_NUMBER=1
ANDROID_PACKAGE=org.fcsia.app
ANDROID_VERSION_CODE=1
```

See `apps/mobile/STORE_READY.md` for the account, universal-link, privacy, and
physical-device validation checklist.
