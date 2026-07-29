#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: pnpm mobile:ios:refresh [iPhone UDID]

Rebuilds and installs the existing Personal Team iOS development build. Run the
one-time iPhone setup first so Xcode has the Apple Account, Personal Team,
bundle identifier, and trusted device configured.

Without an argument, the command uses the only paired physical iOS device that
Xcode can see. It stops if zero or multiple devices are available.
EOF
}

if [[ $# -gt 1 ]]; then
  usage >&2
  exit 64
fi

device_udid="${1:-}"
repo_root="$(cd "$(dirname "$0")/.." && pwd)"
ios_directory="$repo_root/apps/mobile/ios"
workspace="$ios_directory/InnovationAcademy.xcworkspace"

# The Nix development shell provides macOS compilers for non-iOS tooling. Do
# not let those variables override the full Xcode iPhone toolchain.
unset CC CXX CFLAGS CXXFLAGS CPPFLAGS LDFLAGS SDKROOT MACOSX_DEPLOYMENT_TARGET DEVELOPER_DIR
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
if ! xcode_developer_directory="$(/usr/bin/xcode-select -p)"; then
  echo "Select a full Xcode installation before refreshing an iPhone build." >&2
  exit 1
fi
export DEVELOPER_DIR="$xcode_developer_directory"

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

temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/innovation-academy-ios.XXXXXX")"
cleanup() {
  rm -rf "$temporary_directory"
}
trap cleanup EXIT

if [[ -z "$device_udid" ]]; then
  device_report="$temporary_directory/devices.json"
  xcrun devicectl list devices --json-output "$device_report" >/dev/null

  if ! device_udid="$(node - "$device_report" <<'NODE'
const { readFileSync } = require('node:fs');

const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const devices = (report.result?.devices ?? []).filter(
  (device) =>
    device.hardwareProperties?.platform === 'iOS' &&
    device.hardwareProperties?.reality === 'physical' &&
    device.connectionProperties?.pairingState === 'paired' &&
    typeof device.hardwareProperties?.udid === 'string',
);

if (devices.length === 0) {
  console.error(
    'No paired physical iPhone or iPad is available. Connect and unlock one device, then retry.',
  );
  process.exit(1);
}

if (devices.length > 1) {
  console.error('Multiple paired physical iOS devices are available:');
  for (const device of devices) {
    console.error(`  ${device.deviceProperties?.name ?? 'Unnamed device'} — ${device.hardwareProperties.udid}`);
  }
  console.error('Disconnect the other devices, or run this command with the intended UDID.');
  process.exit(1);
}

process.stdout.write(devices[0].hardwareProperties.udid);
NODE
  )"; then
    exit 1
  fi
fi

derived_data="$temporary_directory/DerivedData"

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
