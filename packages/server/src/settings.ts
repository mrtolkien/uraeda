// The server's settings in force: each from its flag, its variable, the settings file, then its
// default, the file read through the core and watched while the server runs.
import { type FSWatcher, mkdirSync, watch } from "node:fs";
import { homedir } from "node:os";
import { join, sep } from "node:path";
import type { Settings } from "uraeda-binding";
import type { Given } from "./env.ts";
import type { Binding } from "./fate/context.ts";
import type { Options } from "./options.ts";
import { LIST_QUIET_MS } from "./repositories.ts";

/** The port the server listens on when no flag, variable, or file gives one. */
export const DEFAULT_PORT = 4310;

/** The settings file's name, in the config folder. */
const FILE = "config.toml";

/** Where a setting's value in force comes from. */
export type Source =
  | { kind: "default" }
  | { kind: "file" }
  | { kind: "flag"; name: "--allowed-hosts" | "--port" | "--no-open" }
  | { kind: "environment"; name: "URAEDA_ALLOWED_HOSTS" | "URAEDA_PORT" };

/** A setting: its value in force, the file's value, null when the file has none, and its source. */
export type Setting<T> = { inForce: T; saved: T | null; source: Source };

/** The server's settings, as the server applies them. */
export type ServerSettingsView = {
  allowedHosts: Setting<Array<string>>;
  openBrowser: Setting<boolean>;
  port: Setting<number>;
};

/** The source of a value given for this run: a flag's name starts with `--`. */
function givenSource({ name }: Given<unknown>): Source {
  return name.startsWith("--")
    ? { kind: "flag", name: name as "--allowed-hosts" | "--port" }
    : { kind: "environment", name: name as "URAEDA_ALLOWED_HOSTS" | "URAEDA_PORT" };
}

/** A setting from the value given for this run, else the file's, else the default. */
function setting<T>(given: Given<T> | undefined, saved: T | undefined, fallback: T): Setting<T> {
  const kept = saved ?? null;
  if (given !== undefined) {
    return { inForce: given.value, saved: kept, source: givenSource(given) };
  }
  return kept === null
    ? { inForce: fallback, saved: null, source: { kind: "default" } }
    : { inForce: kept, saved: kept, source: { kind: "file" } };
}

/**
 * The values in force, the one place of their order: the flag, the variable, the file, then the
 * default: no host names, port 4310, a browser opened. `file` is null when there is none, or it
 * cannot be read.
 */
export function inForce(
  options: Pick<Options, "allowedHosts" | "noOpen" | "port">,
  file: Settings | null,
): ServerSettingsView {
  const saved = file?.server ?? {};
  const openBrowser = setting(undefined, saved.openBrowser, true);
  return {
    allowedHosts: setting(options.allowedHosts, saved.allowedHosts, []),
    openBrowser: options.noOpen
      ? { ...openBrowser, inForce: false, source: { kind: "flag", name: "--no-open" } }
      : openBrowser,
    port: setting(options.port, saved.port, DEFAULT_PORT),
  };
}

/** A path with the home folder written `~`, as the core's messages write it. */
function shown(path: string): string {
  const home = homedir();
  return path.startsWith(home + sep) ? `~${path.slice(home.length)}` : path;
}

/** What `ServerSettings.open` takes: the binding, the config folder, and the run's options. */
type SettingsOptions = {
  binding: Pick<Binding, "readSettings">;
  dir: string;
  options: Pick<Options, "allowedHosts" | "noOpen" | "port">;
};

/**
 * The server's settings in force, the only reader of the settings file for the running server:
 * the file read at start and again on each change, after a quiet moment, its problem kept when it
 * cannot be read, the defaults applying meanwhile.
 */
export class ServerSettings {
  /** The settings file, with `~` for the home folder. */
  readonly file: string;
  /** Why the file could not be read at the last read, or null when it was, or there is none. */
  problem: string | null = null;
  readonly #options: SettingsOptions;
  #view: ServerSettingsView;
  #listeners = new Set<() => void>();
  #reloading: Promise<void> = Promise.resolve();
  #watch?: FSWatcher;
  #timer?: ReturnType<typeof setTimeout>;
  #closed = false;

  private constructor(options: SettingsOptions) {
    this.#options = options;
    this.file = shown(join(options.dir, FILE));
    this.#view = inForce(options.options, null);
  }

  /**
   * The settings of the config folder `dir`: its file read once, then watched, the folder created
   * when it does not exist. `close` stops the watch.
   */
  static async open(options: SettingsOptions): Promise<ServerSettings> {
    const settings = new ServerSettings(options);
    settings.#watchFolder();
    await settings.reload();
    return settings;
  }

  #watchFolder(): void {
    const { dir } = this.#options;
    try {
      mkdirSync(dir, { recursive: true });
      this.#watch = watch(dir, (_, file) => {
        if (file === null || String(file) === FILE) {
          clearTimeout(this.#timer);
          this.#timer = setTimeout(() => void this.reload(), LIST_QUIET_MS);
        }
      });
      this.#watch.on("error", (error) => {
        process.stderr.write(
          `uraeda: ${error.message}; the settings are read again on their next change\n`,
        );
      });
    } catch (error) {
      process.stderr.write(
        `uraeda: ${(error as Error).message}; changes to ${this.file} show after a restart\n`,
      );
    }
  }

  /** The values in force, and the file's. */
  view(): ServerSettingsView {
    return this.#view;
  }

  /**
   * The host names in force, besides 127.0.0.1 and localhost: the same array until they, or
   * another value in force, change.
   */
  allowedHosts(): ReadonlyArray<string> {
    return this.#view.allowedHosts.inForce;
  }

  /** Calls `listener` once each time the values or the problem change; returns its removal. */
  onChange(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /**
   * Reads the file again, after any read in progress. A file that cannot be read gives the
   * defaults, and its problem is printed once, until it changes.
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
    const before = JSON.stringify([this.#view, this.problem]);
    let saved: Settings | null = null;
    let problem: string | null = null;
    try {
      saved = await this.#options.binding.readSettings(this.#options.dir);
    } catch (error) {
      // The binding rejects with `<code>: <message>`, like `unreadable: Cannot read …`.
      problem = (error instanceof Error ? error.message : String(error)).replace(/^[a-z]+: /, "");
    }
    if (this.#closed) {
      return;
    }
    if (problem !== null && problem !== this.problem) {
      process.stderr.write(
        `uraeda: ${problem} The server uses its defaults until the file is fixed.\n`,
      );
    }
    this.problem = problem;
    const view = inForce(this.#options.options, saved);
    // An unchanged read keeps the view, so `allowedHosts()` keeps its array: the guard rebuilds
    // its sets only on a change.
    if (JSON.stringify([view, problem]) !== before) {
      this.#view = view;
      for (const listener of this.#listeners) {
        listener();
      }
    }
  }

  /** Stops the watch of the config folder, as the server stops. */
  close(): void {
    this.#closed = true;
    clearTimeout(this.#timer);
    this.#watch?.close();
    this.#listeners.clear();
  }
}
