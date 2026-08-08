---
tags: [backend, convex, local-development, production, deployment, compliance]
---

# Convex Local And Production Runtime

[Home](../index.md)

This page explains how the Convex backend works for local development,
managed production, self-hosted production, and a district Azure-hosted web
tier.

## Short Version

Convex is not a library embedded inside the Next.js app. It is a backend
deployment that hosts:

- database tables and indexes from `apps/convex/src/schema.ts`,
- queries, mutations, actions, internal functions, and HTTP routes from
  `apps/convex/src`,
- Better Auth component data and auth routes,
- file storage,
- deployment-scoped environment variables,
- dashboard tooling, logs, and backup/export workflows.

The Next.js app connects to a selected Convex deployment with public deployment
URLs. In this repo those URLs are read by:

- `apps/web/src/lib/convex.ts` for browser/client Convex calls,
- `apps/web/src/lib/auth-server.ts` for the Next.js auth route proxy,
- `apps/web/src/app/providers.tsx` through `ConvexBetterAuthProvider`.

## Terminology

Use these terms precisely:

| Term | Meaning | Production fit |
| --- | --- | --- |
| Local Convex deployment | A development backend started by the Convex CLI on a developer machine. | Not production. Convex documents this as a development mode. |
| Managed Convex Cloud | Convex-hosted production deployment. | Production-capable managed backend, subject to district vendor review. |
| Self-hosted Convex | Open-source Convex backend/dashboard run by the school/team on its own servers or containers. | Potential production option, but the school/team owns ops, persistence, upgrades, monitoring, and backups. |
| Azure-native rewrite | New backend on Azure services such as PostgreSQL, Blob Storage, Functions/workers, and an API service. | Production option with the largest rewrite cost. |

A local Convex deployment may keep its data, auth/session tables, files, and
logs on the developer machine, but that does not make it a production hosting
model. Convex's local deployment docs call local deployments development
deployments, note that function results and full stack traces can be sent to
connected clients, and note that logs are cleared when `convex dev` restarts.
Local mode also does not provide a production backup, retention, monitoring, or
incident-response posture by itself.

Self-hosted Convex is the option that can run inside district-controlled Azure
infrastructure. The official self-hosted backend uses local SQLite by default,
can run under Docker, stores data in a Docker volume by default, can be pointed
at SQL storage, and can be configured to use S3-compatible object storage for
exports, snapshots, modules, files, and search indexes.

## Production Shape With Azure Web Hosting

If the district hosts the web tier in Azure but accepts managed Convex for the
backend, production looks like this:

```text
Users
  -> Azure Front Door / Application Gateway / Container Apps ingress
  -> Azure Container Apps or App Service running Next.js
  -> Convex production deployment
       - functions
       - database
       - auth component data
       - file storage
       - scheduled/internal work
       - logs, dashboard, backups
```

The Azure-hosted web app needs:

```env
NEXT_PUBLIC_CONVEX_URL=https://<prod>.convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://<prod>.convex.site
CONVEX_URL=https://<prod>.convex.cloud
CONVEX_SITE_URL=https://<prod>.convex.site
NEXT_PUBLIC_SITE_URL=https://<school-app-domain>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
```

The Convex production deployment needs deployment-scoped server variables such
as:

