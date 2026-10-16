// The server's settings in force: each from its flag, its variable, the settings file, then its
// default, the file read through the core and watched while the server runs.
import type { Settings } from "uraeda-binding";
import type { Given, HostsName, PortName } from "./env.ts";
import type { Binding } from "./fate/context.ts";
import type { Options } from "./options.ts";
import { LIST_QUIET_MS } from "./repositories.ts";
import { FileWatch } from "./settings-watch.ts";

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

/** The source of a value given for this run, by the name of its flag or variable. */
function givenSource({ name }: Given<unknown, HostsName | PortName>): Source {
  return name === "--allowed-hosts" || name === "--port"
    ? { kind: "flag", name }
    : { kind: "environment", name };
}

/** A setting from the value given for this run, else the file's, else the default. */
function setting<T>(
  given: Given<T, HostsName | PortName> | undefined,
  saved: T | undefined,
  fallback: T,
): Setting<T> {
  const kept = saved ?? null;
  if (given !== undefined) {
    return { inForce: given.value, saved: kept, source: givenSource(given) };
  }
  return kept === null
    ? { inForce: fallback, saved: null, source: { kind: "default" } }
    : { inForce: kept, saved: kept, source: { kind: "file" } };
}

/** The values given for this run, as `options.ts` reports them: the port as typed. */
export type GivenValues = Pick<Options, "allowedHosts" | "noOpen" | "port">;

/** The values given for this run, the port checked. */
export type RunValues = Omit<GivenValues, "port"> & { port?: Given<number, PortName> };

/**
 * The values given for this run, the port checked by the core's rule, `check`, which throws its
 * problem, `The port is a number from 1 to 65535.`, for a port that is not one.
 */
export function checked(given: GivenValues, check: (typed: string) => number): RunValues {
  const { port, ...rest } = given;
  return port === undefined ? rest : { ...rest, port: { ...port, value: check(port.value) } };
}

/**
 * The values in force, the one place of their order: the flag, the variable, the file, then the
 * default: no host names, port 4310, a browser opened. `file` is null when there is none, or it
 * cannot be read.
 */
export function inForce(options: RunValues, file: Settings | null): ServerSettingsView {
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

/** What `ServerSettings.open` takes: the binding, the config folder, and the run's options. */
type SettingsOptions = {
  binding: Pick<Binding, "checkedPort" | "readSettings" | "settingsFile">;
  dir: string;
  options: GivenValues;
};

/**
 * The server's settings in force, the only reader of the settings file for the running server:
 * the file read at start and again on each change, after a quiet moment, its problem kept when it
 * cannot be read, the defaults applying meanwhile.
 */
export class ServerSettings {
  /** The config folder, the settings file's, which the page's changes write. */
  readonly dir: string;
  /** The settings file, with `~` for the home folder. */
  readonly file: string;
  /** Why the file could not be read at the last read, or null when it was, or there is none. */
  problem: string | null = null;
  readonly #options: Omit<SettingsOptions, "options">;
  readonly #given: RunValues;
  #view: ServerSettingsView;
  #listeners = new Set<() => void>();
  #reloading: Promise<void> = Promise.resolve();
  #watch?: FileWatch;
  #timer?: ReturnType<typeof setTimeout>;
  #closed = false;

  private constructor({ options, ...rest }: SettingsOptions) {
    this.#options = rest;
    this.dir = rest.dir;
    this.#given = checked(options, rest.binding.checkedPort);
    this.file = rest.binding.settingsFile(rest.dir);
    this.#view = inForce(this.#given, null);
  }

  /**
   * The settings of the config folder `dir`: its file read once, then watched, a folder that does
   * not exist yet watched from the nearest one above it. `close` stops the watch. Throws the port's
   * problem when the port given for this run is not one.
   */
  static async open(options: SettingsOptions): Promise<ServerSettings> {
    const settings = new ServerSettings(options);
    settings.#watch = new FileWatch(options.dir, FILE, () => {
      clearTimeout(settings.#timer);
      settings.#timer = setTimeout(() => void settings.reload(), LIST_QUIET_MS);
    });
    await settings.reload();
    return settings;
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
    // The folders to watch may have changed: made, deleted, or a symlink pointed elsewhere.
    this.#watch?.refresh();
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
    const view = inForce(this.#given, saved);
    // An unchanged read keeps the view, so `allowedHosts()` keeps its array: the guard rebuilds
    // its sets only on a change.
    if (JSON.stringify([view, problem]) !== before) {
      this.#view = view;
      this.#tell();
    }
  }

  /** Calls each listener: one that throws is printed, and the others are still called. */
  #tell(): void {
    for (const listener of this.#listeners) {
      try {
        listener();
      } catch (error) {
        process.stderr.write(`uraeda: ${error instanceof Error ? error.message : String(error)}\n`);
      }
    }
  }

  /** Stops the watches of the settings file, as the server stops. */
  close(): void {
    this.#closed = true;
    clearTimeout(this.#timer);
    this.#watch?.close();
    this.#listeners.clear();
  }
}
