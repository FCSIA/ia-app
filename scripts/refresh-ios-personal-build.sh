#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'EOF'
Usage: bun run mobile:ios:refresh [--verbose] [iPhone UDID]

Rebuilds and installs the existing Personal Team iOS development build. Run the
one-time iPhone setup first so Xcode has the Apple Account, Personal Team,
bundle identifier, and trusted device configured.

Without an argument, the command uses the only paired physical iOS device that
Xcode can see. It stops if zero or multiple devices are available. Build output
is quiet by default; pass --verbose to show the complete Xcode log.
EOF
}

device_udid=""
verbose_build=0
for argument in "$@"; do
  case "$argument" in
    --verbose)
      verbose_build=1
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*)
      echo "Unknown option: $argument" >&2
      usage >&2
      exit 64
      ;;
    *)
      if [[ -n "$device_udid" ]]; then
        usage >&2
        exit 64
      fi
      device_udid="$argument"
      ;;
  esac
done

repo_root="$(cd "$(dirname "$0")/.." && pwd)"
ios_directory="$repo_root/apps/mobile/ios"
workspace="$ios_directory/InnovationAcademy.xcworkspace"

# Shell managers and CI environments may provide compilers that are correct for
# macOS tooling but not for an iPhone build. Preserve an explicitly selected
# full Xcode installation; otherwise use the system selection from xcode-select.
configured_developer_directory="${DEVELOPER_DIR:-}"
unset \
  AR \
  AS \
  CC \
  CXX \
  LD \
  LDPLUSPLUS \
  LIBTOOL \
  NM \
  RANLIB \
  STRIP \
  CFLAGS \
  CXXFLAGS \
  CPPFLAGS \
  LDFLAGS \
  SDKROOT \
  MACOSX_DEPLOYMENT_TARGET \
  TOOLCHAINS \
  DEVELOPER_DIR
export PATH="/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

is_full_xcode_directory() {
  [[ -d "$1/Platforms/iPhoneOS.platform" ]] &&
    [[ -d "$1/Toolchains/XcodeDefault.xctoolchain" ]]
}

if is_full_xcode_directory "$configured_developer_directory"; then
  xcode_developer_directory="$configured_developer_directory"
elif xcode_developer_directory="$(/usr/bin/xcode-select -p 2>/dev/null)" &&
  is_full_xcode_directory "$xcode_developer_directory"; then
  :
else
  echo "A full Xcode installation with the iPhoneOS SDK is required." >&2
  echo "Select it with: sudo xcode-select -s /Applications/Xcode.app" >&2
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

apple_team_id="${IOS_APPLE_TEAM_ID:-}"
if [[ -z "$apple_team_id" ]]; then
  apple_team_ids="$(
    /usr/bin/defaults read com.apple.dt.Xcode IDEProvisioningTeamByIdentifier 2>/dev/null |
      /usr/bin/sed -nE 's/^[[:space:]]*teamID = ([A-Z0-9]{10});/\1/p' |
      /usr/bin/sort -u
  )"
  apple_team_count="$(
    printf '%s\n' "$apple_team_ids" |
      /usr/bin/awk 'NF { count++ } END { print count + 0 }'
  )"

  if [[ "$apple_team_count" -eq 0 ]]; then
    echo "No Apple development team is registered with Xcode." >&2
    echo "Sign in under Xcode Settings > Accounts, then retry." >&2
    exit 1
  fi

  if [[ "$apple_team_count" -gt 1 ]]; then
    echo "Multiple Apple development teams are registered with Xcode:" >&2
    printf '%s\n' "$apple_team_ids" | /usr/bin/sed 's/^/  /' >&2
    echo "Select one with IOS_APPLE_TEAM_ID, then retry." >&2
    exit 1
  fi

  apple_team_id="$apple_team_ids"
fi

export EXPO_IOS_PERSONAL_TEAM=1
export IOS_APPLE_TEAM_ID="$apple_team_id"

temporary_directory="$(mktemp -d "${TMPDIR:-/tmp}/innovation-academy-ios.XXXXXX")"
cleanup() {
  rm -rf "$temporary_directory"
}
trap cleanup EXIT

build_settings_report="$temporary_directory/build-settings.json"
(
  cd "$ios_directory"
  xcodebuild \
    -workspace "InnovationAcademy.xcworkspace" \
    -scheme "InnovationAcademy" \
    -configuration Debug \
    -destination "generic/platform=iOS" \
    -showBuildSettings \
    -json >"$build_settings_report"
)

if ! ios_bundle_identifier="$(node - "$build_settings_report" <<'NODE'
const { readFileSync } = require('node:fs');

const report = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const appTarget = report.find((entry) => entry.target === 'InnovationAcademy');
const bundleIdentifier = appTarget?.buildSettings?.PRODUCT_BUNDLE_IDENTIFIER;

if (typeof bundleIdentifier !== 'string' || bundleIdentifier.length === 0) {
  console.error('Could not determine the iOS bundle identifier from Xcode.');
  process.exit(1);
}

process.stdout.write(bundleIdentifier);
NODE
)"; then
  exit 1
fi
export IOS_BUNDLE_IDENTIFIER="$ios_bundle_identifier"

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
xcodebuild_command=(xcodebuild)
if [[ "$verbose_build" -eq 0 ]]; then
  xcodebuild_command+=(-quiet)
fi

echo "Renewing provisioning and building Innovation Academy for $device_udid with Apple team $apple_team_id..."
(
  cd "$ios_directory"
  "${xcodebuild_command[@]}" \
    -workspace "InnovationAcademy.xcworkspace" \
    -scheme "InnovationAcademy" \
    -configuration Debug \
    -destination "platform=iOS,id=$device_udid" \
    -derivedDataPath "$derived_data" \
    -allowProvisioningUpdates \
    -allowProvisioningDeviceRegistration \
    "CODE_SIGN_STYLE=Automatic" \
    "DEVELOPMENT_TEAM=$apple_team_id" \
    build
)

app_path="$derived_data/Build/Products/Debug-iphoneos/InnovationAcademy.app"
if [[ ! -d "$app_path" ]]; then
  echo "Xcode completed without producing $app_path." >&2
  exit 1
fi

echo "Installing the refreshed app..."
xcrun devicectl device install app --device "$device_udid" "$app_path"

echo "Done. Start Metro with: bun run --filter mobile dev:client"
