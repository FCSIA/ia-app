#!/bin/bash
# Build, install, and launch the IA experiment on a plugged-in iPhone.
#
#   ./scripts/run-on-device.sh            # cloud dev deployment (default)
#   ./scripts/run-on-device.sh local      # LAN dev deployment (10.0.0.x)
#   ./scripts/run-on-device.sh cloud <UDID>   # target a specific device
#
# First-run on the phone (one time each):
#   1. Settings > Privacy & Security > Developer Mode: ON (then reboot)
#   2. Settings > General > VPN & Device Management: trust your developer cert
set -euo pipefail

TEAM_ID="${IA_APPLE_TEAM_ID:-5LMJ93N7XV}"
BUNDLE_ID="${IA_BUNDLE_ID:-org.fcsia.ia.experiment}"
MODE="${1:-cloud}"
WANT_UDID="${2:-}"
IOS_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MAIN_REPO_ENV="$IOS_DIR/../../.env.local"
DD="$IOS_DIR/.device-build"

if [[ "$MODE" == "local" ]]; then
  CONVEX_URL="${IA_CONVEX_URL:-http://10.0.0.231:3210}"
  SITE_URL="${IA_CONVEX_SITE_URL:-http://10.0.0.231:3211}"
else
  # Cloud dev deployment from the MAIN checkout's .env.local (the worktree
  # intentionally has no .env.local).
  for candidate in "$IOS_DIR/../../../ia-app/.env.local" "$IOS_DIR/../../.env.local"; do
    if [[ -f "$candidate" ]]; then
      CONVEX_URL="$(grep -E '^CONVEX_URL=' "$candidate" | head -1 | cut -d= -f2- | tr -d '"')"
      SITE_URL="$(grep -E '^CONVEX_SITE_URL=' "$candidate" | head -1 | cut -d= -f2- | tr -d '"')"
      [[ -n "${CONVEX_URL:-}" ]] && break
    fi
  done
  CONVEX_URL="${IA_CONVEX_URL:-${CONVEX_URL:-}}"
  SITE_URL="${IA_CONVEX_SITE_URL:-${SITE_URL:-}}"
fi
[[ -n "$CONVEX_URL" && -n "$SITE_URL" ]] || { echo "✗ Could not resolve deployment URLs"; exit 1; }
echo "▶ deployment: convex=$CONVEX_URL site=$SITE_URL"

export PATH="/opt/homebrew/bin:$PATH"
cd "$IOS_DIR"
xcodegen generate >/dev/null

echo "▶ finding device…"
UDID="$WANT_UDID"
if [[ -z "$UDID" ]]; then
  UDID=$(xcrun devicectl list devices 2>/dev/null | awk '/iPhone|iPad/ && /available|connected/{print $3; exit}')
fi
if [[ -z "$UDID" ]]; then
  echo "✗ No connected iPhone found. Unlock it, tap 'Trust This Computer', plug in USB."
  echo "  Devices I can see:"
  xcrun devicectl list devices 2>/dev/null | sed 's/^/    /'
  exit 1
fi
echo "▶ device: $UDID"

echo "▶ building for device (team $TEAM_ID)…"
BUILD_LOG=$(env -i HOME="$HOME" PATH="/usr/bin:/bin:/opt/homebrew/bin" DEVELOPER_DIR="/Applications/Xcode.app" \
  xcodebuild -project IA.xcodeproj -scheme IA -configuration Debug \
  -destination 'generic/platform=iOS' \
  -allowProvisioningUpdates -allowProvisioningDeviceRegistration \
  DEVELOPMENT_TEAM="$TEAM_ID" PRODUCT_BUNDLE_IDENTIFIER="$BUNDLE_ID" \
  -derivedDataPath "$DD" build 2>&1) || true
echo "$BUILD_LOG" | { grep -E "error:|BUILD (SUCCEEDED|FAILED)" | head -6 || true; }

if echo "$BUILD_LOG" | grep -q "No Account for Team"; then
  cat <<'EOF'

⚠ ONE-TIME FIX NEEDED (Apple requires UI for this):
  1. open -a Xcode
  2. Xcode menu > Settings… > Accounts
  3. Click your Apple ID > "Sign in again" / re-enter password + 2FA
  Then re-run this script. Everything else stays automated.
EOF
  exit 1
fi

APP="$DD/Build/Products/Debug-iphoneos/IA.app"
[[ -d "$APP" ]] || { echo "✗ build product missing"; exit 1; }

echo "▶ installing…"
xcrun devicectl device install app --device "$UDID" "$APP"

echo "▶ launching…"
xcrun devicectl device process launch --device "$UDID" "$BUNDLE_ID" 2>/dev/null \
  || echo "  (auto-launch unavailable — just tap the IA icon on your phone)"

echo ""
echo "✅ Done — IA should now be running on your phone ($MODE backend)."
