#!/usr/bin/env bash
set -euo pipefail

# Native builds must use Xcode's tools instead of Nix's host compiler flags.
if [[ "$(uname -s)" == Darwin ]]; then
  xcode_directory="${DEVELOPER_DIR:-}"
  if [[ ! -d "$xcode_directory/Platforms/iPhoneOS.platform" ]]; then
    xcode_directory="$(env -u DEVELOPER_DIR /usr/bin/xcode-select -p)"
  fi
  unset AR AS CC CXX LD LDPLUSPLUS LIBTOOL NM RANLIB STRIP
  unset CFLAGS CXXFLAGS CPPFLAGS LDFLAGS SDKROOT MACOSX_DEPLOYMENT_TARGET
  unset NIX_CFLAGS_COMPILE NIX_LDFLAGS TOOLCHAINS DEVELOPER_DIR
  export PATH="/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
  export DEVELOPER_DIR="$xcode_directory"
fi

if [[ -z "${ANDROID_HOME:-}" && -d "$HOME/Library/Android/sdk" ]]; then
  export ANDROID_HOME="$HOME/Library/Android/sdk"
fi

exec "$@"
