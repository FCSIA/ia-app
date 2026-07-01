---
tags: [reference, deployment, operations, convex, azure]
---

# Deployment Options

← [[index|Home]]

This page describes how to run the IA School App in production **after Convex is the application backend** — data, mutations, real-time subscriptions, and server functions live in **Convex Cloud**; the web app is **Next.js**.

For feature-level runtime detail, see [[overview]] and [[data-flow]]. For local development env vars, see [[environment]].

---

## Audience and goals

| Goal | What this doc optimizes for |
|------|-----------------------------|
| **School operations** | Predictable deploys, backups, and recovery with few moving parts |
| **Privacy** | School-owned or contractually clear data residency (FCS Innovation Academy) |
| **Peak load** | ~**1,600 students** in the building; **a few hundred** online at once at peak — not the full student body |
| **Maintainability** | Boring hosting that student/staff technical owners can reason about |

---

## Production architecture (baseline)

All options below share this shape:

```text
Users (browser)
  → HTTPS edge
  → Next.js (apps/web) — UI, App Router, Convex React client
  → Convex Cloud (prod deployment) — database, queries, mutations, actions, file storage
  → (optional) Azure Blob — large or school-mandated media archive if not solely on Convex storage
```

| Piece | Responsibility |
|-------|----------------|
| **Next.js** | Pages, client UI, Convex provider, SSR/RSC where used |
| **Convex** | Users, clubs, announcements, chat, events, schedules, notifications, audit data, auth integration |
| **Convex file storage** | Flyers, club images, chat attachments (or URLs pointing at blob storage) |
| **Edge / host** | TLS, routing, optional rate limits, static asset CDN |

There is **no self-hosted PostgreSQL** and **no NestJS API** in production for this architecture. Local `apps/api` and Prisma may remain in the repo for reference or tooling until removed; do not plan new production capacity around them.

The app is **not** a static export. Production needs a **Node-capable Next.js host** if you use App Router server features or server components.

---

## What every option must include

1. **HTTPS everywhere** — platform TLS or reverse proxy.
2. **Separate Convex deployments** — `dev`, `staging`, `prod` (or equivalent) with promote workflow in CI.
3. **Secrets out of git** — `CONVEX_DEPLOY_KEY`, auth provider secrets, and host env in Key Vault or the host’s secret store.
4. **School domain allowlisting** — Convex deployment URL and auth callbacks locked to school domains.
5. **Compliance exports** — scheduled Convex **actions** (or cron) to export audit logs, rosters, and moderation data to school-controlled storage; do not rely on the dashboard alone for FERPA-style retention.
6. **File backup strategy** — Convex storage durability plus periodic export to Azure Blob or similar if IT requires a second copy.
7. **Auth** — use Convex’s supported auth integration (e.g. Clerk, Auth0, or custom OIDC). Prefer **HttpOnly cookies** or Convex session patterns over long-lived tokens in `localStorage` for production hardening and future RSC.

---

## Deployment options

### Option 1 — Vercel + Convex Cloud (simplest operations)

Best for: **fastest path to production** when school IT accepts Vercel for the frontend and Convex as a separate SaaS backend.

```text
Users → Vercel (Next.js) → Convex Cloud
```

| Pros | Cons |
|------|------|
| Official Next.js + Convex integration and previews per branch | Frontend hosting outside school Azure subscription |
| Low ops: no VM patching | Two vendors to review (Vercel + Convex) |
| Built-in CDN for static assets | District may require all contracts under Azure |

**Typical setup:**

- Vercel project linked to `apps/web` (or monorepo root with correct root directory).
- Production env: `NEXT_PUBLIC_CONVEX_URL` → prod Convex deployment.
- Preview deployments → Convex **staging** deployment.
- CI: `pnpm --filter cvx deploy` on merge to main (deploy key in Vercel/GitHub secrets).

---

### Option 2 — Azure Container Apps + Convex Cloud (school-Azure frontend)

Best for: **FCS-owned Azure billing** for the web tier while Convex remains the managed backend (common school-private pattern).

```text
Users → Azure Front Door or App Gateway (optional)
     → Azure Container Apps (Next.js)
     → Convex Cloud
     → Azure Blob (optional media archive)
```

