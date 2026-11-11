// Writes, for each recorded stream of Claude Code, the events the Node server's runner makes of
// it: what `crates/server/tests/claude.rs` compares the Rust runtime's events with, one by one.
//
//   nix develop -c node fixtures/runtimes/claude/node-events.ts
//
// It drives `parseLine`, the parser of `packages/server/src/runner/claude-events.ts`, over each
// stream's lines, with one map of tasks and one of blocks per stream, as a session's process
// keeps them, and writes no event by hand. Run it again after `record.ts`, or after a change to
// the Node parser. It reads:
//
// - `<name>.jsonl` beside this file, the streams `record.ts` recorded, into
//   `<name>.events.jsonl`;
// - `fixtures/claude/<name>.jsonl`, the lines the Node server's own tests hold, recorded from
//   earlier versions of Claude Code, into `lines/<name>.events.jsonl`: the usage limits, the
//   wakeups, and a retry, which no run shows on demand;
// - `written/<name>.jsonl`, lines written by hand for what no recording shows, the cases of the
//   Node parser's tests, into `written/<name>.events.jsonl`.
//
// The clock and the zone are fixed, as a limit's reset and a wakeup's time are read from them:
// the test's server starts at the same instant, in the same zone. A stream named
// `<name>.at-<seconds>.jsonl` is read at that instant instead, in seconds since 1970.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Before any date is read: the zone the events are written in.
process.env.TZ = "Asia/Tokyo";

/** The instant a stream is read at: 2026-11-10 at 09:00 UTC, when a test's server starts. */
const START = Date.UTC(2026, 10, 10, 9, 0, 0);
let now = START;
const SystemDate = Date;
globalThis.Date = class extends SystemDate {
  constructor(...given: Array<unknown>) {
    if (given.length === 0) {
      super(now);
    } else {
      super(...(given as [number]));
    }
  }
  static override now() {
    return now;
  }
} as DateConstructor;

const { parseLine } = await import("../../../packages/server/src/runner/claude-events.ts");

const here = dirname(fileURLToPath(import.meta.url));

/** The folder every recorded stream names as its session's. */
const SESSION_DIR = "/session-dir";

/** Writes the events of each stream of `from` into `to`, one event a line. */
function write(from: string, to: string): void {
  mkdirSync(to, { recursive: true });
  for (const file of readdirSync(from).toSorted()) {
    if (!file.endsWith(".jsonl") || file.endsWith(".events.jsonl")) {
      continue;
    }
    const at = /\.at-(\d+)\.jsonl$/.exec(file)?.[1];
    now = at === undefined ? START : Number(at) * 1000;
    const tasks = new Map<string, string>();
    const blocks = new Map();
    const events = readFileSync(join(from, file), "utf8")
      .split("\n")
      .filter(Boolean)
      .flatMap((line) => parseLine(line, SESSION_DIR, tasks, blocks));
    const text = events.map((event) => `${JSON.stringify(event)}\n`).join("");
    writeFileSync(join(to, file.replace(/\.jsonl$/, ".events.jsonl")), text);
    process.stdout.write(`${file}: ${events.length} events\n`);
  }
}

write(here, here);
write(join(here, "../../claude"), join(here, "lines"));
write(join(here, "written"), join(here, "written"));
