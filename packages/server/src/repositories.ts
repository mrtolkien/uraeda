import { existsSync, type FSWatcher, mkdirSync, watch } from "node:fs";
import { join } from "node:path";
import type { Repository, WatchHandle } from "uraeda-binding";
import type { Binding } from "./fate/context.ts";
import { REPOSITORIES_ID } from "./fate/views-repositories.ts";
import { createFate, type FateServer, live as globalLive, type LiveBus } from "./fate.ts";
import { publish } from "./live.ts";
import { type PullRequests, startPullRequests } from "./pulls.ts";
import type { Sessions } from "./runner/sessions.ts";

/**
 * A listed repository, as the server serves it: its own fate server and live bus, so its views
 * receive its updates only.
 */
export type Host = {
  fate: FateServer;
  live: LiveBus;
  missing: boolean;
  name: string;
  path: string;
};

/**
 * The list's file in the data folder. A write renames its own temporary file over it, which changes
 * this name: the temporary files are not read.
 */
const FILE = "repositories.json";
/** A change of the list's file is read this long after the last one, so a write is read once. */
export const LIST_QUIET_MS = 100;

let announced = 0;

/**
 * The hosts' binding, data folder, and session manager, and `stopped`, told of each host closed as
 * the list changes, not as the server stops.
 */
type HostsOptions = {
  binding: Binding;
  dataDir: string;
  sessions: Sessions;
  stopped?: (host: Host) => void;
};

/**
 * A host, the watch of its files, none for a missing folder or a watch that failed, and the
 * refresher of its pull requests.
 */
type Entry = { host: Host; pulls?: PullRequests; watch?: WatchHandle };

/**
 * The hosts of the repositories in the list, `repositories.json`, read through the binding: the
 * only code that starts and closes their fate servers, live buses, and watches.
 */
export class Hosts {
  #options: HostsOptions;
  #entries = new Map<string, Entry>();
  #rows: Array<Repository> = [];
  /** The reloads run one at a time, each reading the file after the last one's done. */
  #reloading: Promise<void> = Promise.resolve();
  /** Why the list could not be read at the last reload, or null when it was. */
  problem: string | null = null;
  /** The watch of the data folder, which reloads the list when its file changes. */
  #watch?: FSWatcher;
  #timer?: ReturnType<typeof setTimeout>;
  #closed = false;

  private constructor(options: HostsOptions) {
    this.#options = options;
  }

  /**
   * The hosts of the list in the data folder, each watched unless its folder is missing. The data
   * folder, created when it does not exist, is watched too: a change of the list's file, by
   * `ura add` or by hand, reloads it.
   */
  static async open(options: HostsOptions): Promise<Hosts> {
    const hosts = new Hosts(options);
    hosts.#watchList();
    await hosts.reload();
    return hosts;
  }