| Pros | Cons |
|------|------|
| Web tier in school tenancy | Convex still a third-party backend (review DPA) |
| Container Apps scale-to-zero or min replicas | More wiring than Vercel (ingress, env, secrets) |
| Natural fit for Application Insights | Not “everything in one VM” — still two systems |

| Component | Azure service |
|-----------|----------------|
| Web | **Container Apps** (Node image running `next start`) |
| TLS / routing | Container Apps ingress, or **Front Door** |
| Secrets | **Key Vault** referenced from Container Apps |
| Media archive (optional) | **Blob Storage** |
| Observability | **Application Insights** |

**Notes:**

- Do **not** use Azure Static Web Apps alone for full App Router + server features.
- Set Convex CORS / allowed origins to the school production URL.
- Use **2 vCPU / 4 GiB** per revision as a starting point; scale on CPU and p95 latency after load test.

---

### Option 3 — Azure Linux VM + Docker (school-Azure, more hands-on)

Best for: teams comfortable **patching a VM** but still wanting Convex managed (no Postgres on the box).

```text
Azure Linux VM
  → Caddy / nginx (TLS)
  → Next.js container
  → Convex Cloud
  → Azure Blob (optional)
  → Azure Backup (VM) + Blob versioning
```

| Pros | Cons |
|------|------|
| Single Azure bill line for compute you control | You own OS updates, disk, and failover |
| Works when Container Apps is not approved yet | Manual scaling; usually one VM is enough at this school size |
| Convex still avoids database ops | Weaker than Container Apps for zero-downtime deploys |

**VM sizing (starting point):** **2–4 vCPU**, **8–16 GB RAM** for Next.js only at few-hundred peak sessions. Convex handles backend load in their cloud.

**Recommended extras:** managed Blob for file archives, Key Vault for secrets, Azure Monitor agent, automated deploy from CI (not manual `docker compose` on the server).

---

### Option 4 — Generic Linux server (non-Azure)

Same as Option 3 on any Linux host (on-prem, another cloud, or district datacenter): **reverse proxy → Next.js → Convex Cloud**. Use when the school cannot use Vercel or Azure but can run Node and allow outbound HTTPS to Convex.

---

## Choosing an option

| Priority | Likely choice |
|----------|----------------|
| Minimum ops, okay with Vercel | **Option 1** |
| Must stay in Azure subscription | **Option 2** (preferred) or **Option 3** |
| IT only allows VMs | **Option 3** |
| Maximum simplicity for a student team | **Option 1** |

**Practical recommendation for IA:** **Option 2** (Azure Container Apps + Convex Cloud) if district IT wants Azure on the invoice; **Option 1** if speed matters more than Azure-only hosting.

---

## Scale planning (school size vs peak online)

### Enrollment vs simultaneous users

| Metric | Planning assumption |
|--------|---------------------|
| **Student body** | ~**1,600** high school students (plus teachers, sponsors, admins) |
| **Accounts in app** | Students + staff; not everyone logs in every day |
| **Peak simultaneous** | **A few hundred at most** during busy moments — not all 1,600 at once |

Total enrollment drives **data volume** and **export size**. Peak simultaneous sessions drive **Next.js concurrency** and **Convex query/subscription load**.

### What drives load on Convex

| Pattern | Guidance |
|---------|----------|
| **Subscriptions** | Prefer narrow subscriptions (e.g. one channel, one user’s notifications) over app-wide listeners |
| **Dashboard** | Batch reads in one query or a small number of queries; avoid N+1 function calls |
| **Feeds / chat** | Paginate; index fields used in `withIndex` |
| **File uploads** | Use Convex storage or presigned blob upload; do not pass large binaries through mutation args |
| **Scheduled jobs** | Use Convex cron/actions for digests and exports, not the browser |

At few-hundred peak users, **Convex’s managed scaling is unlikely to be the bottleneck** if queries are indexed and subscriptions are scoped. The usual tuning work is **query design**, not buying bigger servers.

### What drives load on Next.js

| Pattern | Guidance |
|---------|----------|
| **SSR / RSC** | Cache where safe; avoid fetching Convex on every static asset request |
| **CDN** | Serve `/_next/static` and public assets from the host CDN |
| **Concurrent SSR** | Set host concurrency limits from load test (Container Apps max replicas or Vercel plan) |

