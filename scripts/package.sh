#!/usr/bin/env bash
# `scripts/package.sh`: the Linux app as a release ships it, `just package`. It writes, in
# `target/package/`:
#
# - `uraeda/`, the package: the launcher `uraeda` (`app/package/uraeda`), which checks the
#   program loads and says what to install when it does not; `ura`, a link to `lib/ura`; the
#   program `lib/uraeda`, `ura` beside it, which it starts as its server, and the app's files,
#   `lib/nsh/`; the desktop entry and the icons, in `share/`, where a desktop looks for them.
# - `uraeda-app-x86_64-linux.tar.gz`, that folder.
# - `uraeda-app-x86_64.AppImage`, the same folder as one program: the AppImage's runtime, then the
#   folder's squashfs image, with what an AppImage holds at its root (`AppRun`, the entry, the icon).
# - a `.sha256` beside each, as cargo-dist writes for `ura`.
#
# The version is the workspace's, in `Cargo.toml`: `ura`, the app, and the package carry it.
# The binaries build in the dev shell, against Nix's libraries, and are made to run outside Nix:
# the system's loader and libraries, found in the usual places. The machine needs GTK 4.14 or
# newer and WebKitGTK 6.0, as the launcher says.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
cd "$root"

out=$root/target/package
profile=release-app
id=dev.uraeda.app
arch=x86_64
version=$(sed -n '/^\[workspace.package\]/,/^\[/s/^version = "\(.*\)"$/\1/p' Cargo.toml)
[ -n "$version" ] || { echo "package: no version in Cargo.toml's [workspace.package]" >&2; exit 1; }
runtime=${URAEDA_APPIMAGE_RUNTIME:?run it in the dev shell, which pins the AppImage runtime}
# The time every packed file carries: the commit's, so two packages of one commit pack alike.
epoch=$(git log -1 --format=%ct 2>/dev/null || echo 0)

rm -rf "$out"
package=$out/uraeda
mkdir -p "$package/lib" "$package/share/applications"

echo "package: the app's TSX, compiled for release"
scripts/nsh.sh build --release -o "$package/lib/nsh"
# The source and its map are for development: the program runs the bytecode.
rm -f "$package/lib/nsh/bundle.js" "$package/lib/nsh/bundle.js.map"
printf '{"name":"Uraeda","id":"%s","version":"%s"}\n' "$id" "$version" > "$package/lib/nsh/app.json"

# A web build already made, which `URAEDA_WEB_BUILD` names, is the one `ura` holds: the release
# builds it once, and the `ura` of the archives and the package's then hold the same.
if [ -n "${URAEDA_WEB_BUILD:-}" ]; then
  [ -f "$URAEDA_WEB_BUILD/index.html" ] || { echo "package: no index.html in URAEDA_WEB_BUILD, $URAEDA_WEB_BUILD" >&2; exit 1; }
  echo "package: the app for a browser, from $URAEDA_WEB_BUILD"
else
  echo "package: the app for a browser, which ura holds"
  scripts/web-build.sh
  export URAEDA_WEB_BUILD=$root/target/web
fi

# The newest glibc the binaries may need: Ubuntu 24.04's, the first release with GTK 4.14.
floor=2.39
echo "package: uraeda and ura, profile $profile, for glibc $floor"
# Functions the dev shell's glibc versioned past the floor go to their older versions:
# `scripts/glibc-floor.c`. The flags apply to this profile's builds alone, which only this script
# makes.
compat=$root/target/$profile/glibc-floor.o
mkdir -p "$(dirname "$compat")"
cc -O2 -fPIC -c scripts/glibc-floor.c -o "$compat"
wrapped=$(sed -n 's/^OLD(\([a-z0-9]*\),.*/\1/p' scripts/glibc-floor.c | paste -sd, -)
RUSTFLAGS="-C link-arg=$compat -C link-arg=-Wl,--wrap=${wrapped//,/,--wrap=}" \
  cargo build --locked --profile "$profile" -p uraeda-cli -p uraeda-app --bin ura --bin uraeda
