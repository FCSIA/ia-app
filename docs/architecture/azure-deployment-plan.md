---
tags: [architecture, azure, deployment, convex, self-hosting, costs]
---

# Azure Deployment Plan

[Home](../index.md)

This is the plan for moving the IA App off Vercel and Convex Cloud and onto a
single Azure VM running self-hosted Convex. The app keeps using Convex, so no
application rewrite is needed.

We are moving because the app keeps hitting Convex Cloud usage limits, and
because other school projects will also live in Azure. Moving only the web app
would not fix the limits, so the Convex backend has to move too.

This plan replaces the production design and the ~$800/month budget in
[Azure hosting migration](azure-hosting-migration.md). That design sized for all
1,800 people online at once. We don't expect that, and we want the simplest
setup that works at about 1,700 users. The ownership, access, and data privacy
requirements in the [Azure school environment plan](azure-school-environment-plan.md)
still apply.

> VM prices are Microsoft list prices for **East US 2** from the Azure Retail
> Prices API on **2026-10-31**. Other figures are estimates. Check them in the
> Azure pricing calculator before committing.

## Target Setup

```text
app.fcsia.com ────────┐
ia-api.fcsia.com ─────┤  HTTPS / WSS
ia-site.fcsia.com ────┤
                      ▼
      vm-ia-app (Ubuntu LTS + Docker Compose)
      ├─ Caddy             :80, :443   TLS and routing
      ├─ Next.js           127.0.0.1:3000
      ├─ Convex backend    127.0.0.1:3210 (API, sync)
      │                    127.0.0.1:3211 (HTTP actions)
      ├─ Convex dashboard  127.0.0.1:6791 (SSH tunnel only)
      └─ data disk         SQLite database and uploaded files
                      │
                      ▼
      Azure Blob Storage   scheduled Convex exports
```

`ia-api` and `ia-site` are proposed names. Adding the `ia-` prefix leaves room
for other projects under `fcsia.com`.

## Azure Resources

| Resource | Configuration | Monthly |
| --- | --- | --- |
| Linux VM | `Standard_D2as_v5` (2 vCPU, 8 GB) | ~$63 |
| OS disk | Small Premium or Standard SSD | ~$5–10 (estimate) |
| Data disk | 128 GiB Premium SSD; resize after the export size is known | ~$20 (estimate) |
| Public IP and VNet | Static IP; a network security group with the rules below | ~$4 (estimate) |
| Blob Storage | Soft delete on; lifecycle rule deletes old exports after 90 days | ~$5 (estimate) |
| Internet egress | The first 100 GB/month is free; ~300 GB/month would cost about $20 | $0–20 (estimate) |
| **Total** | | **~$95–125** |

Put everything in one resource group, `rg-iaapp-prod`, in East US 2. Set a
budget alert at 50%, 80%, and 100%. Budget alerts are free.

### Left Out on Purpose

| Service | Instead |
| --- | --- |
| Azure Database for PostgreSQL | SQLite on the data disk, the Convex default |
| Azure Container Registry | GitHub Container Registry; check the plan's storage limits |
| Key Vault | A root-only `.env` on the VM, plus GitHub secrets for CI |
| Azure Monitor and Application Insights | A free external uptime check on `/_meta` and `/version` |
| Front Door and Container Apps | Caddy on the VM |

If a limit shows up later, add only the service that fixes it.

## Other School Projects

- Do **not** put other projects on `vm-ia-app`. It holds student data, and a
  compromised project could reach everything on the same VM.
- Give each project its own resource group. Create a shared `vm-school-apps`
  when the first project needs one.
- A project that uses Convex gets its own backend container, `INSTANCE_NAME`,
  `INSTANCE_SECRET`, data volume, and hostnames.
- Consider shared Postgres or a shared registry only once several projects need
  them.

## Server Configuration

### Network and Access

| Rule | Setting |
| --- | --- |
| Inbound 80 and 443 | Open to the internet |
| Inbound 22 | Named admin IP addresses only |
| Everything else inbound | Denied |
| Published container ports | Bind to `127.0.0.1`, because Docker can bypass a host firewall |
| Dashboard | Never public. Reach it through an SSH tunnel |
| OS updates | `unattended-upgrades` on, with reboots outside school hours |

### Convex Backend

