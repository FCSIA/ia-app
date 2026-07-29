---
tags: [mobile, ios, expo, development]
---

# iPhone Mobile Development

The mobile app has one codebase and two ways to run it.

| Use case | Command | Opens |
| --- | --- | --- |
| Quick, basic testing | `pnpm dev:mobile` | Expo Go |
| Normal iPhone development | `pnpm --filter mobile dev:client` | The installed Innovation Academy development app |

Prefer the installed development app on iPhone. It includes this project's
native configuration and libraries, while still loading JavaScript changes
wirelessly from Metro. Expo Go is useful only for compatible, basic checks.

## First iPhone setup

This setup requires a Mac with Xcode and the phone connected by cable.

1. Set up the repository and install dependencies as described in
   [Developer setup](../../SETUP.md).
2. On the phone, enable **Developer Mode** in **Settings > Privacy & Security**,
   restart if asked, then unlock the phone and trust the Mac.
3. In Xcode, open **Settings > Accounts** and sign in with the developer's
   Apple Account. A free account appears as a Personal Team.
4. From a shell with `direnv` active, create the iOS project. Each Personal Team
   needs its own unique bundle identifier:

   ```bash
   zsh -c '
     export PATH="/usr/bin:$PATH"
     export EXPO_IOS_PERSONAL_TEAM=1
     export IOS_BUNDLE_IDENTIFIER=is.yourname.innovationacademy.dev

     pnpm --filter mobile exec expo prebuild --platform ios --clean --no-install
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
pnpm --filter cvx dev
```

Start Metro for the installed development app:

```bash
pnpm --filter mobile dev:client
```

Use this instead when the phone is not on the Mac's Wi-Fi:

```bash
pnpm --filter mobile dev:client:tunnel
```

Open the installed **Innovation Academy** app, not Expo Go.

## Reinstalling the app

With a free Apple Personal Team, the installed app expires after about seven
days. To renew it, connect the phone, open
`apps/mobile/ios/InnovationAcademy.xcworkspace` in Xcode, select the phone, and
press **Run** again. Re-run prebuild and CocoaPods only after a native
dependency or app-configuration change, or when starting from a fresh clone.

A paid Apple Developer team or TestFlight avoids the weekly Personal Team
expiration. Personal Team builds do not include the paid-team push-notification
or Associated Domains capabilities.
