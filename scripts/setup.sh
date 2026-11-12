#!/usr/bin/env bash
# `scripts/setup.sh <command> [args…]`: runs `just setup`'s test beside `scripts/sandboxed.sh`'s
# sandbox, and plays the machine's part, which the test's keys cannot: it adds the pages that break,
# `crashes` and `loops`, to the sandbox's extensions first, then acts when a picture appears in
# `target/shots/polish-15/`:
#
# - `*-hide-folder*`: moves the repository `empty`'s folder away; `*-show-folder*` puts it back.
# - `*-write-extension*`: writes the extension `tally`, as `docs/extensions.md` says one is written;
#   `*-edit-extension*` changes its page, as a save does.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
shots=$root/target/shots/polish-15
config=$URAEDA_SANDBOX_FOLDER/config
projects=$URAEDA_SANDBOX_FOLDER/projects
for page in crashes loops; do cp -r "$root/fixtures/extensions/$page" "$config/extensions/$page"; done
# The wiki's three states: `sample` has no `docs/`, `bare` an empty one, `broken` two pages.
mkdir -p "$projects/bare/docs" "$projects/broken/docs"
printf '# Getting started\n\nRun the app.\n' >"$projects/broken/docs/start.md"
printf '# Deploying\n\nShip it.\n' >"$projects/broken/docs/deploy.md"

# Waits for the picture whose name holds `$1`.
until_shot() { until ls "$shots"/*-"$1"*.png >/dev/null 2>&1; do sleep 0.2; done; }

tally() {
  local into=$config/extensions/tally
  mkdir -p "$into"
  cat >"$into/extension.toml" <<'TOML'
name = "tally"
title = "Tally"
description = "A count, and a button that adds one."
version = "0.1.0"
api = 1
icon = "list-checks"
scope = "global"
server = "server.ts"
page = "page.tsx"
TOML
  cat >"$into/server.ts" <<'TS'
import type { ServerApi } from "uraeda/server";

let count = 0;

export default function activate(api: ServerApi) {
  const tally = api.record("tally", () => count);
  api.action("add", (input: { by: number }) => {
    count += input.by;
    tally.changed();
    return count;
  });
}
TS
  cat >"$into/page.tsx" <<'TSX'
import { View } from "nsh";
import { place, useAction, useRecord } from "uraeda/page";
import { Button, Heading } from "uraeda/ui";

function Tally() {
  const tally = useRecord<number>("tally");
  const add = useAction<{ by: number }, number>("add");
  return (
    <View style={{ gap: 12 }}>
      <Heading level={2}>{`Tally: ${tally().value ?? "…"}`}</Heading>
      <Button label="Add one" onPress={() => void add({ by: 1 })} />
    </View>
  );
}

place({ count: "tally", icon: "list-checks", id: "tally", key: "y", title: "Tally", view: Tally });
TSX
}

rm -f "$shots"/*-hide-folder*.png "$shots"/*-show-folder*.png "$shots"/*-write-extension*.png "$shots"/*-edit-extension*.png
(
  until_shot hide-folder
  mv "$projects/empty" "$projects/empty.away"
  echo "[setup] empty moved away: $(ls -d "$projects"/empty*)" >&2
  until_shot show-folder
  mv "$projects/empty.away" "$projects/empty"
  echo "[setup] empty is back: $(ls -d "$projects"/empty*)" >&2
) &
folder=$!
(
  until_shot write-extension
  tally
  until_shot edit-extension
  sed -i 's/Tally: /Counted: /' "$config/extensions/tally/page.tsx"
) &
extension=$!
trap 'kill $folder $extension 2>/dev/null || true' EXIT
"$@"
