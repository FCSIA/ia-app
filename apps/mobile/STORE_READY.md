# Mobile Store Readiness

Repo-local v1 readiness is implemented in this workspace. The remaining steps
need school-controlled accounts, store consoles, or physical devices.

## Required External Values

Set these for EAS build profiles or CI secrets:

```env
EXPO_ACCOUNT_OWNER=<school-or-eas-account>
EAS_PROJECT_ID=<uuid-from-eas-init>
IOS_BUNDLE_IDENTIFIER=org.fcsia.app
IOS_BUILD_NUMBER=1
ANDROID_PACKAGE=org.fcsia.app
ANDROID_VERSION_CODE=1
EXPO_PUBLIC_UNIVERSAL_LINK_HOST=app.innovationacademy.fcsia.org
EXPO_PUBLIC_APP_SCHEME=ia-app
EXPO_PUBLIC_CONVEX_URL=https://<deployment>.convex.cloud
EXPO_PUBLIC_CONVEX_SITE_URL=https://<deployment>.convex.site
```

`EAS_PROJECT_ID` is intentionally not committed. Run `eas init` under the
school-owned Expo account, then set the value in EAS environments.

## Store Console Steps

- Apple Developer Program: enroll the school/organization account and create
  the `org.fcsia.app` bundle id.
- Google Play Console: create the `org.fcsia.app` app entry.
- Configure universal links for `app.innovationacademy.fcsia.org` using Apple
  AASA and Android asset links once the production host is owned.
- Create a non-production reviewer deployment with seeded reviewer accounts.
- Fill privacy disclosures for identifiers, messages, schedules, push tokens,
  diagnostics, and user-generated club chat.
- Use Teen/12+ age posture unless district policy requires stricter handling.
- Export compliance: standard HTTPS-only encryption, no non-exempt crypto.

## Physical Device Validation

Run on at least:

- iPhone SE-class small screen
- Current iPhone with notch/Dynamic Island
- Pixel a-series or comparable mid-tier Android
- Low-memory Android device

Validation commands:

```bash
pnpm --filter cvx codegen
pnpm --filter cvx typecheck
pnpm --filter cvx test
pnpm --filter mobile typecheck
pnpm lint
pnpm build
pnpm --filter mobile test:maestro
```

Native push requires real iOS/Android devices and an EAS project id. Confirm:

- login registers an already-authorized push token silently,
- Notifications screen permission prompt registers a token,
- logout unregisters the stored token,
- Convex `notifications.pushExpo.sendTestToMe` reaches both platforms,
- tapping a notification opens the matching app route.
