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

`pnpm dev:mobile` starts Expo in Expo Go mode for quick iPhone and Android
emulator testing. Use `pnpm --filter mobile dev:client` only after installing a
development build.

Expo Go can test auth, Convex data, navigation, uploads, and the main screens.
Native push notifications are disabled in Expo Go on SDK 53+ and require a
development build.

For Expo Go on a physical iPhone or Android emulator against the same local
Convex backend as the web app, sync mobile env for the device you are testing:

```powershell
# Android Studio emulator
pnpm sync:convex-env -- --android

# Physical iPhone on the same Wi-Fi as the laptop
pnpm sync:convex-env -- --host "<your Wi-Fi IPv4>"

pnpm --filter cvx dev
pnpm dev:mobile
```

Use the current Wi-Fi IPv4 address for the iPhone command if it changes. The
script keeps web on `127.0.0.1` and writes the mobile-specific URLs to
`apps/mobile/.env.local`. Android emulators use `10.0.2.2` to reach the Windows
host loopback.

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
`href` values into mobile routes. The Inbox also lists registered native push
devices and can queue a test push through the Convex Expo push action for
physical-device validation.

EAS profiles live in `eas.json`; release builds should use EAS Build/Submit and
production Convex environment variables.

## Verification

```bash
pnpm --filter mobile typecheck
pnpm --filter mobile test:maestro
```

Maestro flows live in `apps/mobile/maestro` and require a built simulator/device
app plus `MAESTRO_IA_USERNAME` / `MAESTRO_IA_PASSWORD`.
