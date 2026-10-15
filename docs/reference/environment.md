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

`bun run worktree:bootstrap` creates/selects an isolated local Convex backend by
default, so `bun run dev` is safe to use after bootstrap. Use `--shared-convex`
only for an explicit short-lived UI task. Shared mode links the primary
worktree's local state and makes `bun run dev` start only the web server, avoiding
a second Convex watcher. Use `--no-convex` to leave backend configuration
untouched. See [Git worktrees](worktrees.md) for configuration and opt-out
options.

For ordinary worktree development, initialize each worktree's own local backend:

```bash
bun run setup:convex-local
bun run dev
```

`bun run setup:convex-local` creates or selects the worktree-local deployment,
repairs its local URL pair from the Convex port configuration, generates
`BETTER_AUTH_SECRET` only when it is missing, defaults `SITE_URL` only when it
is missing, and then runs `bun run sync:convex-env`. Existing deployment variables
are preserved. Use `bun run sync:convex-env` by itself after ordinary URL or mobile
host changes; it does not create deployments or modify deployment-scoped
secrets.

After selection, both `CONVEX_URL` and `CONVEX_SITE_URL` must be local URLs (or
both must identify the same named cloud deployment). `bun run sync:convex-env`
refuses to copy a mixed local/cloud configuration into the web and mobile apps.
Use the Nix/direnv shell when the system Node version is not supported by
Convex local; the repo shell provides Node 24 and the Bun version pinned by
`packageManager` in `package.json`.

### Physical-device clients

```bash
bun run dev:phone
```

Points the web and mobile clients at this machine's network address, then
starts `bun run dev`. The phone and the desktop browser can test at the same time.

- Web on the phone: open `http://<address>:3000` (printed by the command).
- Native app: run `bun run dev:mobile` in a second terminal and scan the QR code
  with Expo Go.

| Setup | Works |
| --- | --- |
| Mac and phone on the same Wi-Fi | Yes |
| Mac on the phone's hotspot | Needs Tailscale |
| Phone on cellular, Mac elsewhere | Needs Tailscale |
| iOS Simulator | Yes, with plain `bun run dev` |
| Android emulator | Run `bun run sync:convex-env -- --android`, then `bun run dev` |

Tailscale: install it on the Mac and the phone and sign both in to the same
account. `bun run dev:phone` then prefers the Mac's Tailscale address, which works
on any network.

After a network change, `bun run dev` re-points the clients automatically. To go
back to desktop-only:

```bash
bun run sync:convex-env -- --host 127.0.0.1
```

HTTPS tunnels need a named cloud dev deployment (below).

A refused or timed-out connection on ports 3210/3211 usually means `bun run dev`
is not running.

For a feature that needs a public URL, off-LAN mobile-device access, webhooks,
an HTTPS tunnel, or a shared dashboard, create a named cloud dev deployment
instead:

```bash
bun run --cwd apps/convex convex deployment create dev/<feature-name> \
  --type dev --select --expiration "in 7 days"
bun run sync:convex-env
bun run dev
```

Free and Starter plans allow named deployments, but their usage is summed
team-wide. Expire or delete a temporary cloud deployment only after confirming
that nobody needs its data or deployment-scoped environment variables. Deleting
it does not undo database I/O or other usage already metered this month.

## Secrets

Runtime secrets such as Better Auth credentials belong in the Convex deployment
environment. Demo seed/reset does not use `BOOTSTRAP_SECRET`; invoke the
internal `bootstrap:resetAndSeed` function through the Convex CLI or Dashboard.

## GitHub Feedback Issues

To mirror general feedback into `virajdas/ia-app`, create a fine-grained GitHub
token with **Issues: Read and write** access restricted to that repository, then
set these variables on the target Convex deployment:

```bash
bun run --cwd apps/convex convex env set GITHUB_FEEDBACK_TOKEN "..."
bun run --cwd apps/convex convex env set GITHUB_FEEDBACK_WEBHOOK_SECRET "..."
```

In the repository's GitHub webhook settings, add the Convex HTTP endpoint
`https://<your-convex-site>/github/feedback-webhook`, use the same webhook
secret, choose JSON, and subscribe only to **Issues** events. The receiver
validates GitHub's `X-Hub-Signature-256`, accepts only this repository, and
reacts to actual close/reopen events—not labels. Closure reasons map as follows:
`completed` becomes resolved; `not_planned` becomes dismissed; reopening returns
the feedback to pending. Configure these only on the explicitly authorized
deployment; merging the code does not activate a webhook or deploy it.

### Google Cloud Vision schedule import

Schedule image import requires a Google Cloud service account with the Cloud
Vision API enabled. Store the complete service-account JSON as the deployment
secret `GOOGLE_VISION_SERVICE_ACCOUNT_JSON`; never add it to `.env`, a client
bundle, or git. The action exchanges its signed JWT for a short-lived OAuth token
and sends image bytes directly to the Google Vision API.

```bash
direnv exec . bun run --cwd apps/convex convex env set GOOGLE_VISION_SERVICE_ACCOUNT_JSON "$(cat service-account.json)"
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
bun run --cwd apps/convex web-push generate-vapid-keys
```

Then set the same public key in the web app and Convex, and keep the private
key only in Convex:

```bash
# apps/web/.env.local
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...

bun run --cwd apps/convex convex env set VAPID_PUBLIC_KEY "..."
bun run --cwd apps/convex convex env set VAPID_PRIVATE_KEY "..."
bun run --cwd apps/convex convex env set VAPID_SUBJECT "mailto:admin@example.com"
```

The repo's Nix/direnv shell provides Bun and Node 24 together. After changes to
the shell configuration, run `direnv allow` and `direnv reload` in the worktree.

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
