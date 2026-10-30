---
tags: [mobile, ios, expo, development]
---

# iPhone Mobile Development

The mobile app uses an installed Expo development build and Metro.

| Use case | Command | Opens |
| --- | --- | --- |
| iOS simulator | `bun run dev:mobile -- ios` | Local Convex and Metro |
| Android emulator | `bun run dev:mobile -- android` | Local Convex and Metro with emulator-reachable URLs |
| Physical phone on Wi-Fi | `bun run dev:mobile -- phone` | Local Convex and Metro using the Mac's Wi-Fi address |
| Metro only, with Convex already running | `bun run --filter mobile dev:client` | Metro for the installed development app |

Prefer the installed development app on iPhone. It includes this project's
native configuration and libraries, while still loading JavaScript changes
wirelessly from Metro. Expo Go is useful only for compatible, basic checks.

The daily command requires this checkout's isolated local backend. On a fresh
checkout, run `bun run setup:convex-local`. If Convex reports that no project is
configured, first run `bun run --cwd apps/convex convex deployment create
<team>:<project>:local --select`, then rerun setup. Do not copy another
checkout's backend environment or local state. New local backends start empty;
follow [Seed and reset](../backend/seed-and-reset.md) only when intentionally
initializing disposable demo data.

Prefix project commands with `direnv exec .` when the shell has not loaded
direnv automatically. The daily command starts the development server; it
does not compile or launch the native binary.

When stopping, Expo can consume the first `Ctrl+C`. Press `Ctrl+C` again if
Convex is still running before restarting the daily command.

## Simulator and Android setup

For iOS, install Xcode and an iOS Simulator runtime. Build and install the
development app with `bun run mobile:ios`. The root native commands remove
Nix compiler flags and select Apple's toolchain before invoking Expo.

For Android, this app's React Native version uses JDK 17, Android platform 36,
build-tools 35.0.0 and 36.0.0, NDK 27.1.12297006, and CMake 3.22.1. Install the Android
command-line tools, platform-tools, emulator, and one host-compatible Google
APIs system image as well. On Apple Silicon, use `arm64-v8a`.

This machine manages those packages in `~/config/pkgs/mobile-development.nix`
and `~/config/home/mobile-development.nix`. Home Manager exposes the SDK at
`~/Library/Android/sdk`, sets `ANDROID_HOME` and `JAVA_HOME`, and adds the native
tools to PATH. Apply the Home Manager configuration and start a fresh shell
after changing it. Android Studio is optional when Nix manages these tools.

Create an Android virtual device once:

```bash
avdmanager create avd --name IA_Pixel_API_36 \
  --package 'system-images;android-36;google_apis;arm64-v8a' --device pixel_8a
```

Open the simulator/emulator from the development environment's Device panel.
Build and install Android with `bun run mobile:android`. Reuse the installed
binary for JavaScript edits; rebuild after native dependency or config changes.

UI behavior is reviewed manually on devices. Automated UI suites and Maestro
flows have been removed; backend, security, data-processing, and tooling tests
remain. `bun run --filter mobile typecheck` checks TypeScript only and does
not establish that a native binary builds or runs.

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

Start the backend and Metro together for the iOS simulator:

```bash
bun run dev:mobile -- ios
```

For a physical iPhone on the same Wi-Fi:

```bash
bun run dev:mobile -- phone
```

When a reachable backend is already running, Metro alone can use a tunnel:

```bash
bun run --filter mobile dev:client:tunnel
```

The tunnel exposes Metro only; it does not expose a loopback Convex backend.
Open the installed **Innovation Academy** app.

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
