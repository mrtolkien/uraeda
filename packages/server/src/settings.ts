// The server's settings in force: each from its flag, its variable, the settings file, then its
// default, the file read through the core and watched while the server runs.
import type { RunSettings, Settings } from "uraeda-binding";
import type {
  CatchUpName,
  ContinuesName,
  Given,
  GivenName,
  LimitName,
  PortName,
  RestartName,
  Switch,
} from "./env.ts";
import type { Binding } from "./fate/context.ts";
import type { Options } from "./options.ts";
import { LIST_QUIET_MS } from "./repositories.ts";
import { FileWatch } from "./settings-watch.ts";

/** The port the server listens on when no flag, variable, or file gives one. */
export const DEFAULT_PORT = 4310;

/** The automatic continues in a row when no flag, variable, or file gives them. */
export const DEFAULT_AUTOMATIC_CONTINUES = 3;

/** The settings file's name, in the config folder. */
const FILE = "config.toml";

/** Where a setting's value in force comes from. */
export type Source =
  | { kind: "default" }
  | { kind: "file" }
  | { kind: "flag"; name: Extract<GivenName, `--${string}`> | "--no-open" }
  | { kind: "environment"; name: Exclude<GivenName, `--${string}`> };

/** A setting: its value in force, the file's value, null when the file has none, and its source. */
export type Setting<T> = { inForce: T; saved: T | null; source: Source };

/** The server's settings, as the server applies them. */
export type ServerSettingsView = {
  allowedHosts: Setting<Array<string>>;
  openBrowser: Setting<boolean>;
  port: Setting<number>;
};

/**
 * How the workflow's runs start and go on: the default of the run after a spec's approval, the
 * switch of each kind of automatic continue, the automatic continues in a row, and the switch of
 * the catch-up of open pull requests.
 */
export type RunSettingsView = {
  automaticContinues: Setting<number>;
  buildInFreshSession: Setting<boolean>;
  catchUpPullRequests: Setting<boolean>;
  continueAfterLimit: Setting<boolean>;
  continueAfterRestart: Setting<boolean>;
};

/**
 * How the web UI's keys behave: whether the keys of one printable character act, whether the text
 * fields edit with Vim's keys, and the lines of Vim's commands run when Vim starts.
 */
export type KeyboardSettingsView = {
  singleKeyShortcuts: Setting<boolean>;
  vimCommands: Setting<Array<string>>;
  vimMode: Setting<boolean>;
};

/** Every setting in force, by the file's table. */
export type SettingsView = {
  keyboard: KeyboardSettingsView;
  runs: RunSettingsView;
  server: ServerSettingsView;
};

/** The source of a value given for this run, by the name of its flag or variable. */
function givenSource({ name }: Given<unknown, GivenName>): Source {
  return name.startsWith("--")
    ? { kind: "flag", name: name as Extract<GivenName, `--${string}`> }
    : { kind: "environment", name: name as Exclude<GivenName, `--${string}`> };
}

