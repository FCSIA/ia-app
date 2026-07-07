# IA Mobile App

Native Expo app for Innovation Academy students, teachers, sponsors, and staff.
It talks directly to the shared Convex backend and uses Better Auth sessions
stored in `expo-secure-store`.

## Local Setup

```bash
pnpm install
pnpm --filter cvx dev
pnpm dev:mobile
```

Set these values before launching a dev build:

```env
EXPO_PUBLIC_APP_SCHEME=ia-app
EXPO_PUBLIC_CONVEX_URL=https://your-dev-deployment.convex.cloud
EXPO_PUBLIC_CONVEX_SITE_URL=https://your-dev-deployment.convex.site
```

Store/EAS values such as `EAS_PROJECT_ID`, Apple bundle ownership, Google Play
app ownership, and universal-link domain verification are external account
values. See [STORE_READY.md](./STORE_READY.md).

The Convex auth server trusts `ia-app://` and Expo development origins. Mobile
sign-in uses the same school unique ID and password flow as the web app.

## Navigation

- Bottom tabs: Dashboard, Announcements, Clubs, Schedule, Inbox, More.
- Announcements use list/detail/comment routes.
- Clubs use a Discord-style stack: club detail, channel list, channel messages.
- More links to Events, Flex Friday, Profile, Theme, and the design-system
  gallery.

## Push Notifications

The app registers Expo push tokens through
`api.notifications.pushExpo.registerToken`. Convex fans out native push delivery
alongside the existing web-push delivery path.

The app does not blind-prompt for notifications on login. It silently refreshes
an existing permission and exposes the first permission prompt from the Inbox
screen. Notification taps route through Expo Router and map existing backend
`href` values into mobile routes.

EAS profiles live in `eas.json`; release builds should use EAS Build/Submit and
production Convex environment variables.

## Verification

```bash
pnpm --filter mobile typecheck
pnpm --filter mobile test:maestro
```

Maestro flows live in `apps/mobile/maestro` and require a built simulator/device
app plus `MAESTRO_IA_USERNAME` / `MAESTRO_IA_PASSWORD`.
