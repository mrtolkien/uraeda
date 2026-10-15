// `vp run coverage`'s summary, read from its two lcov files (see the testing review's US6).
import { expect, test } from "vite-plus/test";
import { summary } from "../../../../scripts/coverage-summary.ts";

/** An lcov record of `file`, with `found` lines of which `hit` were run. */
function record(file: string, found: number, hit: number): string {
  return `TN:\nSF:${file}\nDA:1,${hit ? 1 : 0}\nLF:${found}\nLH:${hit}\nend_of_record\n`;
}

const NOT_COUNTED = "The `ura` binary run by the CLI tests is not counted.";

test.each([
  [
    "both totals, the spawned `ura` counted",
    record("/repo/crates/core/src/lib.rs", 3, 1) + record("/repo/crates/cli/src/main.rs", 1, 1),
    record("/repo/packages/server/src/app.ts", 8, 6),
    ["Rust: 50.0% of lines", "TypeScript: 75.0% of lines"],
  ],
  [
    "a `main.rs` with no line covered",
    record("/repo/crates/core/src/lib.rs", 4, 3) + record("/repo/crates/cli/src/main.rs", 2, 0),
    record("/repo/packages/web/src/App.tsx", 3, 1),
    ["Rust: 50.0% of lines", NOT_COUNTED, "TypeScript: 33.3% of lines"],
  ],
  [
    "a report without the CLI's `main.rs`",
    record("/repo/crates/core/src/lib.rs", 1, 1),
    record("/repo/packages/binding/index.ts", 1, 1),
    ["Rust: 100.0% of lines", NOT_COUNTED, "TypeScript: 100.0% of lines"],
  ],
  [
    "another crate's `main.rs` covered",
    record("/repo/crates/core/src/lib.rs", 1, 1) + record("/repo/crates/lsp/src/main.rs", 1, 1),
    record("/repo/packages/server/src/app.ts", 1, 0),
    ["Rust: 100.0% of lines", NOT_COUNTED, "TypeScript: 0.0% of lines"],
  ],
  ["empty reports", "", "", ["Rust: 0.0% of lines", NOT_COUNTED, "TypeScript: 0.0% of lines"]],
])("%s", (_name, rust, typescript, expected) => {
  expect(summary(rust, typescript)).toEqual(expected);
});
