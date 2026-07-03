---
tags: [architecture, azure, compliance, portability, migration]
---

# Azure Portability Review

[Home](../index.md)

This document reviews whether the current Convex-era backend is modular enough
to migrate later to district-managed Azure infrastructure, and what an Azure
installation would likely require for a FERPA-sensitive school deployment.

This is not legal advice. FERPA compliance is a district obligation supported by
contracts, access controls, retention policy, operational practice, and
technical controls. Microsoft documents Azure as an in-scope service for FERPA
guidance and makes Azure FERPA implementation and mapping documents available
through Microsoft Learn:

- <https://learn.microsoft.com/en-us/compliance/regulatory/offering-ferpa>
- <https://learn.microsoft.com/en-us/compliance/regulatory/offering-home>

## Current Architecture

The active production shape is:

```text
Browser
  -> Next.js app in apps/web
  -> Better Auth route proxy at /api/auth/*
  -> Convex React hooks and generated api references
  -> Convex functions, database, auth component, storage, and scheduled/internal work
```

The backend is grouped by product domain under `apps/convex/src`:

| Domain | Current public API files |
| --- | --- |
| Users/auth/admin | `users/me.ts`, `users/auth.ts`, `users/admin.ts`, `auth.ts`, `http.ts` |
| Audit | `audit/events.ts` |
| Courses | `courses/catalog.ts` |
| Schedule | `schedule/dashboard.ts`, `schedule/friends.ts`, `schedule/blocks.ts` |
| Notifications | `notifications/inbox.ts`, `notifications/preferences.ts`, `notifications/push.ts` |
| Clubs | `clubs/management.ts`, `clubs/detail.ts`, `clubs/channels.ts`, `clubs/invitations.ts`, `clubs/tags.ts` |
| Announcements | `announcements/feed.ts`, `announcements/comments.ts`, `announcements/engagement.ts` |
| Events/calendar | `events/events.ts`, `events/approvals.ts`, `events/calendar.ts` |
| Flex Friday | `flexFriday/fridays.ts`, `sessions.ts`, `workshops.ts`, `registration.ts`, `attendance.ts`, `credits.ts` |
| Moderation | `moderation/keywords.ts`, `moderation/reports.ts` |
| Uploads | `uploads/files.ts` |
| Wrapped | `wrapped/snapshots.ts` |

That layout is a good start for modular API boundaries: each domain has a small
set of public queries/mutations and private helpers in `_lib.ts` or
serialization files. Authorization is mostly centralized around current-user
lookup and domain checks instead of trusting client-supplied user IDs.

## Portability Assessment

### What Is Already Portable

- Product domains are separated by directory and function reference.
- Public vs internal Convex functions are mostly explicit.
- Table schema, validators, and indexes are centralized in
  `apps/convex/src/schema.ts` and `apps/convex/src/validators.ts`.
- The old REST API is no longer the active data path, which reduces ambiguity.
- Auth, upload, notification, and audit concerns are documented separately.

### What Is Tightly Coupled To Convex

These dependencies would complicate a migration to an Azure-hosted backend:

| Coupling | Why it matters for migration |
| --- | --- |
| Direct web imports from `apps/convex/src/_generated/api` | UI components call Convex function references directly. A new backend would need either a compatibility client or broad frontend rewiring. |
| Convex React hooks | `useQuery`, `useMutation`, and `usePaginatedQuery` provide reactive subscriptions. Plain REST would lose this behavior unless replaced with polling, SSE, or WebSockets. |
| Convex IDs | Routes and types use `Id<"table">` and `_id`. A SQL backend must either preserve these IDs as string primary keys or provide a mapping layer. |
| Convex storage | Uploads use `ctx.storage.generateUploadUrl()`, `_storage` IDs, and `ctx.storage.getUrl()`. Azure Blob migration needs presigned SAS upload URLs and replacement storage metadata. |
| Better Auth Convex component | Sessions and auth tables live through the Convex component adapter. Azure should move auth storage to PostgreSQL or another district-approved store. |
| Convex components | `@convex-dev/better-auth` and `@convex-dev/rate-limiter` are backend components, not portable service interfaces. |
| Convex search indexes | User and course search use Convex search indexes. Azure needs PostgreSQL full text search or Azure AI Search. |
| Internal functions/actions | Seed/reset, push delivery, and snapshot generation use Convex internal functions/actions. Azure needs workers, cron, queues, or Azure Functions. |
| Transaction model | Convex mutations are transactional over document reads/writes. SQL ports must re-create transaction boundaries deliberately. |

### Boundary Gaps To Fix Before Migration

To make the app portable without starting the migration now:

1. Introduce a domain API client layer in `apps/web/src/lib/api` or
   `apps/web/src/features/*/api.ts`.
   The first implementation can still call Convex, but pages/components should
   stop importing `api.*` directly.
2. Define explicit DTOs for domain responses at the boundary.
   Do not let every component depend on raw Convex documents or generated return
   types.
3. Keep Convex IDs opaque in the UI.
   Avoid parsing IDs or relying on Convex table names outside route helpers and
   API adapters.