### Load testing

Before go-live, run **300–500 simulated concurrent sessions** (above expected peak, below total enrollment):

- Login burst (start of period)
- Dashboard load
- Club channel read + send message
- Notification badge / subscription updates

Tools: k6, Locust, or Playwright at scale. Watch Convex dashboard (function duration, error rate) and Next host (CPU, memory, 5xx).

---

## CI/CD and environments

| Environment | Convex | Next.js host |
|-------------|--------|----------------|
| **Development** | `convex dev` personal deployment | `pnpm dev` locally |
| **Staging** | Staging Convex deployment | Preview URL (Vercel) or staging Container App |
| **Production** | Prod Convex deployment | Production URL |

**Typical pipeline:**

1. PR → lint/build web; optional `convex deploy` to staging.
2. Merge to main → `convex deploy --cmd 'pnpm build'` (or project convention) to prod Convex.
3. Deploy Next.js image or Vercel production with `NEXT_PUBLIC_CONVEX_URL` for prod.

Store `CONVEX_DEPLOY_KEY` in GitHub Actions / Azure DevOps secrets, not on the VM disk in plain text.

---

## React Server Components and hosting

| Hosting choice | RSC / App Router |
|----------------|------------------|
| Vercel, Container Apps, Node on VM | Supported |
| Static export only | **Not sufficient** for server components and dynamic server routes |

Convex auth on the server (e.g. `fetchQuery` in Server Components with a valid session) works best with **cookie-based** sessions, not browser-only JWT in `localStorage`.

---

## Pre-launch checklist

### Security and config

- [ ] Prod vs staging Convex deployments isolated
- [ ] `NEXT_PUBLIC_CONVEX_URL` correct per environment
- [ ] Browser push VAPID keys set: public key in web env, public/private/subject in Convex env
- [ ] Auth provider production keys in Key Vault / secret manager
- [ ] School domains only in auth redirect URLs and Convex settings
- [ ] HTTPS and HSTS at the edge
- [ ] Rate limits on login (auth provider or Convex custom logic)

### Data and compliance

- [ ] Scheduled export jobs for audit, roster, moderation (school-owned storage)
- [ ] File/media backup strategy documented (Convex + optional Blob)
- [ ] FERPA / privacy review for Convex and host vendor DPAs
- [ ] Retention and deletion runbook tested

### Operations

- [ ] Health check on Next.js (`/api/health` or equivalent)
- [ ] Uptime and error alerts (Application Insights, Sentry, or Vercel analytics)
- [ ] Runbook: rotate deploy keys, rollback Convex deployment, rollback Next revision
- [ ] Load test at **300–500** concurrent sessions

---

## Environment variables (production)

| Variable | Role |
|----------|------|
| `NEXT_PUBLIC_CONVEX_URL` | Browser and SSR client → prod Convex deployment |
| `CONVEX_DEPLOY_KEY` | CI/CD deploy of functions and schema (secret, not in client bundle) |
| Auth provider vars | e.g. `CLERK_*`, `AUTH_*` — per chosen Convex auth integration |
| Blob vars (optional) | Azure storage connection string if archiving media outside Convex |

Legacy variables (`DATABASE_URL`, `NEXT_PUBLIC_API_URL`, `JWT_SECRET` for Nest) apply only to **old local/API workflows** until removed from the repo. Production Convex deployments should not depend on them.

Update [[environment]] when the repo’s `.env.example` matches this layout.

---

## Related documentation

- Root `README.md` — short deployment pointer
- [[overview]] and [[data-flow]] — current Next.js + Convex runtime shape
- [[overview]] — monorepo layout
- [[notifications]] — delivery model (subscriptions vs polling after Convex)
- [[environment]] — env var reference
- [[getting-started]] — local dev (Convex workflow once documented there)

---

## Document maintenance

Update this page when:

- Convex auth provider or deploy commands in the repo change
- The school selects or changes Azure vs Vercel hosting
- Peak usage assumptions change materially (e.g. district-wide mandatory use during class)
- `overview`, `data-flow`, and `environment` are aligned with the Convex production stack
