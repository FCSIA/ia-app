---
tags: [docs, index]
---

# IA App Documentation

This documentation describes the current Convex-era IA School App. Treat code as
the source of truth when it disagrees with docs, then update the docs in the
same change.

## Start Here

- [Developer setup](reference/getting-started.md) - local environment, Convex dev deployment,
  seed/reset, and demo accounts.
- [Student contributor review](reference/contributor-review.md) - untrusted pull-request
  boundaries, maintainer review, and the Codex Security CLI enablement gate.
- [Architecture overview](architecture/overview.md) - how the web app, Convex
  backend, auth, storage, and deployment fit together.
- [Azure portability review](architecture/azure-portability.md) - backend
  modularity, Convex migration risks, and district Azure deployment planning.
- [Client state ownership](architecture/client-state-ownership.md) - why the
  app is not adopting Zustand or XState now and what would trigger a pilot.
- [Frontend overview](frontend/frontend-overview.md) - Next.js app structure and
  browser-side conventions.
- [Convex backend overview](backend/convex-overview.md) - function layout,
  generated API types, public/internal boundaries, and coding rules.
- [Convex local and production runtime](backend/convex-local-production.md) -
  how dev deployments, local backends, production Convex, and Azure web hosting
  fit together.
- [iPhone mobile development](reference/mobile-iphone-development.md) - Expo Go
  versus the installed development app, first-time iPhone setup, and renewals.
- [Mobile UI foundations](reference/mobile-ui-foundations.md) - mobile design
  audit, component-library direction, density rules, and rollout order.
- [Schema map](database/schema-map.md) - active Convex tables grouped by domain.

## Current Stack

| Area                 | Current source of truth                                  |
| -------------------- | -------------------------------------------------------- |
| Web app              | `apps/web/src`                                           |
| Backend functions    | `apps/convex/src`                                        |
| Data model           | `apps/convex/src/schema.ts`                              |
| Auth                 | Better Auth component under `apps/convex/src/betterAuth` |
| Generated Convex API | `apps/convex/src/_generated`                             |
| Seed/reset           | Internal Convex function `bootstrap:resetAndSeed`        |

## Architecture

- [Overview](architecture/overview.md)
- [Data flow](architecture/data-flow.md)
- [Deployment](architecture/deployment.md)
- [Azure portability review](architecture/azure-portability.md)
- [Client state ownership](architecture/client-state-ownership.md)

## Backend

- [Convex overview](backend/convex-overview.md)
- [Convex local and production runtime](backend/convex-local-production.md)
- [Auth and roles](backend/auth-and-roles.md)
- [Storage and uploads](backend/storage-and-uploads.md)
- [Seed and reset](backend/seed-and-reset.md)

### Reference

- [[getting-started]] — New machine setup and local dev environment
- [[deployment-options]] — Production hosting (Next.js + Convex Cloud)
- [[roles-and-permissions]] — All 8 user roles and what they can do
- [[environment]] — Every environment variable explained
- [[commands]] — All dev commands and what they do

## Database

- [Schema map](database/schema-map.md)
- [Indexes and search](database/indexes-and-search.md)
- [Data evolution](database/data-evolution.md)

## Frontend

- [Frontend overview](frontend/frontend-overview.md)
- [Components and hooks](frontend/components.md)
- [Authentication](frontend/frontend-auth.md)
- [Routing](frontend/routing.md)
- [Styling](frontend/styling.md)
- [Brand assets](frontend/branding.md)

## Features

- [Announcements](features/announcements.md)
- [Audit log](features/audit-log.md)
- [Calendar](features/calendar.md)
- [Clubs](features/clubs.md)
- [Courses](features/courses.md)
- [Events](features/events.md)
- [Flex Friday](features/flex-friday.md)
- [Moderation](features/moderation.md)
- [Notifications](features/notifications.md)
- [Schedule](features/schedule.md)
- [Uploads](features/uploads.md)
- [Users and admin](features/users-admin.md)
- [Wrapped](features/wrapped.md)

## Product Reference

- [IA FAQ](reference/ia-faq.md) - school context used by product copy and seed
  data decisions. Verify policy-sensitive details with school staff before
  treating them as final.

## Historical Notes

[PORTING.md](../PORTING.md) is historical migration context. It is useful for
understanding why the app moved from the old backend shape to Convex, but it is
not the current operating manual.