for program in uraeda ura; do
  cp "target/$profile/$program" "$package/lib/$program"
  # The system's loader, and no path into Nix's store: the libraries are the machine's.
  patchelf --set-interpreter /lib64/ld-linux-x86-64.so.2 --remove-rpath "$package/lib/$program"
  if strings "$package/lib/$program" | grep -q '^/nix/store/.*\.so'; then
    echo "package: lib/$program still names a library in /nix/store" >&2
    exit 1
  fi
done
install -m 755 app/package/uraeda "$package/uraeda"
ln -s lib/ura "$package/ura"

desktop-file-validate "app/package/$id.desktop"
install -m 644 "app/package/$id.desktop" "$package/share/applications/$id.desktop"
icons=$package/share/icons/hicolor
install -D -m 644 "app/package/$id.svg" "$icons/scalable/apps/$id.svg"
for size in 16 24 32 48 64 128 256 512; do
  mkdir -p "$icons/${size}x$size/apps"
  resvg -w "$size" -h "$size" "app/package/$id.svg" "$icons/${size}x$size/apps/$id.png"
done

# What the machine must hold: the libraries the program asks for, and the newest glibc it needs.
echo "package: lib/uraeda needs $(patchelf --print-needed "$package/lib/uraeda" | tr '\n' ' ')"
for program in uraeda ura; do
  # A weak symbol is looked up only where it exists: the floor holds for the others.
  needs=$(objdump -T "$package/lib/$program" | awk '$2 != "w" && /GLIBC_[0-9]/' \
    | grep -o 'GLIBC_[0-9][0-9.]*.*' | sed 's/^GLIBC_//; s/)//')
  glibc=$(echo "$needs" | awk '{print $1}' | sort -uV | tail -n 1)
  echo "package: lib/$program needs glibc $glibc"
  if [ "$(printf '%s\n' "$glibc" "$floor" | sort -V | tail -n 1)" != "$floor" ]; then
    echo "package: lib/$program needs glibc past $floor, for:" >&2
    echo "$needs" | awk -v floor="$floor" '{print "  " $NF " (" $1 ")"}' | sort -u \
      | while read -r line; do
          version=${line##*(}; version=${version%)}
          [ "$(printf '%s\n' "$version" "$floor" | sort -V | tail -n 1)" = "$floor" ] || echo "$line"
        done >&2
    echo "Add each to scripts/glibc-floor.c." >&2
    exit 1
  fi
done

echo "package: the tarball"
tarball=$out/uraeda-app-$arch-linux.tar.gz
tar --sort=name --owner=0 --group=0 --numeric-owner --mtime="@$epoch" -C "$out" -cf - uraeda \
  | gzip -n -9 > "$tarball"

echo "package: the AppImage"
appdir=$out/AppDir
cp -a "$package" "$appdir"
ln -s uraeda "$appdir/AppRun"
cp "app/package/$id.desktop" "$appdir/$id.desktop"
cp "$icons/256x256/apps/$id.png" "$appdir/$id.png"
ln -s "$id.png" "$appdir/.DirIcon"
image=$out/AppDir.squashfs
SOURCE_DATE_EPOCH=$epoch mksquashfs "$appdir" "$image" -root-owned -noappend -no-progress -quiet \
  -comp zstd > /dev/null
appimage=$out/uraeda-app-$arch.AppImage
cat "$runtime" "$image" > "$appimage"
chmod 755 "$appimage"
rm -rf "$appdir" "$image"

cd "$out"
for artifact in "uraeda-app-$arch-linux.tar.gz" "uraeda-app-$arch.AppImage"; do
  sha256sum "$artifact" > "$artifact.sha256"
done
echo "package: Uraeda $version, in target/package/"
ls -l --block-size=K "uraeda-app-$arch-linux.tar.gz" "uraeda-app-$arch.AppImage" uraeda/lib/uraeda uraeda/lib/ura
