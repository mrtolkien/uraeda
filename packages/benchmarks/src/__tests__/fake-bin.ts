import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { temporary } from "./samples.ts";

/**
 * A folder with a fake `docker` and a fake `ura` first on the `PATH`. The fake docker logs its
 * arguments, one per line and a blank line between calls, to `docker.log`; `docker cp` copies the
 * folder `repository`; `docker ps` prints nothing. The fake `ura init` makes a `specs/` folder.
 */
export function fakeBin(repository: string) {
  const bin = temporary("benchmarks-bin-");
  const log = join(bin, "docker.log");
  const script = (name: string, body: string) => {
    writeFileSync(join(bin, name), `#!/bin/sh\n${body}\n`);
    chmodSync(join(bin, name), 0o755);
  };
  script(
    "docker",
    `printf '%s\\n' "$@" >> '${log}'; echo >> '${log}'
case "$1" in
  create) echo fake-container ;;
  cp) cp -a '${repository}/.' "\${3}" ;;
  ps) : ;;
esac`,
  );
  // `ura start <draft> --slug <slug> --switch` moves the draft to a feature folder on its own
  // branch, as the real one does.
  script(
    "ura",
    `case "$1" in
  init) mkdir -p specs/drafts specs/decisions && touch specs/PRIORITIES.md ;;
  start) mkdir -p "specs/2026-10-19-$2" && git mv "specs/drafts/$2.md" "specs/2026-10-19-$2/proposal.md" \
    && git checkout -q -b "2026-10-19-$2" && git commit -q -am proposal ;;
esac`,
  );
  return {
    bin,
    calls: () =>
      readFileSync(log, "utf8")
        .split("\n\n")
        .filter(Boolean)
        .map((call) => call.split("\n")),
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}` },
  };
}