```text
BETTER_AUTH_SECRET
SITE_URL
NEXT_PUBLIC_SITE_URL
VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

For this app, `pnpm --filter cvx deploy` deploys Convex schema, functions, HTTP
routes, storage integration, and component configuration. In CI this should run
with a production `CONVEX_DEPLOY_KEY` stored in the CI or Azure secret store,
not in git.

## What Data Lives In Convex

With managed Convex Cloud, the following application data is outside the
district Azure tenant unless separate export/archive jobs copy it into district
storage:

| Data | Current Convex location |
| --- | --- |
| Users and roles | `users` table plus Better Auth component tables |
| Sessions/auth component data | Better Auth Convex component |
| Announcements, clubs, channels, messages, events, schedules, Flex Friday | Convex app tables |
| Moderation reports and keyword rules | Convex app tables |
| Notifications and push subscriptions | Convex app tables |
| Audit trail | `auditEvents` table |
| User images, club images, chat attachments | Convex file storage and storage IDs |
| Wrapped snapshots | `wrappedSnapshots` table |
| Seed/reset state and background work | Internal Convex functions/tables |

This is the main district decision point. Azure can host the web app, but if
managed Convex Cloud remains the backend, the application system of record
remains Convex Cloud.

With self-hosted Convex running in district Azure, the same categories can live
inside district-controlled infrastructure, but only if the backing database,
container volume, object/file storage, logs, exports, backups, dashboard access,
and monitoring are all configured inside the district boundary.

## Expanded District Decision Question

Use this version with district IT, legal, or procurement:

> Which backend boundary is acceptable for FERPA-sensitive student data?
>
> 1. Managed Convex Cloud as the contracted backend, with the Next.js web tier
>    hosted in district Azure.
> 2. Self-hosted Convex running inside district-controlled Azure infrastructure,
>    with district-owned persistence, storage, logs, backups, and exports.
> 3. A full Azure-native backend replacement using district Azure services such
>    as PostgreSQL, Blob Storage, Key Vault, Functions/workers, and an API
>    service.
>
> If managed Convex Cloud is used, is it acceptable that application data,
> auth/session data, file uploads, logs, backups, and exports are controlled
> through the Convex vendor environment rather than residing entirely in the
> district Azure tenant?

Follow-up questions:

- Does the district require all student data to reside in its Azure tenant, or
  is a FERPA-reviewed SaaS backend with contractual controls acceptable?
- If data must reside in district Azure, is self-hosted Convex acceptable, or
  must the backend be built from Azure-native services directly?
- Does the district require a specific region or data residency guarantee for
  database rows, auth/session data, file storage, backups, logs, and support
  access?
- Who may access the Convex dashboard in production, and how are access reviews
  handled?
- What backup, export, retention, and deletion obligations apply to app data,
  chat messages, uploads, moderation reports, audit events, and graduated
  student records?
- Are scheduled exports from Convex to district-owned Azure Blob Storage enough
  for records retention, or must the primary database be Azure PostgreSQL?
- Is district Microsoft Entra ID/OIDC SSO required, and should app roles map
  from district groups?
- Does the district require private networking/private endpoints for all data
  services? If yes, managed Convex Cloud may not satisfy that requirement.
- Are customer-managed encryption keys required?
- What incident response and breach notification process applies across Azure,
  Convex, GitHub, and any other service provider?

## Local Development Modes

Convex has two practical local-development modes for this repo.

### Mode A: Actual Local Convex Backend

Actual local Convex is the primary and default development mode for every human
and agent, including feature, schema, seed, and ordinary local test work. Each
worktree gets an isolated backend.

```bash
pnpm setup:convex-local
pnpm dev
```

The setup command creates or selects the worktree-local deployment, initializes
the required Better Auth deployment variables only when missing, repairs the
local URL pair from Convex's port configuration, and syncs those URLs to the
frontend apps. Existing deployment variables are preserved.

When using local deployment mode:

- the Convex backend runs as a subprocess of `convex dev`,
- state is stored in a project `.convex` directory,
- anonymous local admin state can also live under `~/.convex`,
- the frontend connects to localhost URLs,
- `convex dev` must keep running for the app to work,
- this mode is for development, not production.

This repo's web code already has non-CI fallbacks for local Convex:

```text
CONVEX_URL / NEXT_PUBLIC_CONVEX_URL      -> http://127.0.0.1:3210
CONVEX_SITE_URL / NEXT_PUBLIC_CONVEX_SITE_URL -> http://127.0.0.1:3211
```

Local mode keeps each worktree's `.convex` state separate and avoids accidental
writes to a shared cloud deployment or cloud quota use. It is not appropriate
when the task specifically needs public webhook access, a physical device,
production-like public URLs, or shared dashboard visibility.

### Mode B: Named Cloud Dev Deployment

Use a named cloud dev deployment only for a specific need such as a public URL,
physical-device testing, a webhook, or shared dashboard access. Do not let two
schema-changing worktrees select the same cloud deployment.

```bash
pnpm --filter cvx exec convex deployment create dev/<feature-name> \
  --type dev --select --expiration "in 7 days"
