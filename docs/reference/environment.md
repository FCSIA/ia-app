---
tags: [reference, environment, configuration]
---

# Environment Variables

[Home](../index.md)

The current app uses Convex for backend data and Better Auth for authentication.
Old Prisma/PostgreSQL API environment variables are not part of active local
development.

## Local Files

| File                     | Purpose                                                      |
| ------------------------ | ------------------------------------------------------------ |
| `.env`                   | Local root defaults                                          |
| `.env.example`           | Template for local defaults                                  |
| `apps/convex/.env.local` | Worktree-local Convex selection and URLs written by the Convex CLI |
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

`apps/convex/.env.local` selects a stateful backend. Never copy it between
worktrees: doing so makes separate code branches deploy to and write data into
the same Convex deployment. Stop any `pnpm dev` or `pnpm cvx:dev` watcher using
that deployment before changing a worktree's selection.

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
on the same LAN, rewrite only the public client URLs to the development
machine's LAN address, then restart the web development server:

```bash
pnpm sync:convex-env -- --host 10.0.0.231
pnpm dev
```

The server-side Convex URLs remain on loopback. The rewritten public URLs are
used by both the web PWA and the Expo client. An HTTPS frontend tunnel cannot
connect to a local HTTP Convex backend because browsers block mixed content;
use the named cloud development deployment flow below for HTTPS tunnels.

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

## GitHub Feedback Issues

To mirror general feedback into `virajdas/ia-app`, create a fine-grained GitHub
token with **Issues: Read and write** access restricted to that repository, then
set these variables on the target Convex deployment:

```bash
pnpm --filter cvx exec convex env set GITHUB_FEEDBACK_TOKEN "..."
pnpm --filter cvx exec convex env set GITHUB_FEEDBACK_WEBHOOK_SECRET "..."
```

In the repository's GitHub webhook settings, add the Convex HTTP endpoint
`https://<your-convex-site>/github/feedback-webhook`, use the same webhook
secret, choose JSON, and subscribe only to **Issues** events. The receiver
validates GitHub's `X-Hub-Signature-256`, accepts only this repository, and
reacts to actual close/reopen events—not labels. Closure reasons map as follows:
`completed` becomes resolved; `not_planned` becomes dismissed; reopening returns
the feedback to pending.

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
