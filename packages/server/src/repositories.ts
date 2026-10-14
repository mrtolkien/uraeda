import type { Repository, WatchHandle } from "uraeda-binding";
import type { Binding } from "./fate/context.ts";
import { createFate, type FateServer, type LiveBus } from "./fate.ts";
import { publish } from "./live.ts";
import type { Sessions } from "./runner/sessions.ts";

/**
 * A listed repository, as the server serves it: its own fate server and live bus, so its views
 * receive its updates only.
 */
export type Host = {
  name: string;
  path: string;
  missing: boolean;
  fate: FateServer;
  live: LiveBus;
};

/** A host, and the watch of its files: none for a missing folder, or a watch that failed. */
type Entry = { host: Host; watch?: WatchHandle };

/**
 * The hosts of the repositories in the list, `repositories.json`, read through the binding: the
 * only code that starts and closes their fate servers, live buses, and watches.
 */
export class Hosts {
  #options: { binding: Binding; dataDir: string; sessions: Sessions };
  #entries = new Map<string, Entry>();
  #rows: Array<Repository> = [];
  /** The reloads run one at a time, each reading the file after the last one's done. */
  #reloading: Promise<void> = Promise.resolve();
  /** Why the list could not be read at the last reload, or null when it was. */
  problem: string | null = null;

  private constructor(options: { binding: Binding; dataDir: string; sessions: Sessions }) {
    this.#options = options;
  }

  /** The hosts of the list in the data folder, each watched unless its folder is missing. */
  static async open(options: {
    binding: Binding;
    dataDir: string;
    sessions: Sessions;
  }): Promise<Hosts> {
    const hosts = new Hosts(options);
    await hosts.reload();
    return hosts;
  }

  get(name: string): Host | undefined {
    return this.#entries.get(name)?.host;
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
    const { binding, dataDir } = this.#options;
    let rows: Array<Repository>;
    try {
      rows = await binding.readRepositories(dataDir);
    } catch (error) {
      const problem = (error instanceof Error ? error.message : String(error)).replace(
        /^refused: /,
        "",
      );
      if (problem !== this.problem) {
        console.error(`uraeda-server: ${problem}`);
      }
      this.problem = problem;
      return;
    }
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
  }

  #start({ name, path, missing }: Repository): void {
    const { fateServer, live } = createFate();
    const entry: Entry = { host: { name, path, missing, fate: fateServer, live } };
    if (!missing) {
      try {
        entry.watch = this.#options.binding.watch(path, (changes) =>
          publish(changes, entry.host, this.#options.sessions),
        );
      } catch (error) {
        // The host still serves its files: its pages read them again when shown.
        console.error(`uraeda-server: ${(error as Error).message}; pages refresh when shown again`);
      }
    }
    this.#entries.set(name, entry);
  }

  #stop(name: string): void {
    this.#entries.get(name)?.watch?.close();
    this.#entries.delete(name);
  }

  /** Closes every watch, as the server stops. */
  close(): void {
    for (const { watch } of this.#entries.values()) {
      watch?.close();
    }
    this.#entries.clear();
  }
}
