#!/bin/sh
# Install the fcsia command-line client for IA App.
#
#   curl -fsSL https://app.fcsia.com/install.sh | sh
#
# FCSIA_VERSION=v0.5.0 pins a release; FCSIA_INSTALL_DIR changes the target
# directory. The script downloads the matching release binary, verifies it
# against the release's SHA256SUMS, and replaces fcsia in place.
set -eu

REPOSITORY="FCSIA/ia-app"
VERSION="${FCSIA_VERSION:-latest}"
INSTALL_DIR="${FCSIA_INSTALL_DIR:-$HOME/.local/bin}"
staging=""

say() {
  printf '%s\n' "$*"
}

fail() {
  printf 'fcsia: %s\n' "$*" >&2
  exit 1
}

cleanup() {
  [ -n "${tmp:-}" ] && rm -rf "$tmp"
  [ -n "$staging" ] && rm -f "$staging"
  # An EXIT trap's last status becomes the script's status; cleanup is not a failure.
  return 0
}
trap cleanup EXIT HUP INT TERM

case "$(uname -s)" in
  Darwin) os=darwin ;;
  Linux) os=linux ;;
  *)
    fail "Unsupported operating system: $(uname -s). See https://github.com/$REPOSITORY/releases."
    ;;
esac

case "$(uname -m)" in
  x86_64|amd64) arch=x64 ;;
  arm64|aarch64) arch=arm64 ;;
  *)
    fail "Unsupported processor: $(uname -m). See https://github.com/$REPOSITORY/releases."
    ;;
esac

asset="fcsia-$os-$arch"
if [ "$VERSION" = "latest" ]; then
  base="https://github.com/$REPOSITORY/releases/latest/download"
else
  case "$VERSION" in
    v*) ;;
    *) VERSION="v$VERSION" ;;
  esac
  base="https://github.com/$REPOSITORY/releases/download/$VERSION"
fi

command -v curl >/dev/null 2>&1 || fail "curl is required to download fcsia."

tmp="$(mktemp -d)" || fail "Couldn't create a temporary directory."

say "Downloading fcsia ($os-$arch)..."
curl -fsSL "$base/$asset" -o "$tmp/$asset" ||
  fail "Couldn't download $asset. Check https://github.com/$REPOSITORY/releases."
curl -fsSL "$base/SHA256SUMS" -o "$tmp/SHA256SUMS" ||
  fail "Couldn't download SHA256SUMS, so the download can't be verified."

expected="$(awk -v name="$asset" '$2 == name || $2 == "*" name { print $1; exit }' "$tmp/SHA256SUMS")"
[ -n "$expected" ] || fail "SHA256SUMS has no entry for $asset."

if command -v sha256sum >/dev/null 2>&1; then
  actual="$(sha256sum "$tmp/$asset" | awk '{ print $1 }')"
elif command -v shasum >/dev/null 2>&1; then
  actual="$(shasum -a 256 "$tmp/$asset" | awk '{ print $1 }')"
else
  fail "Need sha256sum or shasum to verify the download."
fi
[ "$actual" = "$expected" ] || fail "The $asset download didn't match SHA256SUMS."

mkdir -p "$INSTALL_DIR" || fail "Couldn't create $INSTALL_DIR."
staging="$INSTALL_DIR/.fcsia.$$"
cp "$tmp/$asset" "$staging" || fail "Couldn't write to $INSTALL_DIR."
chmod 755 "$staging"
mv -f "$staging" "$INSTALL_DIR/fcsia"
staging=""

say ""
say "Installed fcsia to $INSTALL_DIR/fcsia"
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    say ""
    say "Add it to your PATH:"
    say "  export PATH=\"$INSTALL_DIR:\$PATH\""
    ;;
esac
say ""
say "Sign in with: fcsia login"
say "Shell completion: fcsia completion --help"
