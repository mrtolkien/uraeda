#!/usr/bin/env bash
# `scripts/macos.sh [--open]`: the Mac app as a release ships it, `just package-macos`, on an Apple
# silicon Mac in the dev shell. It writes, in `target/macos/`:
#
# - `Uraeda.app`: NSH's AppKit runner with the app's crate, the app's TSX compiled for release, its
#   icon, and `ura` beside the program, in `Contents/MacOS/`, which the app starts as its server
#   when none runs (`crates/app/src/local.rs`). It is signed ad hoc, as `nsh package` signs it.
# - `uraeda-app-aarch64-macos.zip`, that app, as the Finder compresses it, and its `.sha256`.
#
# `--open` opens the app once it is built: it finds this Mac's server, or starts one, in the data
# folder `ura serve-app` uses, and stops the one it started as it quits.
#
# The version is the workspace's, in `Cargo.toml`: `ura`, the app, and the archive carry it. A web
# build already made, which `URAEDA_WEB_BUILD` names, is the one `ura` holds, as in a release;
# otherwise it is built first, as `just package` does on Linux.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

if [ "$(uname)" != "Darwin" ] || [ "$(uname -m)" != "arm64" ]; then
  echo "package-macos: the Mac app builds on an Apple silicon Mac" >&2
  exit 1
fi

open=false
for arg in "$@"; do
  case "$arg" in
    --open) open=true ;;
    *)
      echo "package-macos: scripts/macos.sh [--open]" >&2
      exit 1
      ;;
  esac
done

out=$root/target/macos
profile=release-app
arch=aarch64
version=$(sed -n '/^\[workspace.package\]/,/^\[/s/^version = "\(.*\)"$/\1/p' Cargo.toml)
[ -n "$version" ] || { echo "package-macos: no version in Cargo.toml's [workspace.package]" >&2; exit 1; }
app=$out/Uraeda.app
archive=uraeda-app-$arch-macos.zip

rm -rf "$out"
mkdir -p "$out"

if [ -n "${URAEDA_WEB_BUILD:-}" ]; then
  [ -f "$URAEDA_WEB_BUILD/index.html" ] || { echo "package-macos: no index.html in URAEDA_WEB_BUILD, $URAEDA_WEB_BUILD" >&2; exit 1; }
  echo "package-macos: the app for a browser, from $URAEDA_WEB_BUILD"
else
  echo "package-macos: the app for a browser, which ura holds"
  scripts/web-build.sh
  export URAEDA_WEB_BUILD=$root/target/web
fi

echo "package-macos: the app, version $version"
scripts/nsh.sh package --target macos --arch arm64 --out ../target/macos --app-version "$version" \
  --icon web/icon.png

echo "package-macos: ura, profile $profile"
cargo build --locked --profile "$profile" -p uraeda-cli --bin ura
install -m 755 "target/$profile/ura" "$app/Contents/MacOS/ura"
# `ura` changed the bundle: it is signed again, ad hoc, as a whole. The system's tools, which the
# dev shell's PATH puts after Nix's.
/usr/bin/codesign --force --deep --sign - "$app"
/usr/bin/codesign --verify --deep --strict "$app"
if ! /usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$app/Contents/Info.plist" \
  | grep -qx "$version"; then
  echo "package-macos: the app does not carry the version $version" >&2
  exit 1
fi

echo "package-macos: the archive"
(cd "$out" && /usr/bin/ditto -c -k --sequesterRsrc --keepParent Uraeda.app "$archive")
(cd "$out" && shasum -a 256 "$archive" > "$archive.sha256")
echo "package-macos: Uraeda $version, in target/macos/"
ls -lh "$out/$archive" "$app/Contents/MacOS/"

if $open; then
  /usr/bin/open "$app"
fi