4. Isolate upload flows behind an `UploadService` shape:
   `createUploadUrl`, direct browser upload, `finalizeUpload`.
5. Isolate realtime behavior by domain:
   document which screens require live subscriptions versus normal request/response
   reads. Chat, notification badge counts, and inbox updates are the likely live
   surfaces.
6. Keep audit writes behind helper functions.
   A SQL migration should preserve audit semantics before feature parity polish.
7. Remove or quarantine legacy `apps/api` and stale Postgres/Redis docker
   references once they are no longer useful as migration reference material.

## Azure Target Architecture

There are three realistic hosting paths.

### Path 1: Azure Web Host With Managed Convex Cloud

This is the lowest-risk district-hosted deployment:

```text
Users
  -> Azure Front Door or Application Gateway
  -> Azure Container Apps or Azure App Service running Next.js
  -> Convex Cloud
  -> optional Azure Blob export/archive
```

Use this when the district wants the web tier under its Azure subscription but
will still accept Convex Cloud as a contracted backend vendor. See
[Deployment options](../reference/deployment-options.md) and
[Convex local and production runtime](../backend/convex-local-production.md).

### Path 2: Azure Web Host With Self-Hosted Convex

This keeps the Convex programming model but moves the backend runtime and
persistence into district-controlled infrastructure:

```text
Users
  -> Azure Front Door or Application Gateway
  -> Azure Container Apps or App Service: Next.js
  -> self-hosted Convex backend/dashboard
  -> Azure managed disk, SQLite, or Azure Database for PostgreSQL
  -> S3-compatible object storage for Convex files/exports/snapshots
     or persistent volume storage until object storage is validated
  -> Azure Monitor / Log Analytics
```

This is different from a Convex CLI local deployment. Local deployments are
development backends. Self-hosted Convex is the production-oriented container or
server deployment model, and the district/team owns persistence, backups,
upgrades, monitoring, admin access, and incident response.

The more precise district decision is:

> Which backend boundary is acceptable for FERPA-sensitive student data?
>
> 1. Managed Convex Cloud as the contracted backend, with the Next.js web tier
>    hosted in district Azure.
> 2. Self-hosted Convex running inside district-controlled Azure infrastructure,
>    with district-owned persistence, storage, logs, backups, and exports.
> 3. A full Azure-native backend replacement using district Azure services such
>    as PostgreSQL, Blob Storage, Key Vault, Functions/workers, and an API
>    service.

If the answer is "managed Convex Cloud is acceptable," the near-term work is
Azure web hosting, production Convex environment hardening, backup/export
runbooks, and contract/privacy review. If the answer is "data must live in
district Azure," the next question is whether self-hosted Convex is acceptable
or whether the district requires an Azure-native rewrite.

### Path 3: Full Azure Backend Replacement

This is the true portability target:

```text
Users
  -> Azure Front Door or Application Gateway
  -> Azure Container Apps or App Service: Next.js
  -> Azure Container Apps, App Service, or Azure Functions: backend API/workers
  -> Azure Database for PostgreSQL Flexible Server
  -> Azure Blob Storage
  -> Azure Cache for Redis, optional for rate limits/cache/pubsub
  -> Application Insights, Log Analytics, Key Vault
```

Recommended Azure services:

| Need | Azure service |
| --- | --- |
| Web and API containers | Azure Container Apps or Azure App Service |
| Database | Azure Database for PostgreSQL Flexible Server |
| Object storage | Azure Blob Storage |
| Secrets | Azure Key Vault |
| Identity / SSO | Microsoft Entra ID or district-approved OIDC |
| Background jobs | Azure Functions, Container Apps jobs, or worker containers |
| Realtime updates | WebSockets/SSE on the API, Azure Web PubSub, or polling where acceptable |
| Observability | Application Insights and Log Analytics |
| Edge/security | Front Door, Application Gateway/WAF, private endpoints where required |

Microsoft references:

- Container Apps overview:
  <https://learn.microsoft.com/en-us/azure/container-apps/overview>
- JavaScript on Container Apps:
  <https://learn.microsoft.com/en-us/azure/container-apps/javascript-overview>
- App Service Node.js:
  <https://learn.microsoft.com/en-us/azure/app-service/quickstart-nodejs>
- PostgreSQL Flexible Server:
  <https://learn.microsoft.com/en-us/azure/postgresql/overview>
- PostgreSQL security:
  <https://learn.microsoft.com/en-us/azure/postgresql/security/security-overview>
- Blob Storage security:
  <https://learn.microsoft.com/en-us/azure/storage/blobs/security-recommendations>
- Storage private endpoints:
  <https://learn.microsoft.com/en-us/azure/storage/common/storage-private-endpoints>

## FERPA-Sensitive Azure Requirements

The district should confirm these items before production student data is loaded:

