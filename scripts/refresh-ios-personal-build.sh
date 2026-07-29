#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: pnpm mobile:ios:refresh -- <iPhone UDID>

Rebuilds and installs the existing Personal Team iOS development build. Run the
one-time iPhone setup first so Xcode has the Apple Account, Personal Team,
bundle identifier, and trusted device configured.

Find a connected phone's UDID with:
  xcrun devicectl list devices
EOF
}

if [[ $# -ne 1 ]]; then
  usage >&2
  exit 64
fi

device_udid="$1"
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
ios_directory="$repo_root/apps/mobile/ios"
workspace="$ios_directory/InnovationAcademy.xcworkspace"

if [[ ! -d "$workspace" ]]; then
  echo "Missing $workspace." >&2
  echo "Complete the first-time iPhone setup before running this command." >&2
  exit 1
fi

if ! xcodebuild -version >/dev/null 2>&1; then
  echo "Xcode is required to refresh an iPhone development build." >&2
  exit 1
fi

if ! xcrun devicectl --version >/dev/null 2>&1; then
  echo "Xcode's devicectl is required to install the refreshed app." >&2
  exit 1
fi

derived_data="$(mktemp -d "${TMPDIR:-/tmp}/innovation-academy-ios.XXXXXX")"
cleanup() {
  rm -rf "$derived_data"
}
trap cleanup EXIT

echo "Renewing provisioning and building Innovation Academy for $device_udid..."
(
  cd "$ios_directory"
  xcodebuild \
    -workspace "InnovationAcademy.xcworkspace" \
    -scheme "InnovationAcademy" \
    -configuration Debug \
    -destination "platform=iOS,id=$device_udid" \
    -derivedDataPath "$derived_data" \
    -allowProvisioningUpdates \
    -allowProvisioningDeviceRegistration \
    build
)

app_path="$derived_data/Build/Products/Debug-iphoneos/InnovationAcademy.app"
if [[ ! -d "$app_path" ]]; then
  echo "Xcode completed without producing $app_path." >&2
  exit 1
fi

echo "Installing the refreshed app..."
xcrun devicectl device install app --device "$device_udid" "$app_path"

echo "Done. Start Metro with: pnpm --filter mobile dev:client"
