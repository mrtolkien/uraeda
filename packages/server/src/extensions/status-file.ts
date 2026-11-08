// The extensions as the running server sees them, written to `extensions-status.json` in the data
// folder for `ura extension list`: each one's state, what it waits for, and its problems, its
// code's loading, compiling, and page included, which only the server meets. Agents read it there
// after writing an extension. Written whole, through a temporary file and a rename, once per burst
// of changes; removed as the server stops, when it no longer says what runs.
import { renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { guarded } from "./events.ts";
import type { ExtensionState } from "./server.ts";

/** The file's name in the data folder: the core's `STATUS_FILE`. */
export const STATUS_FILE = "extensions-status.json";

/** The file's format version: the core's `STATUS_VERSION`. */
const VERSION = 1;

/** The file's content: the states as the server sees them `at`. */
export function statusOf(states: ReadonlyArray<ExtensionState>, at: Date) {
  return {
    at: at.toISOString(),
    extensions: states.map(({ extension, problems, state, waitingFor }) => ({
      name: extension.name,
      problems: problems.map(({ file, line, message }) =>
        line === undefined ? { file, message } : { file, line, message },
      ),
      state,
      waitingFor,
    })),
    version: VERSION,
  };
}

/** The status file of the data folder `dataDir`, rewritten from `states` on `changed`. */
export class StatusFile {
  readonly #dataDir: () => string;
  readonly #states: () => ReadonlyArray<ExtensionState>;
  #pending = false;
  #closed = false;

  /** `dataDir` is read at each write: the host makes its file before it holds its options. */
  constructor(dataDir: () => string, states: () => ReadonlyArray<ExtensionState>) {
    this.#dataDir = dataDir;
    this.#states = states;
  }

  /** Writes the states again once the current burst of changes settles. */
  changed(): void {
    if (this.#pending || this.#closed) {
      return;
    }
    this.#pending = true;
    setImmediate(() => {
      this.#pending = false;
      if (!this.#closed) {
        guarded("extensions status", () => this.#write());
      }
    });
  }

  #write(): void {
    const text = `${JSON.stringify(statusOf(this.#states(), new Date()), null, 2)}\n`;
    const path = join(this.#dataDir(), STATUS_FILE);
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync(temporary, text);
    renameSync(temporary, path);
  }

  /** Removes the file: a stopped server runs nothing it said. */
  close(): void {
    this.#closed = true;
    guarded("extensions status", () => rmSync(join(this.#dataDir(), STATUS_FILE), { force: true }));
  }
}
