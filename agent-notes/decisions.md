# Architecture Decisions

## Monorepo
- **Tool**: pnpm workspaces + Turborepo
- **Structure**: `apps/api`, `apps/web`, `apps/mobile`
- **Rationale**: Shared lockfile, parallel builds via Turborepo pipelines

## Backend
- **Framework**: NestJS 10 (TypeScript, decorator-based)
- **ORM**: Prisma 6 with PostgreSQL 16
- **Auth**: passport-jwt, global JwtAuthGuard + RolesGuard; IS_PUBLIC_KEY metadata for public routes
- **Global Modules**: PrismaModule, AuditModule, ModerationModule, NotificationsModule — exported globally to avoid circular imports
- **File Uploads**: Multer disk storage, local `./uploads/`, 5MB limit (free, no cloud deps)
- **CSV Import**: csv-parser streaming, default password = uniqueId, skips duplicates

## Web Frontend
- **Framework**: Next.js 15 (App Router, React 19)
- **Styling**: Tailwind CSS with custom `primary` palette + utility classes in globals.css
- **Data fetching**: TanStack Query v5 + Axios
- **PWA**: Manual manifest.json + sw.js (no paid plugin needed)
- **Auth storage**: localStorage (ia_token + ia_user)

## Mobile
- **Framework**: Expo SDK 54, Expo Router v6 (file-based routing)
- **Auth storage**: expo-secure-store (more secure than AsyncStorage)
- **Data fetching**: TanStack Query v5 + Axios

## Infrastructure
- **Docker Compose**: PostgreSQL 16-alpine + Redis 7-alpine, named volumes
- **Redis**: Provisioned but not yet wired (reserved for future caching/pub-sub)

## Feature Decisions
- **Archive expired announcements**: Eager check on every GET /announcements (avoids scheduler dep)
- **Notification fanout**: At write time in service layer (synchronous, avoids queue dep)
- **Event approval**: Multi-sponsor, all must approve; publishes only when all in
- **Club membership guard**: `getOne()` club checks membership before returning data
- **No 1:1 DMs**: Intentionally excluded per spec
- **No parent accounts**: Intentionally excluded per spec
