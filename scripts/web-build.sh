#!/usr/bin/env bash
# `scripts/web-build.sh`: the app for a browser, in `target/web/`, as `just web-build` makes it
# and `ura serve` serves it (`crates/server/src/http/web.rs`).
#
# Native Shell packages the app as a static site: the page, its runtime, `nsh.<hash>.wasm`, which
# holds NSH's engine and the app's own Rust (`crates/app`, compiled to WebAssembly), the TSX as a
# module the browser runs, and the fonts, each file named by the hash of its content and
# compressed beforehand, as `<file>.br` and `<file>.gz`. Then, here:
#
# - the page gets Uraeda's first paint, `app/web/head.html`, and the default themes' backdrop as
#   the browser's own colour, and is compressed again;
# - the fonts NSH leaves as they are, the `.otf` files, which hold no compression of their own,
#   get their two compressed forms, half their size.
#
# Every tool is the dev shell's: `nsh`, with its web runtime, the Rust toolchain with the
# `wasm32-unknown-unknown` target, a clang that writes WebAssembly, `brotli`, and `gzip`.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
made="$root/target/web-nsh"
out="$root/target/web"

rm -rf "$made"
"$root/scripts/nsh.sh" package App.tsx --target web -o ../target/web-nsh
site="$made/Uraeda"
page="$site/index.html"

# The page NSH wrote is changed by its exact text: a release that words it otherwise stops here.
replace() {
  local from=$1 to=$2 text
  text=$(<"$page")
  case "$text" in
    *"$from"*) ;;
    *)
      echo "web-build: Native Shell's page no longer holds: $from" >&2
      exit 1
      ;;
  esac
  printf '%s\n' "${text/"$from"/"$to"}" >"$page"
}
replace 'content="#ffffff" media="(prefers-color-scheme: light)"' \
  'content="#dce0e8" media="(prefers-color-scheme: light)"'
replace 'content="#000000" media="(prefers-color-scheme: dark)"' \
  'content="#11111b" media="(prefers-color-scheme: dark)"'
# The first paint goes last in the head, after NSH's own styles, which it overrides.
replace '</head>' "$(<"$root/app/web/head.html")
</head>"

# The page an extension's page runs in, in a frame of its own (`app/web/frame.html`): the same
# runtime and files as the app's page, which name them by their hash, taken from that page.
built=$(<"$page")
runtime=$(grep -o 'import { createPlayer } from "[^"]*";' <<<"$built" | head -n 1)
app=$(grep -o '^ *const app = {.*};$' <<<"$built" | head -n 1)
if [[ -z $runtime || -z $app ]]; then
  echo "web-build: Native Shell's page no longer names its runtime and its files as it did" >&2
  exit 1
fi
runtime=${runtime#*from \"}
runtime=${runtime%\";}
app=${app#*const app = }
app=${app%;}
frame=$(<"$root/app/web/frame.html")
frame=${frame/"{{runtime}}"/"$runtime"}
frame=${frame/"{{app}}"/"$app"}
printf '%s\n' "$frame" >"$site/extension.html"

# The app's icon, the one its desktop entry has: a browser's tab shows it. NSH's own, from
# `app/web/icon.png` (`nsh.json`'s `icon`), are the manifest's and a phone's home screen's.
cp "$root/app/package/dev.uraeda.app.svg" "$site/icon.svg"

# The manifest, what "Add to Home Screen" installs: NSH gives it white, where the app's first
# paint is the default light theme's backdrop, as the page's own light colour is.
manifest="$site/manifest.webmanifest"
grep -q '"background_color": "#ffffff"' "$manifest" || {
  echo "web-build: Native Shell's manifest no longer holds its white" >&2
  exit 1
}
sed -i 's/"#ffffff"/"#dce0e8"/g' "$manifest"

compress() {
  rm -f "$1.br" "$1.gz"
  brotli --quality=11 --keep "$1"
  gzip --best --keep --no-name "$1"
}
compress "$page"
compress "$site/extension.html"
compress "$site/icon.svg"
find "$site" -name '*.otf' -print0 | while IFS= read -r -d '' font; do compress "$font"; done

rm -rf "$out"
mv "$site" "$out"
rmdir "$made"
echo "web-build: the app's web build is in target/web"