Use the official
[Docker Compose file](https://github.com/get-convex/convex-backend/blob/main/self-hosted/docker/docker-compose.yml)
as the starting point, with these changes:

| Setting | Value |
| --- | --- |
| Image | A pinned tag for the backend and dashboard. **Never `latest`.** |
| `/convex/data` volume | On the data disk, not the OS disk |
| `CONVEX_CLOUD_ORIGIN` | `https://ia-api.fcsia.com` |
| `CONVEX_SITE_ORIGIN` | `https://ia-site.fcsia.com` |
| `NEXT_PUBLIC_DEPLOYMENT_URL` | `https://ia-api.fcsia.com` |
| `INSTANCE_NAME` | `iaapp-prod` |
| `INSTANCE_SECRET` | A random secret, kept in a second safe place outside the VM |
| `DISABLE_BEACON` | `true` |
| `REDACT_LOGS_TO_CLIENT` | `true` |

Keep exactly one backend running against the data. Backend upgrades restart it,
so run them outside school hours. Generate the admin key with
`generate_admin_key.sh` and give it only to CI and named operators.

### Caddy

Caddy issues TLS certificates on its own and proxies WebSockets without extra
configuration.

```caddyfile
app.fcsia.com {
  reverse_proxy web:3000
}

ia-api.fcsia.com {
  reverse_proxy backend:3210
}

ia-site.fcsia.com {
  reverse_proxy backend:3211
}
```

Login depends on the browser's host surviving the trip through the proxy. See
[auth-server.ts](../../apps/web/src/lib/auth-server.ts) and
[proxy.ts](../../apps/web/src/proxy.ts). Test login and redirects on the real
hostnames before cutover.

## Backups

Backups must live off the VM. This is the one safety measure that isn't
optional.

| Backup | Schedule | Destination |
| --- | --- | --- |
| `npx convex export` | Every 6 hours | Blob Storage |
| `npx convex export --include-file-storage` | Nightly | Blob Storage |

Upload with the VM's managed identity so no storage key sits on the server.
Alert when a backup job fails. Restore the latest export into a throwaway
instance **every term**, because an untested backup can't be trusted.

The accepted worst case is losing up to 6 hours of database data, up to a day of
uploaded files, and a few hours of downtime while the VM is rebuilt.

## Repo Changes

| File / area | Change |
| --- | --- |
| [next.config.ts](../../apps/web/next.config.ts) | Add `output: 'standalone'` and the monorepo tracing root. Check the Next.js docs in `node_modules/next/dist/docs/` first. |
| `apps/web/Dockerfile` (new) | Multi-stage Bun and Node 24 build with a non-root runtime. Run the `web` `prebuild` step, which generates the Excalidraw and `schedule-ocr-assets` files in `apps/web/public`. Copy `public` into the standalone output so the app serves both. Pass `NEXT_PUBLIC_*` values as build args, because they are compiled in. |
| `infra/azure-vm/` (new) | Compose file, Caddyfile, backup scripts, and a restore runbook. |
| [prod.yml](../../.github/workflows/prod.yml) | Keep tag validation and tests. Use `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY`. Replace the Vercel step with `azure/login` (OIDC), an image push, and `az vm run-command` to pull and restart. |
| [contributor-validation.yml](../../.github/workflows/contributor-validation.yml) | Update any production Convex URL or key assumptions. |
| Convex environment | Copy every variable from `elated-anaconda-301`. Pass that name explicitly: bare `--prod` can target the wrong deployment. Keep `BETTER_AUTH_SECRET`, `BETTER_AUTH_MAINTENANCE_SECRET`, and the VAPID keys. |
| Mobile | Point `EXPO_PUBLIC_CONVEX_URL` and `EXPO_PUBLIC_CONVEX_SITE_URL` at the new hostnames. Ship the change through EAS Update at cutover. |
| [auth.ts](../../apps/convex/src/auth.ts) | No change needed while the domain stays `app.fcsia.com`. Remove the Vercel handling after Vercel is retired. |

Keeping `app.fcsia.com` should preserve the browser origin, so installed PWAs
and web push subscriptions should keep working. Test both.

## Rollout

### 1. Prerequisites

- [ ] Confirm the Azure account belongs to the school or district, not a person,
      and that the district has approved student data in it.
- [ ] Name a staff owner and a backup operator.
- [ ] Get DNS access for `fcsia.com`.
- [ ] Get production access to Convex Cloud, plus edit access to GitHub secrets
      and variables. Include the developer who cuts releases.
- [ ] Decide when to take a read-only window (a weekend or school break).

### 2. Build and Staging

1. Create the Azure resources and configure the VM.
2. Run a separate staging instance on the VM with its own data volume and test
   hostnames.
3. Deploy with `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY`.

### 3. Compatibility Gate

Stop and resolve any failure here before moving on:

- [ ] The pinned backend image works with `convex` 1.46 and `defineApp({ env })`
- [ ] Rate limiter, migrations, presence, aggregate (`volunteerHours`), and
      Better Auth components work
- [ ] Volunteer hour totals match Convex Cloud after the data import
- [ ] Sign-in, sign-up, password reset, and mobile sign-in work
- [ ] `"use node"` actions work: web push and external calendar sync
- [ ] All crons in [crons.ts](../../apps/convex/src/crons.ts) run
- [ ] Upload, download, and search work, including after a backend restart
- [ ] Chat and whiteboards update live across two browsers
- [ ] Clients reconnect after a backend restart
- [ ] Expo push and Google Vision OCR work
- [ ] Browser schedule OCR loads its files from `/schedule-ocr-assets`

### 4. Load Test

Convex publishes no sizing guidance, so this test decides the VM size. Run it
from a separate temporary machine in the same region.

| Scenario | Target |
| --- | --- |
| Login burst | 300 sign-ins in 5 minutes |
| Steady state | 500 connected sessions for 30 minutes |
| Flex Friday | 500 registrations in 2 minutes |

Pass if p95 mutation latency stays under 300 ms, sustained CPU stays under 70%,
and there are no reconnect storms. If it fails, in this order:

1. Fix hot queries and heartbeats.
2. Raise the `APPLICATION_MAX_CONCURRENT_*` settings.
3. Resize to `Standard_D4as_v5` (~$126/month).
4. Move SQLite to Postgres on the VM or a managed server. The official path is
   an export, a new backend, and an import.

### 5. Migration Rehearsal

1. Run
   `npx convex export --include-file-storage --deployment elated-anaconda-301 --path prod.zip`.
2. Run `npx convex import --replace-all prod.zip` into staging. Restrict staging
   access to production operators while it holds real data, and wipe it after.
3. Check row counts (including auth tables), file counts, role permissions,
   existing sessions, and web push.
4. Time the export and import. That sets the cutover window.

If auth or file data doesn't transfer, stop and resolve it. Changing the Convex
site URL may also sign everyone out once. Confirm this here, and warn users if
it does.

### 6. Cutover

| Step | Action |
| --- | --- |
| T-7 days | Production VM is ready and functions are deployed. Lower DNS TTLs to 60 seconds. Announce the window. |
| Start | Pause Convex Cloud so crons, pushes, and writes can't run on both sides. Take the final export. |
| Import | Import into production and repeat the checks from the rehearsal. |
| Switch | Point `app`, `ia-api`, and `ia-site` DNS at the VM. Publish the mobile EAS Update. |
| Verify | Staff and student testers check login, chat, uploads, push, and Flex Friday. |

**Rollback:** until real users write to Azure, point DNS back and un-pause
Convex Cloud. After that, rolling back means exporting from Azure and importing
into Convex Cloud.

### 7. Clean Up (Cutover + 30 Days)

- [ ] Take one final Convex Cloud export, keep it in Blob Storage, then delete
      the deployments.
- [ ] Remove `CONVEX_DEPLOY_KEY` and `VERCEL_TOKEN` from GitHub.
- [ ] Delete the Vercel project, or keep it only for the
      `ia-app-alpha.vercel.app` notice.
- [ ] Remove staging from the VM.
- [ ] Update [deployment options](../reference/deployment-options.md),
      [environment](../reference/environment.md), and
      [Convex local and production runtime](../backend/convex-local-production.md).

## Ongoing Operations

| Task | Frequency | Owner |
| --- | --- | --- |
| Confirm backups ran | Weekly | Student maintainer |
| Check disk space | Weekly | Student maintainer |
| Check Azure costs | Monthly | Staff owner |
| Upgrade Convex: export, staging, then production | Monthly, outside school hours | Student maintainer, staff approval |
| Rebuild the web image for security fixes | Monthly | CI |
| Restore test | Each term | Student maintainer and staff |
| Remove graduated students' access | Each semester | Staff owner |

Self-hosting means the school owns uptime. Support comes from the Convex
community Discord, and a VM outage takes the whole app down.

## Risks

| Risk | Mitigation |
| --- | --- |
| VM failure | Tested restore runbook and off-VM backups |
| Disk fills up | Weekly check, resize the data disk early |
| SQLite struggles under load | Load test now, documented move to Postgres |
| Knowledge leaves with graduating students | Staff owner, runbooks in the repo, school accounts only |
| Stale PWA or mobile builds use old URLs | EAS Update at cutover; web clients update on reload |
| No WAF or global CDN | Accepted for now. Add Front Door if abuse or speed requires it |
| Self-hosted Convex behaves differently | The compatibility gate and rehearsal must pass before cutover |

## Related

- [Azure school environment plan](azure-school-environment-plan.md)
- [Azure hosting migration](azure-hosting-migration.md)
- [Azure portability review](azure-portability.md)
- [Convex self-hosting docs](https://docs.convex.dev/self-hosting)
