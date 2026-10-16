// The record of the Storybook process groups a server runs, in Uraeda's data folder: one file per
// server, `storybooks/<server's pid>.json`. A server killed by SIGKILL, or crashed past its exit
// hook, leaves its file behind, and the next start kills the groups it names that still run. A
// record names processes only: a Storybook's base holds the frame secret, which stays in memory.
import { execFileSync } from "node:child_process";
import { chmodSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** A process, by its pid and its start time, which tells it from a later process of that pid. */
export type RecordedProcess = { pid: number; started: string };

/** One server's file: the server, and the groups it runs, by their leader. */
export type GroupsFile = {
  groups: Array<RecordedProcess>;
  server: { pid: number; started: string | null };
};

/** The record's folder in the data folder. */
export const groupsFolder = (dataDir: string) => join(dataDir, "storybooks");

/** The start time of the process `pid`, as `ps` prints it; undefined when none runs. */
export function startTime(pid: number): string | undefined {
  try {
    const started = execFileSync("ps", ["-o", "lstart=", "-p", String(pid)], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return started === "" ? undefined : started;
  } catch {
    return undefined;
  }
}

/** Whether the recorded process still runs: its pid is alive, and started when it was recorded. */
const stillRuns = ({ pid, started }: { pid: number; started: string | null }) =>
  started !== null && startTime(pid) === started;

/**
 * The groups this server runs, written to its own file at each change, removed when it has none:
 * the owner's alone, mode 0600 in a 0700 folder.
 */
export class GroupRecord {
  readonly #file: string;
  readonly #folder: string;
  readonly #recorded: GroupsFile;

  constructor(folder: string) {
    this.#folder = folder;
    this.#file = join(folder, `${process.pid}.json`);
    this.#recorded = {
      groups: [],
      server: { pid: process.pid, started: startTime(process.pid) ?? null },
    };
  }

  /** Records the group led by `pid`. */
  add(pid: number): void {
    const started = startTime(pid);
    if (started !== undefined) {
      this.#recorded.groups.push({ pid, started });
      this.#write();
    }
  }

  /** Forgets the group led by `pid`, once it was killed. */
  remove(pid: number): void {
    const before = this.#recorded.groups.length;
    this.#recorded.groups = this.#recorded.groups.filter((group) => group.pid !== pid);
    if (this.#recorded.groups.length !== before) {
      this.#write();
    }
  }

  #write() {
    if (this.#recorded.groups.length === 0) {
      rmSync(this.#file, { force: true });
      return;
    }
    mkdirSync(this.#folder, { mode: 0o700, recursive: true });
    // A folder an earlier version made keeps its mode: it is narrowed too.
    chmodSync(this.#folder, 0o700);
    writeFileSync(this.#file, JSON.stringify(this.#recorded), { mode: 0o600 });
  }
}

/**
 * Kills the groups recorded by servers that no longer run, when their leader is still the process
 * recorded, and removes their files. A running server's file is left alone, and a leader whose pid
 * now names another process is not signalled.
 */
export function killLeftGroups(folder: string): void {
  let names: Array<string>;
  try {
    names = readdirSync(folder).filter((name) => name.endsWith(".json"));
  } catch {
    return;
  }
  for (const name of names) {
    const file = join(folder, name);
    let recorded: GroupsFile;
    try {
      recorded = JSON.parse(readFileSync(file, "utf8")) as GroupsFile;
    } catch {
      rmSync(file, { force: true });
      continue;
    }
    if (recorded.server.pid !== process.pid && stillRuns(recorded.server)) {
      continue;
    }
    for (const group of recorded.groups) {
      if (stillRuns(group)) {
        try {
          process.kill(-group.pid, "SIGKILL");
        } catch {
          // The group is gone.
        }
      }
    }
    rmSync(file, { force: true });
  }
}