  #watchList(): void {
    const { dataDir } = this.#options;
    try {
      mkdirSync(dataDir, { recursive: true });
      this.#watch = watch(dataDir, (_, file) => {
        if (file === null || String(file) === FILE) {
          clearTimeout(this.#timer);
          this.#timer = setTimeout(() => void this.reload(), LIST_QUIET_MS);
        }
      });
      this.#watch.on("error", (error) => {
        process.stderr.write(
          `uraeda-server: ${error.message}; the list is read again on its next change\n`,
        );
      });
    } catch (error) {
      // The server still serves the list: its own changes read it again.
      process.stderr.write(
        `uraeda-server: ${(error as Error).message}; changes to repositories.json made elsewhere show after a restart\n`,
      );
    }
  }

  get(name: string): Host | undefined {
    return this.#entries.get(name)?.host;
  }

  /**
   * The host of a name, its folder looked at now: a folder gone, or back, since the list was last
   * read reads it again, the core saying whether the folder is missing.
   */
  async current(name: string): Promise<Host | undefined> {
    const host = this.get(name);
    // A main checkout holds `.git`: without it, the core would find the repository holding the
    // folder, maybe another one.
    if (host && host.missing === existsSync(join(host.path, ".git"))) {
      await this.reload();
      return this.get(name);
    }
    return host;
  }

  /** The host of a main checkout. */
  byPath(path: string): Host | undefined {
    for (const { host } of this.#entries.values()) {
      if (host.path === path) {
        return host;
      }
    }
    return undefined;
  }

  all(): Array<Host> {
    return [...this.#entries.values()].map((entry) => entry.host);
  }

  /** The list, as last read: most recently opened first. */
  rows(): Array<Repository> {
    return [...this.#rows];
  }

  mostRecent(): Host | undefined {
    return this.#rows.length > 0 ? this.get(this.#rows[0].name) : undefined;
  }

  /**
   * Reads the list again: new entries get their host, removed ones are closed, and an entry whose
   * path or folder changed starts again. A list that cannot be read keeps the hosts as they are.
   */
  reload(): Promise<void> {
    const next = this.#reloading.then(() => this.#reload());
    this.#reloading = next.catch(() => {});
    return next;
  }

  async #reload(): Promise<void> {
    if (this.#closed) {
      return;
    }
    const { binding, dataDir } = this.#options;
    const before = JSON.stringify([this.#rows, this.problem]);
    let rows: Array<Repository>;
    try {
      rows = await binding.readRepositories(dataDir);
    } catch (error) {
      const problem = (error instanceof Error ? error.message : String(error)).replace(
        /^refused: /,
        "",
      );
      if (problem !== this.problem) {
        process.stderr.write(`uraeda-server: ${problem}\n`);
      }
      this.problem = problem;
      this.#announce(before, this.all());
      return;
    }
    if (this.#closed) {
      return;
    }
    // A removed repository's views hear the change too.
    const heard = this.all();
    this.problem = null;
    this.#rows = rows;
    const listed = new Map(rows.map((row) => [row.name, row]));
    for (const [name, { host }] of this.#entries) {
      const row = listed.get(name);
      if (!row || row.path !== host.path || row.missing !== host.missing) {
        this.#stop(name);
      }
    }
    for (const row of rows) {
      if (!this.#entries.has(row.name)) {
        this.#start(row);
      }
    }
    this.#announce(before, [...heard, ...this.all()]);
  }

  /**
   * Sends a `Repositories` update on the global bus and the hosts' when the list or its problem
   * changed since `before`.
   */
  #announce(before: string, hosts: Array<Host>): void {
    if (JSON.stringify([this.#rows, this.problem]) === before) {
      return;
    }
    for (const bus of new Set([globalLive, ...hosts.map((host) => host.live)])) {
      bus.update("Repositories", REPOSITORIES_ID, {
        eventId: `repositories:${Date.now()}:${announced++}`,
      });
    }
  }

  #start({ missing, name, path }: Repository): void {
    const { fateServer, live } = createFate();
    const entry: Entry = { host: { fate: fateServer, live, missing, name, path } };
    if (!missing) {
      const { binding, sessions } = this.#options;
      entry.pulls = startPullRequests(path, binding, (features) =>
        publish(
          {
            branchDecisions: [],
            decisions: false,
            features,
            files: [],
            inbox: false,
            priorities: false,
            workspace: true,
          },
          entry.host,
          sessions,
        ),
      );
      try {
        entry.watch = binding.watch(path, (changes) => {
          publish(changes, entry.host, sessions);
          entry.pulls?.onChanges(changes);
        });
      } catch (error) {
        // The host still serves its files: its pages read them again when shown.
        process.stderr.write(
          `uraeda-server: ${(error as Error).message}; pages refresh when shown again\n`,
        );
      }
    }
    this.#entries.set(name, entry);
  }

  #stop(name: string): void {
    const entry = this.#entries.get(name);
    entry?.watch?.close();
    entry?.pulls?.stop();
    this.#entries.delete(name);
    if (entry) {
      this.#options.stopped?.(entry.host);
    }
  }

  /** Closes every watch, the data folder's too, as the server stops. */
  close(): void {
    this.#closed = true;
    clearTimeout(this.#timer);
    this.#watch?.close();
    for (const { pulls, watch } of this.#entries.values()) {
      watch?.close();
      pulls?.stop();
    }
    this.#entries.clear();
  }
}