/** A setting from the value given for this run, else the file's, else the default. */
function setting<T>(
  given: Given<T, GivenName> | undefined,
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

/**
 * The values given for this run, as `options.ts` reports them: the port, the automatic continues,
 * and the switches' variables as typed.
 */
export type GivenValues = Pick<
  Options,
  | "allowedHosts"
  | "automaticContinues"
  | "catchUpPullRequests"
  | "continueAfterLimit"
  | "continueAfterRestart"
  | "noOpen"
  | "port"
>;

/** The values given for this run, the port, the automatic continues, and the switches checked. */
export type RunValues = Omit<
  GivenValues,
  | "automaticContinues"
  | "catchUpPullRequests"
  | "continueAfterLimit"
  | "continueAfterRestart"
  | "port"
> & {
  automaticContinues?: Given<number, ContinuesName>;
  catchUpPullRequests?: Given<boolean, CatchUpName>;
  continueAfterLimit?: Given<boolean, LimitName>;
  continueAfterRestart?: Given<boolean, RestartName>;
  port?: Given<number, PortName>;
};

/** The core's rules for the numbers given as typed, each throwing its problem. */
export type Checks = {
  checkedAutomaticContinues: (typed: string) => number;
  checkedPort: (typed: string) => number;
};

/**
 * A switch given for this run: a flag's value, or its variable's `true` or `false`, trimmed;
 * throws `<name> is true or false.` for a variable that is neither (R13).
 */
function checkedSwitch<N extends string>(
  given: Switch<N> | undefined,
): Given<boolean, N> | undefined {
  if (given === undefined || typeof given.value === "boolean") {
    return given as Given<boolean, N> | undefined;
  }
  const typed = given.value.trim();
  if (typed !== "true" && typed !== "false") {
    throw new Error(`${given.name} is true or false.`);
  }
  return { name: given.name, value: typed === "true" };
}

/**
 * The values given for this run, each number checked by the core's rule, which throws its
 * problem, like `The port is a number from 1 to 65535.`, for a value out of it, and each switch's
 * variable read as true or false.
 */
export function checked(given: GivenValues, checks: Checks): RunValues {
  const { automaticContinues, port, ...rest } = given;
  const { catchUpPullRequests, continueAfterLimit, continueAfterRestart, ...others } = rest;
  const catchUp = checkedSwitch(catchUpPullRequests);
  const limit = checkedSwitch(continueAfterLimit);
  const restart = checkedSwitch(continueAfterRestart);
  return {
    ...others,
    ...(catchUp && { catchUpPullRequests: catchUp }),
    ...(limit && { continueAfterLimit: limit }),
    ...(restart && { continueAfterRestart: restart }),
    ...(port && { port: { ...port, value: checks.checkedPort(port.value) } }),
    ...(automaticContinues && {
      automaticContinues: {
        ...automaticContinues,
        value: checks.checkedAutomaticContinues(automaticContinues.value),
      },
    }),
  };
}

/**
 * The values in force, the one place of their order: the flag, the variable, the file, then the
 * default: no host names, port 4310, a browser opened, every automatic continue on, 3 in a row, no
 * catch-up of open pull requests, and the build in a fresh session, the single-key shortcuts on,
 * and Vim off without commands, which have no flag or variable. `file` is null when there is none,
 * or it cannot be read.
 */
export function inForce(options: RunValues, file: Settings | null): SettingsView {
  const saved = file?.server ?? {};
  const runs: Partial<RunSettings> = file?.runs ?? {};
  const openBrowser = setting(undefined, saved.openBrowser, true);
  return {
    keyboard: {
      singleKeyShortcuts: setting(undefined, file?.keyboard.singleKeyShortcuts, true),
      vimCommands: setting(undefined, file?.keyboard.vimCommands, []),
      vimMode: setting(undefined, file?.keyboard.vimMode, false),
    },
    runs: {
      automaticContinues: setting(
        options.automaticContinues,
        runs.automaticContinues,
        DEFAULT_AUTOMATIC_CONTINUES,
      ),
      buildInFreshSession: setting(undefined, runs.buildInFreshSession, true),
      catchUpPullRequests: setting(options.catchUpPullRequests, runs.catchUpPullRequests, false),
      continueAfterLimit: setting(options.continueAfterLimit, runs.continueAfterLimit, true),
      continueAfterRestart: setting(options.continueAfterRestart, runs.continueAfterRestart, true),
    },
    server: {
      allowedHosts: setting(options.allowedHosts, saved.allowedHosts, []),
      openBrowser: options.noOpen
        ? { ...openBrowser, inForce: false, source: { kind: "flag", name: "--no-open" } }
        : openBrowser,
      port: setting(options.port, saved.port, DEFAULT_PORT),
    },
  };
}

/** What `ServerSettings.open` takes: the binding, the config folder, and the run's options. */
type SettingsOptions = {
  binding: Pick<
    Binding,
    "checkedAutomaticContinues" | "checkedPort" | "readSettings" | "settingsFile"
  >;
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
  #view: SettingsView;
  #listeners = new Set<() => void>();
  #readers = new Set<() => void>();
  #reloading: Promise<void> = Promise.resolve();
  #watch?: FileWatch;
  #timer?: ReturnType<typeof setTimeout>;
  #closed = false;

  private constructor({ options, ...rest }: SettingsOptions) {
    this.#options = rest;
    this.dir = rest.dir;
    this.#given = checked(options, rest.binding);
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

  /** The server's values in force, and the file's. */
  view(): ServerSettingsView {
    return this.#view.server;
  }

  /** The keyboard's values in force, and the file's. */
  keyboard(): KeyboardSettingsView {
    return this.#view.keyboard;
  }

  /** The runs' values in force, and the file's. */
  runs(): RunSettingsView {
    return this.#view.runs;
  }

  /**
   * The host names in force, besides 127.0.0.1 and localhost: the same array until they, or
   * another value in force, change.
   */
  allowedHosts(): ReadonlyArray<string> {
    return this.#view.server.allowedHosts.inForce;
  }

  /** Calls `listener` once each time the values or the problem change; returns its removal. */
  onChange(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /**
   * Calls `listener` after each read of the file, changed or not, as the extensions' tables are
   * read apart from the values here; returns its removal.
   */
  onRead(listener: () => void): () => void {
    this.#readers.add(listener);
    return () => this.#readers.delete(listener);
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
      this.#tell(this.#listeners);
    }
    this.#tell(this.#readers);
  }

  /** Calls each listener: one that throws is printed, and the others are still called. */
  #tell(listeners: Set<() => void>): void {
    for (const listener of listeners) {
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
    this.#readers.clear();
  }
}
