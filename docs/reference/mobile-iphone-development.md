---
tags: [mobile, ios, expo, development]
---

# iPhone Mobile Development

The mobile app has one codebase and two ways to run it.

| Use case | Command | Opens |
| --- | --- | --- |
| Quick, basic testing | `bun run dev:mobile` | Expo Go |
| Normal iPhone development | `bun run --filter mobile dev:client` | The installed Innovation Academy development app |

Prefer the installed development app on iPhone. It includes this project's
native configuration and libraries, while still loading JavaScript changes
wirelessly from Metro. Expo Go is useful only for compatible, basic checks.

## First iPhone setup

This setup requires a Mac with Xcode and the phone connected by cable.

1. Set up the repository and install dependencies as described in
   [Developer setup](getting-started.md).
2. On the phone, enable **Developer Mode** in **Settings > Privacy & Security**,
   restart if asked, then unlock the phone and trust the Mac.
3. In Xcode, open **Settings > Accounts** and sign in with the developer's
   Apple Account. A free account appears as a Personal Team.
4. From a shell with `direnv` active, create the iOS project. Each Personal Team
   needs its own unique bundle identifier:

   ```bash
   zsh -c '
     xcode_developer_directory="${DEVELOPER_DIR:-}"
     if [[ ! -d "$xcode_developer_directory/Platforms/iPhoneOS.platform" ]]; then
       xcode_developer_directory="$(env -u DEVELOPER_DIR /usr/bin/xcode-select -p)"
     fi
     unset AR AS CC CXX LD LDPLUSPLUS LIBTOOL NM RANLIB STRIP
     unset CFLAGS CXXFLAGS CPPFLAGS LDFLAGS SDKROOT MACOSX_DEPLOYMENT_TARGET
     unset TOOLCHAINS DEVELOPER_DIR
     export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
     export DEVELOPER_DIR="$xcode_developer_directory"
     export EXPO_IOS_PERSONAL_TEAM=1
     export IOS_BUNDLE_IDENTIFIER=is.yourname.innovationacademy.dev

     bun run --cwd apps/mobile expo prebuild --platform ios --clean --no-install
     cd apps/mobile/ios
     pod install
     open InnovationAcademy.xcworkspace
   '
   ```

5. In Xcode, select the **InnovationAcademy** target. Under
   **Signing & Capabilities**, enable **Automatically manage signing** and select
   the developer's Personal Team.
6. Select the connected iPhone as the run destination and press **Run**
   (`Command-R`). This installs the Innovation Academy development app.

## Daily development

Start Convex too when working against a local development backend:

```bash
bun run --filter cvx dev
```

Start Metro for the installed development app:

```bash
bun run --filter mobile dev:client
```

Use this instead when the phone is not on the Mac's Wi-Fi:

```bash
bun run --filter mobile dev:client:tunnel
```

Open the installed **Innovation Academy** app, not Expo Go.

### After switching branches or updating dependencies

If the app suddenly reports bundling, import, or route errors after a branch or
dependency change, stop Metro and restart it with a cleared cache before
debugging the individual errors:

```nu
bun run --filter mobile dev:client:clear
```

Reopen the installed app afterward. If the change also affected native
dependencies or app configuration, rebuild and reinstall the development app.

## Reinstalling the app

With a free Apple Personal Team, the installed app expires after about seven
days. After the first-time setup, connect and unlock one iPhone, then renew it:

```bash
bun run mobile:ios:refresh
```

The command only proceeds when Xcode can see one paired physical iOS device. It
stops when it finds zero or multiple devices; disconnect the others, or select
one explicitly with `bun run mobile:ios:refresh -- "<iPhone UDID>"`. It asks Xcode
to renew the provisioning profile, rebuilds the app, and installs it on the
connected phone. It also selects the only Apple development team registered in
Xcode, overriding a stale school team left by prebuild. When more than one
development team is available, select one from Nushell with:

```nu
with-env { IOS_APPLE_TEAM_ID: "YOUR_TEAM_ID" } {
  bun run mobile:ios:refresh
}
```

Build output is quiet by default while warnings and errors remain visible; add
`--verbose` for the complete Xcode log. The phone must already be trusted and
the Apple Account must already be signed in to Xcode. Re-run prebuild and
CocoaPods only after a native dependency or app-configuration change, or when
starting from a fresh clone.

A paid Apple Developer team or TestFlight avoids the weekly Personal Team
expiration. Personal Team builds do not include the paid-team push-notification
or Associated Domains capabilities.