pnpm sync:convex-env
pnpm dev
```

This creates and selects a cloud deployment for the current worktree, then
syncs its URLs into `apps/web/.env.local`. Cloud deployments store development
data in Convex Cloud, and all cloud deployments on the team contribute to the
team's plan usage. Set an expiration and delete the deployment when its data and
deployment-scoped environment variables are no longer needed; cleanup does not
reverse usage already metered in the month.

### Worktree Rules

Before selecting a deployment, starting a watcher, or resetting seed data,
inspect `git worktree list` and the current worktree's
`apps/convex/.env.local`. Use an isolated local deployment unless Mode B's
specific need applies. Stop `pnpm dev` / `pnpm cvx:dev` watchers pointed at a
shared deployment before switching selections, and never copy
`apps/convex/.env.local` between worktrees. Use `pnpm setup:convex-local` for
local selection and initialization; use `pnpm sync:convex-env` after selecting
a cloud deployment so the clients follow the same backend. The sync command
rejects a mixed configuration where `CONVEX_URL` and `CONVEX_SITE_URL` point at
different deployments. If the system `node` is unsupported, run Convex
commands through `direnv exec .` so this repo supplies Node 24.

If a shared deployment has data that no longer validates against a branch's
schema, isolate the branch instead of attempting to reseed through a failed
schema deployment. Where preserving data is required, use widen → migrate →
narrow: deploy a validator that accepts both shapes, migrate/backfill existing
documents, verify them, then remove the old shape.

`npx convex ai-files update` refreshes generated AI guidance. It is separate
from deployment repair and cannot reconcile an incompatible schema or data.

To select an existing named cloud dev deployment:

```bash
pnpm --filter cvx exec convex deployment select dev/<feature-name>
pnpm sync:convex-env
pnpm dev
```

## Environment Separation

Every Convex deployment has its own data, functions, scheduled functions, file
storage, and environment variables. Treat them as separate environments:

| Environment | Purpose |
| --- | --- |
| Local backend | Fast isolated development on one machine |
| Named cloud dev | Explicit public-URL, physical-device, webhook, or shared-dashboard work |
| Preview/staging | Branch or pre-production validation |
| Production | Real student/staff data |

Never point local web development at production Convex unless explicitly doing
a controlled read-only operations task.

## Temporary Deployment Cleanup

A cloud deployment is not a Git branch. Deleting it removes the deployment's
data, files, scheduled work, and deployment-scoped environment variables; it
does not delete the corresponding worktree or Git branch. Before deleting a
temporary deployment, confirm that no branch, teammate, test device, or webhook
still needs it and record/recreate any required environment variables elsewhere.
Deleting a deployment cannot reduce database I/O already charged in the current
billing period.

## Production Operations Checklist

Before real student data goes into managed Convex:

- Confirm district approval for Convex as a managed backend vendor.
- Create separate dev, staging, and production deployments.
- Store `CONVEX_DEPLOY_KEY` in CI secret storage only.
- Set production Convex environment variables in the Convex dashboard or CLI.
- Limit Convex team/dashboard access to named operators.
- Enable/document backup and export procedures, including file storage.
- Add scheduled exports of audit, roster, moderation, and upload inventory data
  to district-controlled Azure storage if required.
- Document retention and deletion runbooks.
- Run `pnpm --filter cvx codegen`, `pnpm --filter cvx typecheck`, and
  `pnpm --filter web build` before deploying.

## Self-Hosted Convex In District Azure

Convex publishes an open-source backend and dashboard that can be self-hosted.
This is the path that most closely matches the intuition that "Convex data lives
in our container/infrastructure."

In a district Azure setup, self-hosted Convex would likely look like:

```text
Users
  -> Azure edge / ingress
  -> Next.js web container
  -> self-hosted Convex backend container
  -> Azure managed disk, SQLite, or Azure Database for PostgreSQL
  -> S3-compatible object storage for Convex files/exports/snapshots
     or persistent volume storage until object storage is validated
  -> Azure Monitor / Log Analytics
```

Important caveats:

- The Docker quickstart stores backend data in a Docker volume with local SQLite
  by default. Production needs explicit persistent storage and backup design.
- The backend can be pointed at SQL storage, and storage/export buckets must be
  deliberately configured. The published Docker configuration exposes S3-style
  storage environment variables; direct Azure Blob use should be validated in a
  proof of concept instead of assumed.
- Dashboard/admin keys become district-owned secrets and need access controls.
- Logs, metrics, backups, restore testing, upgrades, and migrations become the
  district/team's responsibility.
- Self-hosted Convex may have product/CLI/component differences from managed
  Convex. Validate this app's Better Auth component, rate limiter component,
  storage flows, push actions, dashboard workflows, and backup/export flows in a
  proof of concept before assuming production parity.

For this app, the practical options remain:

1. managed Convex backend plus Azure-hosted web tier,
2. self-hosted Convex on district infrastructure after a dedicated ops review,
3. full Azure-native backend rewrite on PostgreSQL/Blob/Functions.

## Official References

- Convex production overview:
  <https://docs.convex.dev/production/overview>
- Convex production deploy/config:
  <https://docs.convex.dev/production/project-configuration>
- Convex deployment URLs:
  <https://docs.convex.dev/client/react/deployment-urls>
- Convex local deployments:
  <https://docs.convex.dev/cli/local-deployments>
- Convex deploy keys:
  <https://docs.convex.dev/cli/deploy-key-types>
- Convex environment variables:
  <https://docs.convex.dev/production/environment-variables>
- Convex backup and restore:
  <https://docs.convex.dev/database/backup-restore>
- Convex status and guarantees:
  <https://docs.convex.dev/production/state>
- Convex file storage:
  <https://docs.convex.dev/file-storage/overview>
- Convex self-hosting:
  <https://docs.convex.dev/self-hosting>
- Convex self-hosted backend README:
  <https://github.com/get-convex/convex-backend/tree/main/self-hosted>
