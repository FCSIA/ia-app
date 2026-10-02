---
tags: [architecture, azure, migration, convex, self-hosting, costs]
---

# Azure Hosting Migration for the IA App

[Home](../index.md)

This plan moves the IA App off Vercel and off Convex Cloud and onto the
school's Azure environment. The app keeps using Convex: we run the open-source
**self-hosted Convex backend** in Azure, so the application code, the
`useQuery` / `useMutation` reactivity, and the generated API stay the same.
This is "Path 2" in the [Azure portability review](azure-portability.md).

The environment it lands in (subscriptions, purchasing, access, governance) is
defined in the [Azure school environment plan](azure-school-environment-plan.md).

> Prices are Microsoft list (pay-as-you-go) prices for **East US 2**, pulled
> from the Azure Retail Prices API on **2026-10-01**.

## Sizing Assumptions

| Input | Value | Note |
| --- | --- | --- |
| Concurrent users | **~1,800** (1,600 students + 150–200 staff) | Earlier docs assumed a few hundred at peak. This plan sizes for everyone online at once. |
| Concurrent WebSocket connections | **2,500–3,500** | Users have the web app, the installed PWA, and the Expo app across phones, laptops, and multiple tabs. |
| Burst patterns | 8:00 AM logins; class-change and Flex Friday registration spikes | Password hashing at login is CPU-heavy, so the login burst is the main CPU risk. |
| Data volume | Database < 20 GB; files ~50–150 GB in year one | Confirm with `npx convex export` size during the rehearsal. |
| Region | East US 2 | Any US region the district approves. |

## What Changes and What Doesn't

