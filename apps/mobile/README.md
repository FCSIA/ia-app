# IA Mobile App

Native Expo app for Innovation Academy students, teachers, sponsors, and staff.
It talks directly to the shared Convex backend and uses Better Auth sessions
stored in `expo-secure-store`.

## Local Setup

```bash
bun install
bun run --filter cvx dev
bun run dev:mobile
```

`bun run dev:mobile` starts Expo in Expo Go mode for compatible simulators and
Android devices. Use `bun run --filter mobile dev:client` after installing a
development build. A physical iPhone whose App Store Expo Go does not support
this project's SDK must use a development build.

Expo Go can test auth, Convex data, navigation, uploads, and the main screens.
Native push notifications are disabled in Expo Go on SDK 53+ and require a
development build.

For a development build on a physical iPhone or Expo Go on an Android emulator
against the same Convex backend as the web app, sync mobile env for the device
you are testing:

```powershell
# Android Studio emulator
bun run sync:convex-env -- --android

# Physical iPhone on the same Wi-Fi as the laptop
bun run sync:convex-env -- --host "<your Wi-Fi IPv4>"

bun run --filter cvx dev
bun run dev:mobile
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

### Personal Team iPhone build

Apple Personal Teams cannot sign the Push Notifications or Associated Domains
entitlements used by the school release. The opt-in personal build mode removes
only those iOS entitlements, leaves Android and ordinary school/EAS builds
unchanged, and reports remote push as unavailable in the app.

Use a developer-specific bundle identifier rather than the school-owned
`org.fcsia.app`. For example, from the repository root:

```bash
zsh -c '
  xcode_developer_directory="${DEVELOPER_DIR:-}"
  if [[ ! -d "$xcode_developer_directory/Platforms/iPhoneOS.platform" ]]; then
    xcode_developer_directory="$(env -u DEVELOPER_DIR /usr/bin/xcode-select -p)"
  fi
  unset CC CXX CFLAGS CXXFLAGS CPPFLAGS LDFLAGS SDKROOT MACOSX_DEPLOYMENT_TARGET DEVELOPER_DIR
  export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
  export DEVELOPER_DIR="$xcode_developer_directory"
  export EXPO_IOS_PERSONAL_TEAM=1
  export IOS_BUNDLE_IDENTIFIER=is.sreyas.innovationacademy.dev

bun run --filter mobile exec expo prebuild --platform ios --clean --no-install
  cd apps/mobile/ios
  pod install
  open InnovationAcademy.xcworkspace
'
```

In Xcode, enable **Automatically manage signing** for the
**InnovationAcademy** target, select the Personal Team and connected phone, then
press **Run**. The `/usr/bin` prefix makes Expo's precompiled-module inspection
use macOS BSD tar instead of GNU tar from the Nix CocoaPods closure. The
environment cleanup works in ordinary macOS shells and prevents environment
managers or CI tooling from overriding Xcode's compiler and iPhone SDK. After
the app is installed, restart Metro with
`bun run --filter mobile dev:client`; a native rebuild is only needed after a
native dependency or app-config change.

### Renewing a Personal Team build

After the one-time setup, connect and unlock one iPhone, then run:

```bash
bun run mobile:ios:refresh
```

The command finds the only paired physical iOS device that Xcode can see, then
asks Xcode to renew the provisioning profile, rebuilds the app, and installs it
on the phone. Xcode output is quiet by default while warnings and errors remain
visible. Pass `--verbose` to restore the complete build log. The command stops
if there are zero or multiple devices. In the latter case, either disconnect
the other device or select one explicitly:

```bash
bun run mobile:ios:refresh -- "<iPhone UDID>"
```

The phone must already be trusted, and the Apple Account must already be signed
in to Xcode. Those first-time authorization steps cannot be automated.

### Remote device development

An installed development build can load JavaScript updates while the phone is
unplugged. For a phone that is not on the Mac's network, keep the Mac awake and
online, then start Metro through Expo's development-client tunnel:

```bash
bun run dev:mobile:tunnel
```

Open the printed QR code or `exp+innovation-academy://` URL on the phone. The
link opens the installed InnovationAcademy development build, not Expo Go. Both
devices need internet access, and the tunnel is available only while the Metro
process remains running. Reconnect and rebuild the native app after changing a
native dependency, entitlement, config plugin, app icon, or native project
source.

This build can validate the app on a real iPhone but cannot validate APNs token
registration, remote iOS delivery, or universal links. Keep those checks for a
development build signed by the school Apple Developer team. Android push
configuration is unaffected.

## Navigation

- Bottom tabs: Home, Calendar, Posts, Clubs, Classes, More.
- Dashboard includes the same practical student widgets as web: schedule,
  quick actions, unread announcements, clubs, upcoming events, calendar,
  Flex Friday, and fun fact, with saved widget layout.
- Announcements use feed, read/save state, detail, comments, and attachments.
- Clubs include discovery, join/request states, club detail, member people
  tools, tags, and channel message surfaces with replies, reactions, pins,
  polls, edit/delete, and reports where the current user's role allows them.
- Classes includes schedule viewing, visibility, edit/save, friend search,
  friend requests, and shared friend schedule access.
- More links to Inbox, Courses, Events, Flex Friday, Flex Pass, Wrapped,
  Profile, Theme, and the design-system gallery.
- Courses include catalog search, pathway/grade/department filters, and course
  detail pages.
- Calendar includes school, district, club, Flex Friday, and personal entries;
  students can create and remove their own personal entries.
- Events include search, event detail/reporting, and role-gated creation or
  cancellation where the web app allows it.
- Profile includes avatar upload/removal, password change, account support
  guidance, and logout.

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
bun run --filter mobile typecheck
bun run --filter mobile test:maestro
```

Maestro flows live in `apps/mobile/maestro` and require a built simulator/device
app plus `MAESTRO_IA_USERNAME` / `MAESTRO_IA_PASSWORD`.