| Requirement | Likely implementation |
| --- | --- |
| Contractual coverage | District legal/procurement confirms Azure agreement, FERPA terms, data processing terms, and any state student data privacy addenda. |
| Tenant and region | Use district-controlled Azure/Microsoft Entra tenant and approved US region/data residency setting. |
| Identity | Prefer district Entra ID/OIDC SSO, MFA for staff/admins, and role mapping from district-controlled groups where possible. |
| Least privilege | Separate student, sponsor, support, admin, and super-admin permissions. Restrict direct database/storage access to service identities and named operators. |
| Encryption in transit | HTTPS at the edge; TLS to database and storage. |
| Encryption at rest | Azure-managed encryption by default; consider customer-managed keys in Key Vault if district policy requires it. |
| Network isolation | Private endpoints for PostgreSQL and Blob Storage where supported by the selected hosting model. |
| Secret management | Store app secrets, VAPID private key, database credentials, and deploy credentials in Key Vault or Azure DevOps/GitHub protected secrets. |
| Audit logging | Preserve app-level `auditEvents`; enable Azure platform logs for app, database, storage, identity, and Key Vault access. |
| Retention/export | Define how long rosters, audit logs, uploads, reports, and deleted-user records are retained. Export compliance records to district-controlled storage. |
| Backup/restore | PostgreSQL point-in-time restore, storage versioning/soft delete as required, tested restore runbooks. |
| Incident response | Alerts for auth failures, privilege changes, storage access anomalies, API errors, and unusual data export activity. |
| Data deletion | Runbook for parent/student rights workflows, graduated students, and district retention requirements. |

FERPA does not make an app compliant solely because it runs on Azure. The app
must enforce legitimate educational interest through authorization, logging,
retention, and operating procedures.

## Likely Migration Process

### 1. Architecture Hardening

- Add a web API adapter layer so Convex-specific imports are not scattered
  through pages/components.
- Freeze domain DTOs for users, clubs, announcements, schedule, events, Flex
  Friday, notifications, audit, moderation, uploads, and wrapped.
- Document which reads need realtime behavior and which can become normal HTTP
  reads.
- Keep all new backend calls behind domain boundaries.

### 2. Azure Proof Of Concept

- Containerize the Next.js app with standalone output.
- Deploy the web app to Azure Container Apps or App Service.
- Keep Convex as backend for the first Azure-hosted web proof.
- Configure Key Vault, Application Insights, HTTPS, custom domain, and
  production/staging environment separation.

### 3. Backend Replacement Design

- Choose backend style: Next.js route handlers for small scope, or separate
  Fastify/Nest/Express service for clearer API ownership.
- Choose database schema for Azure PostgreSQL.
- Map Convex tables and indexes to SQL tables, indexes, constraints, and
  full-text/search strategy.
- Define auth/session storage under PostgreSQL or Entra-backed OIDC.
- Define Blob upload flow with short-lived SAS URLs.
- Define background jobs for push delivery, snapshots, seed/import, cleanup, and
  compliance exports.

### 4. Data Migration

- Export Convex data by table, preserving `_id`, `_creationTime`, and foreign
  key relationships.
- Migrate files from Convex storage to Blob Storage and write a storage ID/URL
  mapping table.
- Import into PostgreSQL in dependency order: users/auth, courses, clubs,
  channels/messages, announcements, events/calendar, schedule, flex, moderation,
  notifications, audit, wrapped.
- Run row counts, referential checks, permission spot checks, and sample UI
  acceptance tests.

### 5. Dual-Run Or Cutover

- Prefer a staging rehearsal with production-like data before any real cutover.
- For final cutover, freeze writes in Convex, export delta data, import delta
  data, point web env to Azure API, and monitor errors closely.
- Keep Convex read-only and restorable until district signoff.

### 6. Post-Cutover Operations

- Validate backup restore.
- Validate audit export and retention jobs.
- Rotate temporary migration credentials.
- Remove Convex deploy credentials from production CI after decommission.
- Update docs so operators no longer use Convex Dashboard workflows.

## Suggested Next Engineering Work

1. Add the web domain API adapter layer before feature work expands further.
2. Create a schema mapping document from Convex tables to Azure PostgreSQL
   tables.
3. Decide whether `apps/api` is deleted or deliberately retained as an Azure API
   prototype; do not leave it half-active.
4. Add a minimal health route for Azure hosting.
5. Add export scripts for Convex table data and storage inventory.
6. Run a security review focused on FERPA-sensitive access paths: users,
   schedules, clubs/messages, moderation reports, uploads, and audit logs.
7. Prepare a district-facing vendor/data-flow packet for managed Convex:
   production topology, data categories stored in Convex, backup/export plan,
   dashboard access controls, incident response ownership, and the decision
   question above.

## Open Questions For The District

- Must all student data live inside the district Azure tenant, or is a
  contracted SaaS backend acceptable if the web tier runs in Azure?
- Which Azure region and data residency requirements apply?
- Is Microsoft Entra ID required for student/staff SSO?
- Are private endpoints mandatory for database and storage?
- What retention periods apply to chat messages, moderation reports, uploads,
  audit events, schedules, and graduated student records?
- Does the district require customer-managed keys?
- Which team owns production incident response, backups, and access reviews?
