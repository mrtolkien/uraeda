// A pre-commit hook a test holds: each commit waits until the test releases it, and is refused while
// the test says so.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { temporaryFolder } from "uraeda-binding/test-utils";

/**
 * A pre-commit hook in `repo` that waits until released, each release letting one commit through,
 * and refuses the commits made while `refusing`, printing "lint: 1 problem".
 */
export function heldHook(repo: string) {
  const folder = temporaryFolder("uraeda-hook");
  const gate = join(folder, "gate");
  const refuse = join(folder, "refuse");
  const hook = join(repo, ".git/hooks/pre-commit");
  mkdirSync(dirname(hook), { recursive: true });
  writeFileSync(
    hook,
    `#!/bin/sh\nwhile [ ! -e "${gate}" ]; do sleep 0.02; done\nrm -f "${gate}"\n` +
      `if [ -e "${refuse}" ]; then echo "lint: 1 problem"; exit 1; fi\n`,
    { mode: 0o755 },
  );
  return {
    refusing: (on: boolean) => (on ? writeFileSync(refuse, "") : rmSync(refuse)),
    release: () => writeFileSync(gate, ""),
  };
}
