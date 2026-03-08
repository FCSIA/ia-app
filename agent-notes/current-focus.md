# Current Focus

## Status

Core implementation is complete. The main remaining work is validation, hardening, and deployment-readiness rather than large feature build-out.

## Now

- Local development should be treated as the default execution path.
- New work should start from targeted verification and then move into hardening or missing infrastructure.
- For broader product or architecture questions, use `context.md` and `decisions.md` instead of expanding this file.

## Next

- Add automated tests for API and web critical paths.
- Add rate limiting and other basic API hardening.
- Decide whether Redis should remain provisioned-only or be wired into sessions/caching.
- Add CI checks for lint, build, and targeted test coverage.
- Define a lightweight production deployment path after local verification is stable.

## Blockers

- No known blocker for local development.
- Local startup still depends on PostgreSQL 16 being available through the existing project scripts.
- Some future items in the repo assume Redis exists, but Redis is not yet part of the active runtime path.

## Verify

Run the local stack:

```bash
pnpm infra:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Primary endpoints:

- Web: http://localhost:3000
- API: http://localhost:3001
- Swagger: http://localhost:3001/docs

Seed accounts:

| uniqueId | Password | Role |
|----------|----------|------|
| SUPER001 | SUPER001 | SUPER_ADMIN |
| ADMIN001 | ADMIN001 | ADMIN |
| TCH001   | TCH001   | TEACHER |
| STU001   | STU001   | STUDENT |
| STU002   | STU002   | STUDENT |
| STU003   | STU003   | STUDENT_LEADER |
| STU004   | STU004   | STUDENT_ADMIN |

Mobile:

```bash
cd apps/mobile
npx expo start
```

When testing on a physical device, set `EXPO_PUBLIC_API_URL` in `apps/mobile/.env` to the machine's LAN IP.