| Piece | Today | After migration |
| --- | --- | --- |
| Web app (`apps/web`, Next.js) | Vercel | **Azure Container Apps** (Node container) behind **Azure Front Door** |
| Backend functions, scheduler, crons, HTTP actions (`apps/convex`) | Convex Cloud (`elated-anaconda-301`) | **Self-hosted Convex backend** container on Azure Container Apps |
| Database | Convex Cloud | **Azure Database for PostgreSQL Flexible Server** (Convex's persistence layer) |
| File storage (club images, chat attachments, avatars, schedule OCR images), modules, search indexes, exports | Convex Cloud | **Azure Blob Storage**, through an S3-compatible proxy sidecar |
| Convex dashboard | dashboard.convex.dev | Self-hosted dashboard container, behind Entra ID sign-in |
| Secrets | Vercel and Convex env vars, GitHub secrets | **Azure Key Vault** + Convex deployment env vars + GitHub OIDC |
| CI/CD | GitHub Actions → `convex deploy` + `vercel deploy` | GitHub Actions → build image → Azure Container Registry → Container Apps; `convex deploy` to the self-hosted URL |
| Logs and monitoring | Convex and Vercel dashboards | Log Analytics + Application Insights, with alerts |
| App code, schema, Better Auth component, rate limiter, migrations component | — | **No rewrite.** Configuration changes only (listed below) |
| Expo push (`exp.host`), web push (VAPID), Google Vision OCR, external iCal feeds | Outbound calls from Convex | Same outbound calls, now leaving from Azure |

## Target Architecture

```text
                         ┌──────────────── Azure: sub-ia-prod / rg-iaapp-prod (East US 2) ────────────────┐
Browsers / PWA           │                                                                                │
   │ HTTPS               │   Container Apps environment (workload-profiles, custom VNet)                  │
   ├──► Front Door Std ──┼──► ca-iaapp-web      Next.js standalone, 2–6 replicas, 1 vCPU / 2 GiB         │
   │   app.<domain>      │        │ /api/auth/* proxy                                                     │
   │                     │        ▼                                                                       │
   │ WSS + HTTPS         │   ca-iaapp-convex   1 replica (never more), 4 vCPU / 8 GiB total               │
   ├────────────────────►│    ├─ convex-backend  :3210 API/sync   :3211 HTTP actions                      │
Expo app                 │    ├─ caddy sidecar   routes api.<domain>→3210, site.<domain>→3211             │
   └── api.<domain> ─────┤    └─ s3proxy sidecar S3 API → Azure Blob (managed identity / key from KV)     │
       site.<domain>     │        │ private VNet                    │                                     │
                         │        ▼                                 ▼                                     │
                         │   PostgreSQL Flexible Server         Storage account (Blob, ZRS)               │
                         │   GP D2ds_v5, zone-redundant HA       convex-files / -modules / -search /       │
                         │   PITR 35 days, private access        -exports / -snapshot-imports              │
                         │                                                                                │
                         │   ca-iaapp-dashboard (scale-to-zero, Entra auth)   job-iaapp-export (nightly)  │
                         │   Key Vault · App Insights · Log Analytics (shared) · ACR (shared)             │
                         └────────────────────────────────────────────────────────────────────────────────┘
```

### Why the Convex Traffic Bypasses Front Door

Front Door Standard and Premium support WebSockets, but **each Front Door
profile allows at most 3,000 concurrent WebSocket connections**. Front Door
also closes idle connections after 5 minutes and caps every connection at 2
hours.
([Microsoft Learn](https://learn.microsoft.com/en-us/azure/frontdoor/standard-premium/websocket))
We expect 2,500–3,500 Convex sync connections, and the Front Door profile is
shared with future school apps, so routing Convex sync through it would hit
that ceiling. Instead:

- `app.<domain>` (the Next.js pages, static assets, and the `/api/auth` proxy)
  goes through **Front Door** for CDN caching and TLS.
- `api.<domain>` (Convex sync) and `site.<domain>` (HTTP actions) go **straight
  to the Container Apps ingress**, using managed TLS certificates.

If the district requires a WAF on every public endpoint, put **Application
Gateway WAF_v2** in front of the Convex app instead. It has no such WebSocket
ceiling, but adds roughly $330+/month.

### Why Container Apps (Not App Service or a VM)

- One platform runs both the web app and the Convex backend, and future school
  apps can join the same environment.
- Managed TLS, revisions and rollback, Key Vault references, managed
  identities, and built-in Entra sign-in to protect the dashboard.
- A single VM is cheaper (see [Budget Alternative](#budget-alternative)), but
  someone would have to patch the OS and manage disks and backups.

## Self-Hosted Convex Configuration

The self-hosted backend is a single-node service. It needs PostgreSQL in the
same region (any latency between the backend and the database slows every
query). It can store files, modules, search indexes, and exports in
S3-compatible object storage.
([self-hosted README](https://github.com/get-convex/convex-backend/blob/main/self-hosted/README.md),
[configuration reference](https://mintlify.wiki/get-convex/convex-backend/self-hosting/configuration),
[Convex Stack: self-hosting](https://stack.convex.dev/self-hosted-develop-and-deploy))

| Setting | Value |
| --- | --- |
| Image | `ghcr.io/get-convex/convex-backend:<pinned tag>`, mirrored to the school's ACR. **Never `latest`.** |
| `POSTGRES_URL` | `postgres://<user>:<pw>@<server>.postgres.database.azure.com` (no database name; the backend uses `INSTANCE_NAME`). Stored in Key Vault. |
| `INSTANCE_NAME` / `INSTANCE_SECRET` | `iaapp-prod` / a random 32-byte hex value in Key Vault. Treat it like a root key. |
| `CONVEX_CLOUD_ORIGIN` | `https://api.<domain>` |
| `CONVEX_SITE_ORIGIN` | `https://site.<domain>` |
| `S3_ENDPOINT_URL` | `http://localhost:<s3proxy port>` (sidecar) |
| `S3_STORAGE_{FILES,MODULES,SEARCH,EXPORTS,SNAPSHOT_IMPORTS}_BUCKET` | One Blob container each |
| `AWS_S3_FORCE_PATH_STYLE` | `true` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` | Credentials the s3proxy sidecar expects (local only) |
| `DISABLE_BEACON` | `true` |
| `REDACT_LOGS_TO_CLIENT` | `true` (keeps stack traces and PII out of browsers) |
| `RUST_LOG` | `info` |
| Replicas | min = max = **1**, single-revision mode |
| Resources | 4 vCPU / 8 GiB total (the Consumption-plan maximum): backend ~3.25 vCPU, s3proxy ~0.5, caddy ~0.25 |

**Azure Blob is not natively S3-compatible.** The plan runs
[S3Proxy](https://github.com/gaul/s3proxy) (Apache-2.0, with an Azure Blob
backend that Microsoft helped build) as a sidecar. Validate it in the proof of
concept. Fallback: leave the S3 variables unset so Convex stores files on local
disk, and mount an **Azure Files Premium** share at the data directory. That is
simpler, but performance has to be tested.

**Ports:** the backend serves the API and sync on 3210 and HTTP actions on 3211.
A Container App exposes one external HTTP port, so a small Caddy sidecar
routes by host name. During the proof of concept, check whether the backend's
`/http` path prefix on port 3210 can serve HTTP actions. If it can, the Caddy
sidecar and the `site.` domain can go.

**Never run two backend replicas against one database.** Use single-revision
mode and stop the old revision before starting the new one. This causes a few
seconds to a minute of downtime per backend upgrade, so schedule upgrades
outside school hours.

**Dashboard:** run `ghcr.io/get-convex/convex-dashboard` as its own container
app, scaled to zero, with Container Apps built-in authentication (Entra ID)
limited to `IA-Azure-Prod-Operators`. Generate the admin key with the
backend's `generate_admin_key.sh` and store it in Key Vault. Only CI and named
operators hold it.

## Required Code and Repo Changes

These are small, and most can merge ahead of the cutover:

| File / area | Change |
| --- | --- |
| [next.config.ts](../../apps/web/next.config.ts) | Add `output: 'standalone'` and `outputFileTracingRoot` (monorepo root). After cutover, drop the hard-coded `*.convex.cloud` / `*.convex.site` from `img-src`; the CSP already builds itself from `NEXT_PUBLIC_CONVEX_URL`. Read the build stamp from `NEXT_PUBLIC_APP_COMMIT` (CI already passes it) instead of `VERCEL_GIT_COMMIT_SHA`. |
| `apps/web/Dockerfile` (new) | Multi-stage build: `pnpm` + `turbo prune web`, run the `prebuild` Excalidraw asset copy, `next build`, then a Node 24 slim runtime as a non-root user. `NEXT_PUBLIC_*` values are compiled into the bundle, so CI builds **one image per environment**. |
| `apps/web/src/app/api/health/route.ts` (new) | A liveness and readiness probe for Container Apps and Front Door. |
| [auth.ts](../../apps/convex/src/auth.ts) | Remove the `VERCEL_URL` and `ia-app-alpha.vercel.app` trusted-origin handling once the Vercel redirect is retired. Make sure `SITE_URL` / `BETTER_AUTH_TRUSTED_ORIGINS` cover the Azure origins. |
| [proxy.ts](../../apps/web/src/proxy.ts) | Keep the legacy-host `/moved` redirect only while the Vercel project still serves it. |
| [prod.yml](../../.github/workflows/prod.yml) | Replace the Vercel step: `azure/login` (OIDC) → `docker build` → push to ACR → `az containerapp update`. Run `convex deploy` with `CONVEX_SELF_HOSTED_URL` and `CONVEX_SELF_HOSTED_ADMIN_KEY` instead of `CONVEX_DEPLOY_KEY`. Keep the tag validation and test gate. Add GitHub Environment protection (required reviewer) for `production`. |
| `infra/` (new) | Bicep for everything in the architecture diagram, parameterized by `env`. |
| Mobile (`apps/mobile`) | `EXPO_PUBLIC_CONVEX_URL` / `EXPO_PUBLIC_CONVEX_SITE_URL` point to the new stable domains. EAS Update is already configured ([app.config.ts](../../apps/mobile/app.config.ts)), so the change can ship over the air within the same `runtimeVersion`. |
| Docs | Update [deployment.md](deployment.md), [convex-local-production.md](../backend/convex-local-production.md), and [environment.md](../reference/environment.md) after cutover. |

### Stable Domains First (Lowers Cutover Risk)

Installed mobile apps and PWAs have the backend URL compiled in. If the
current Convex Cloud plan supports **custom domains**, point
`api.<domain>` / `site.<domain>` at Convex Cloud **now** and ship web and
mobile builds that use them. Cutover then only needs a DNS change, and old app
builds keep working. If custom domains aren't available, ship the mobile EAS
Update at cutover and show a "please update" screen to stale builds.

## Migration Plan

### Phase 0: Prerequisites (Weeks 0–4)

- [ ] Subscriptions, groups, and policies from the
      [environment plan](azure-school-environment-plan.md) exist.
- [ ] DNS for the production domain is controlled by a school account.
- [ ] District data privacy sign-off for the services in this doc.
- [ ] Repo and CI moved to a school-owned GitHub organization (recommended).

### Phase 1: Staging Proof of Concept (Weeks 4–6)

1. Deploy staging infrastructure from Bicep into `rg-iaapp-staging`.
2. Deploy Convex functions to staging:
   `CONVEX_SELF_HOSTED_URL=... CONVEX_SELF_HOSTED_ADMIN_KEY=... pnpm --filter cvx exec convex deploy`.
3. Copy the environment variables (`npx convex env list --deployment elated-anaconda-301`),
   using **new** secrets for staging.
4. Load demo data: `convex run bootstrap:resetAndSeed`.
5. **Parity checklist.** Each item must pass on self-hosted:
   - [ ] Better Auth sign-in, sign-up, sessions, password reset; Expo auth plugin
   - [ ] Rate limiter and migrations components
   - [ ] All 5 crons in [crons.ts](../../apps/convex/src/crons.ts) run on schedule
   - [ ] Scheduled functions and `"use node"` actions (web push, iCal sync)
   - [ ] Upload → finalize → `getUrl` → download for club images, chat attachments, and avatars, all through s3proxy
   - [ ] Search indexes (users, courses) build, persist across restarts, and return results
   - [ ] Web push (VAPID), Expo push, Google Vision OCR import
   - [ ] `/impersonate` HTTP route and Better Auth HTTP routes on `site.<domain>`
   - [ ] Whiteboards and channel chat stay real-time across two browsers
   - [ ] Backend restart: clients reconnect, no data loss
   - [ ] Dashboard reachable only through Entra sign-in

### Phase 2: Load Test (Week 6–7)

Run [k6](https://k6.io/) from a temporary VM in the same region (a few dollars).
This is cheaper than Azure Load Testing at this scale.

| Scenario | Target |
| --- | --- |
| Login burst | 1,800 sign-ins within 5 minutes |
| Steady state | 2,000 virtual users, 3,500 WebSocket subscriptions (dashboard, notifications, 1 channel each) for 30 minutes |
| Chat burst | 300 users sending in 20 busy channels |
| Flex Friday registration | 1,600 registrations within 2 minutes |

Pass criteria: p95 mutation latency under 300 ms, no WebSocket disconnect
storms, backend CPU under 70% sustained, PostgreSQL CPU under 60%.

If it fails, scale up in this order:

1. PostgreSQL to D4ds_v5 (+$130/mo).
2. The Convex backend to a **Dedicated D8 workload profile**, 8 vCPU / 32 GiB
   (about +$290/mo).
3. Review hot queries and subscriptions. These usually help more than bigger
   machines.

### Phase 3: Data Migration Rehearsal (Week 7–8)

1. `npx convex export --include-file-storage --deployment elated-anaconda-301 --path prod.zip`
2. `npx convex import --replace-all prod.zip` into **staging**. Staging then
   briefly holds real data, so restrict access to production operators for the
   rehearsal, then wipe it.
3. Verify:
   - [ ] Row counts per table (including Better Auth component tables)
   - [ ] File count and total bytes
   - [ ] Spot-check permissions by role
   - [ ] Existing sessions still valid (same `BETTER_AUTH_SECRET`)
   - [ ] Web push still delivers (same VAPID keys)
4. Time the export and import. That duration sets the cutover window.

If component data or file storage doesn't come across in the snapshot, stop and
resolve it before scheduling cutover.

### Phase 4: Production Cutover (During a School Break or Weekend)

| Step | Action |
| --- | --- |
| T-7 days | Production infrastructure deployed and empty. Production Convex functions deployed. Env vars set with the **same** `BETTER_AUTH_SECRET` and VAPID keys. Lower DNS TTLs to 60 s. Announce maintenance. |
| T-0 | Pause the Convex Cloud deployment from its dashboard to freeze writes. Run the final `convex export --include-file-storage`. |
| +1 h* | `convex import --replace-all` into production. Run the verification checklist. |
| +2 h* | Switch DNS: `app.<domain>` → Front Door; `api.` / `site.` → Container Apps. Update `SITE_URL`, `NEXT_PUBLIC_SITE_URL`, and trusted origins. Publish the mobile EAS Update if needed. |
| +3 h* | Smoke tests by staff and student testers: login, chat, upload, push, Flex Friday. |
| Rollback | Up to the point real users write to Azure: point DNS back and un-pause Convex Cloud. After that, rolling back means exporting from self-hosted and importing into Convex Cloud. |

\* Durations come from the Phase 3 rehearsal.

### Phase 5: Decommission (Cutover + 30 Days)

- [ ] Keep Convex Cloud paused, not deleted, for 30 days. Then take a final
      export to Blob (immutable) and delete the deployments.
- [ ] Remove `CONVEX_DEPLOY_KEY` and `VERCEL_TOKEN` from GitHub. Delete the
      Vercel project, or keep it only for the legacy redirect.
- [ ] Rotate every secret that was ever on Vercel or Convex Cloud, except the
      session and VAPID keys if rotating them would log out every user or break
      every push subscription (schedule those rotations separately).
- [ ] Update the docs listed above.

## Day-2 Operations

| Task | How | Owner |
| --- | --- | --- |
| Backups | PostgreSQL point-in-time restore (35 days) **plus** a nightly `convex export --include-file-storage` from a Container Apps Job to an immutable Blob container (90-day retention) **plus** Azure Backup vaulted long-term retention for PostgreSQL | Automated, checked monthly |
| Restore test | Restore the latest export into staging each term | Student maintainer + staff |
| Convex upgrades | Pin the image tag. Upgrade monthly in a window: staging first, then production. Follow the release notes for PostgreSQL migrations | Student maintainer, staff approves |
| OS/runtime patching | Handled by Container Apps. Rebuild the web image monthly for Node security fixes | CI |
| Alerts | Backend down, 5xx rate, PostgreSQL CPU or storage over 80%, export job failure, budget at 80% | Staff sponsor + maintainer |
| Access review | Each semester, remove graduated students | Staff sponsor |

Self-hosting means **the school owns uptime**. Convex Cloud's managed
operations, support, and multi-service scaling go away. The backend becomes a
single node: a backend restart reconnects every client, and a PostgreSQL
failover (with HA) takes about 1–2 minutes.

## Expected Costs

### Production (`rg-iaapp-prod`), Monthly, List Price

| Service | Configuration | Rate used | Monthly |
| --- | --- | --- | --- |
| Container Apps: Convex backend | 4 vCPU / 8 GiB, 1 replica always on; assumes active about 60% of hours | Active $0.0864/vCPU-h + $0.0108/GiB-h; idle $0.0108 per vCPU-h and GiB-h | **~$230** (worst case, always active: $315) |
| Container Apps: Next.js web | 2–6 replicas × 1 vCPU / 2 GiB, minimum 2 | Same rates, after the monthly free grant | **~$110** |
| Container Apps: dashboard + nightly export job | Scale-to-zero / ~15 min per day | — | **~$3** |
| PostgreSQL Flexible Server | General Purpose **D2ds_v5** (2 vCore, 8 GiB) | $0.178/h | **$130** |
| PostgreSQL storage | 128 GiB | $0.115/GiB-mo | **$15** |
| PostgreSQL zone-redundant HA *(recommended)* | Standby compute + storage | Same as primary | **+$145** |
| Blob Storage | ~100 GB hot ZRS, versioning + soft delete, plus operations | ~$0.02/GB | **~$5** |
| Front Door (app's share of usage) | ~20M requests, ~150 GB served | ~$0.009 per 10K requests + data transfer | **~$35** |
| Internet egress from Convex | ~300 GB/mo (sync + file downloads); first 100 GB free | ~$0.087/GB | **~$20** |
| Log Analytics + App Insights | ~10 GB/mo, daily cap set | $2.76/GB | **~$30** |
| Azure Backup (PostgreSQL long-term) | 1 instance + storage | $7.50 + storage | **~$10** |
| Key Vault, public IP, misc. | — | — | **~$5** |
| **Production total** | | | **~$590 without HA / ~$740 with HA** |

### Staging (`rg-iaapp-staging`)

| Service | Configuration | Monthly |
| --- | --- | --- |
| Convex backend | 1 vCPU / 2 GiB, mostly idle | ~$30 |
| Web | Scale-to-zero | ~$3 |
| PostgreSQL | Burstable B1ms + 32 GiB | ~$16 |
| Blob, logs, Key Vault | — | ~$8 |
| **Staging total** | | **~$60** |

### Shared Platform (Charged Once to the School Platform)

The Front Door base fee ($35), ACR Basic (~$5), and DNS (~$1). See the
[environment plan](azure-school-environment-plan.md#expected-costs).

### Summary

| Scenario | Monthly | Annual |
| --- | --- | --- |
| Recommended (production with HA + staging, excluding shared platform) | **~$800** | **~$9,600** |
| Lean (production without HA + staging) | ~$650 | ~$7,800 |
| Scaled up after load test (D4 database + Dedicated D8 backend, HA) | ~$1,200 | ~$14,400 |
| After 1-year PostgreSQL reservation (about 40% off database compute) | about $50–$100 less | about $600–$1,200 less |

### Budget Alternative

A single **D4s_v5 Linux VM** ($0.192/h ≈ $140/mo) running Docker Compose
(Convex backend + PostgreSQL + Caddy + Next.js), with a 256 GB Premium SSD,
Azure Backup, and Blob for exports, costs **about $230–$280/month**. The
trade-offs: one machine runs everything, nobody else patches the OS, there's no
database HA, and every backup, restore, and upgrade depends on whoever operates
it. Use it only if the budget can't support the recommended design.

## Risks

| Risk | Mitigation |
| --- | --- |
| Self-hosted Convex differs from Convex Cloud (components, export of component tables, storage) | Phase 1 parity checklist and Phase 3 rehearsal are hard gates |
| s3proxy ↔ Blob edge cases | Proof-of-concept tests. Fallback: Azure Files–backed local storage |
| A single backend node is a single point of failure | Container Apps auto-restarts it. Database HA. Off-hours upgrades. Tested restore |
| 4 vCPU Consumption ceiling under login burst | Load test. Dedicated D8 profile path |
| Front Door WebSocket limit | Convex sync bypasses Front Door (above) |
| Stale mobile and PWA builds still use old URLs | Stable custom domains first, plus EAS Update |
| Operational knowledge leaves with graduating students | Runbooks in `docs/`, staff owner, Bicep IaC, access through school identities only |
| Google Vision (GCP) remains outside Azure | Acceptable for now. Optionally replace it with Azure AI Vision Read OCR later |

## Related

- [Azure school environment plan](azure-school-environment-plan.md)
- [Azure portability review](azure-portability.md)
- [Convex local and production runtime](../backend/convex-local-production.md)
- [Deployment options](../reference/deployment-options.md)
