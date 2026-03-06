# Current Focus

## Status: Initial implementation complete ✅

The core platform has been fully built and is ready for local development.

## To Start the App

```bash
# 1. Start PostgreSQL + Redis
pnpm infra:up

# 2. Run database migrations
pnpm db:migrate

# 3. Seed with demo data
pnpm db:seed

# 4. Start all dev servers (API + Web)
pnpm dev
```

- API: http://localhost:3001
- Web: http://localhost:3000
- API Docs (Swagger): http://localhost:3001/docs

## Seed Accounts
| uniqueId | Password | Role |
|----------|----------|------|
| SUPER001 | SUPER001 | SUPER_ADMIN |
| ADMIN001 | ADMIN001 | ADMIN |
| TCH001   | TCH001   | TEACHER |
| STU001   | STU001   | STUDENT |
| STU002   | STU002   | STUDENT |
| STU003   | STU003   | STUDENT_LEADER |
| STU004   | STU004   | STUDENT_ADMIN |

## Mobile (Expo)
```bash
cd apps/mobile
npx expo start
```
The mobile app now targets Expo SDK 54, so the current Expo Go app on iPhone is supported again.
Use `apps/mobile/.env` or set `EXPO_PUBLIC_API_URL` to your machine's LAN IP when testing on a physical device.
Scan QR with Expo Go app on device, or press `a` for Android emulator.

## Potential Next Priorities
- Add automated tests (Jest + supertest for API, Playwright for web)
- Wire up Redis for session caching
- Add rate limiting (throttler guard in NestJS)
- Add email notifications (Nodemailer + free SMTP)
- Production Docker Compose with Nginx reverse proxy
- CI/CD pipeline (GitHub Actions)
