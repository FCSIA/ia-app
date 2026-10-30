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

## Apple Personal Team Development

Set `EXPO_IOS_PERSONAL_TEAM=1` only for local physical-iPhone builds signed by a
free Apple Personal Team. Also set a developer-specific
`IOS_BUNDLE_IDENTIFIER`; do not register or sign the school-owned
`org.fcsia.app` on a personal team.

Personal mode removes the Push Notifications and Associated Domains
entitlements during iOS prebuild. It does not change Android configuration or
normal school/EAS builds. Use it to validate the rest of the native iPhone app,
then repeat APNs, universal-link, TestFlight, and store validation with the
school's paid Apple Developer team.

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
bun run --filter cvx codegen
bun run --filter cvx typecheck
bun run --filter cvx test
bun run --filter mobile typecheck
bun run lint
bun run build
```

UI checks are performed manually on built device apps; Maestro flows were
removed. Native push requires a supported iOS/Android target, an EAS project id, and the
platform credentials. Confirm:

- login registers an already-authorized push token silently,
- Notifications screen permission prompt registers a token,
- the Inbox lists the registered device and can queue the built-in test push,
- logout unregisters the stored token,
- Convex `notifications.pushExpo.sendTestToMe` reaches both platforms,
- tapping a notification opens the matching app route.
