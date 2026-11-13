#!/usr/bin/env bash
# `scripts/ios.sh run [nsh run's flags…]`: the app in the iOS Simulator, with hot reload, as `just
# app-ios` runs it, on a Mac with Xcode. Its first page asks for a server: the sandbox at
# http://127.0.0.1:4420, which the simulator reaches as this machine does, `just sandbox --no-app`.
#
# `scripts/ios.sh package [nsh package's flags…]`: the app as a device installs it, with no
# development server, as `just package-ios` makes it: an `.app` for the simulator, installed and
# started there, or with `--target ios --sign <identity> --profile <file>` an `.ipa` for a device.
#
# `scripts/ios.sh install`: the app on the phone that is plugged in, as `just install-ios` does it,
# after the one-time setup of CONTRIBUTING.md, "iOS". It finds the profile, the certificate, and
# the phone itself (`ios-device.py`), builds, installs, and starts the app. Run it again for every
# new version, and every 7 days on a free account, whose profile and certificate then expire.
#
# - `--device <name or UDID>` picks a simulator: the booted one, else the newest iPhone, otherwise.
# - The dev shell puts Nix's `xcrun` and its macOS SDK first, which know no simulator: Xcode's own
#   go first here, for `simctl` and the iOS SDK the crate links against.
# - `nsh` needs its `ios` component, `nsh component add ios`, and the toolchain the iOS targets
#   of `rust-toolchain.toml`.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)

if [ "$(uname)" != "Darwin" ]; then
  echo "[uraeda] the iOS Simulator runs on a Mac with Xcode" >&2
  exit 1
fi
unset DEVELOPER_DIR SDKROOT
export PATH="/usr/bin:$PATH"
# The oldest iOS the app runs on, `MinimumOSVersion` of its Info.plist, for the Rust and the C of
# every crate: Rust's default for a device is iOS 10, below the `___chkstk_darwin` that QuickJS's C
# calls, and the device's link failed on it, where the simulator's own default is newer.
export IPHONEOS_DEPLOYMENT_TARGET=15.0
if ! xcrun simctl help >/dev/null 2>&1; then
  echo "[uraeda] Xcode's simctl is missing: install Xcode, then \`xcode-select -s\` it" >&2
  exit 1
fi

command=${1:-run}
shift || true
case "$command" in
  run) exec "$root/scripts/nsh.sh" run --target ios "$@" ;;
  package)
    # The simulator's unless another target is asked for.
    case " $* " in
      *" --target "*) exec "$root/scripts/nsh.sh" package --out ../target/ios "$@" ;;
      *) exec "$root/scripts/nsh.sh" package --out ../target/ios --target ios-simulator --run "$@" ;;
    esac
    ;;
  install)
    found=$(python3 "$root/scripts/ios-device.py")
    field() { printf '%s\n' "$found" | sed -n "s/^$1=//p"; }
    id=$(field id)
    device=$(field device)
    echo "[uraeda] app $id, signed until the profile's end, ${found##*expires=}" >&2
    "$root/scripts/nsh.sh" package --out ../target/ios --target ios --id "$id" \
      --sign "$(field identity)" --profile "$(field profile)"
    xcrun devicectl device install app --device "$device" "$root/target/ios/Uraeda.ipa"
    # The first launch asks for the certificate to be trusted on the phone, once: Settings, General,
    # VPN & Device Management. The app is installed whatever the launch says.
    if ! xcrun devicectl device process launch --device "$device" "$id" >/dev/null 2>&1; then
      echo "[uraeda] installed, not started: unlock the phone, and trust your certificate in" >&2
      echo "[uraeda] Settings, General, VPN & Device Management, once; then open the app" >&2
    fi
    ;;
  *)
    echo "[uraeda] scripts/ios.sh run|package|install [flags…]" >&2
    exit 1
    ;;
esac
