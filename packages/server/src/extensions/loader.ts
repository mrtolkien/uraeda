// The loader: the authoritative state of every extension in the server. It reads the extensions of
// the config folder through the core, watches `<config>/extensions/` and each extension's folder,
// compiles each version's server and page files, evaluates the server code under a timeout, and
// unloads the previous version, every registration undone, before the next one runs. It reads no
// other path: never a repository's files. Built-in extensions are listed but never evaluated
// here: their code is Uraeda's, registered by the server.
import { basename, dirname, join } from "node:path";
import type { Extension } from "uraeda-binding";
import type { Binding } from "../fate/context.ts";
import { FileWatch } from "../settings-watch.ts";
import { evaluate, failure } from "./evaluate.ts";
import { backstop, scopedTimers } from "./faults.ts";
import { compileVersion, type PageCompiler, type Problem } from "./graph.ts";
import { Scope } from "./scope.ts";

export type { PageCompiler, Problem } from "./graph.ts";

/** How long the loader waits for a quiet moment after a change before it reads again. */
const RELOAD_QUIET_MS = 50;

/** What `Loader.open` takes. */
export type LoaderOptions = {
  /** The server API one version of an extension gets, scoped to it. */
  api: (scope: Scope) => object;
  binding: Pick<Binding, "compileModule" | "extensionApi" | "extensionsFolder" | "readExtensions">;
  compilePage: PageCompiler;
  configDir: string;
  /** The modules extensions' server code imports by name. */
  shared: Record<string, unknown>;
};

/** An extension as the loader holds it now. */
export type LoadedExtension = {
  extension: Extension;
  problems: ReadonlyArray<Problem>;
  state: "on" | "off" | "broken" | "waiting";
  /** How many versions were evaluated, the last the one running when the state is `on`. */
  version: number;
  /** What a reload waits for, while the state is `waiting`. */
  waitingFor?: string;
};

/** An extension's page files, compiled, by their path in its folder; their CSS joined. */
export type PageBundle = {
  css: string;
  entry: string;
  modules: Record<string, string>;
  version: number;
};

/** One extension's state and the work on it. */
type Entry = {
  again: boolean;
  deferrals: Map<Promise<void>, string | undefined>;
  /** Breaks the running version with what it threw after it loaded. */
  fail?: (error: unknown) => void;
  /** The files of the last version that compiled, whose folders are watched. */
  files: ReadonlyArray<string>;
  loaded: LoadedExtension;
  /** The loop of loads running now, which a reload asked meanwhile also waits for. */
  loop?: Promise<void>;
  page?: PageBundle;
  scope?: Scope;
  timer?: ReturnType<typeof setTimeout>;
  watched: string;
  watches: Array<FileWatch>;
};

/** Prints a failure of the loader itself, which must not stop the server. */
function report(error: unknown): void {
  process.stderr.write(`uraeda: ${error instanceof Error ? error.message : String(error)}\n`);
}

/** The core's problem as the loader shows it. */
function problemOf({ file, line, message }: Extension["problems"][number]): Problem {
  return line === undefined ? { file, message } : { file, line, message };
}

/** Whether the extension is on in no repository. */
function offEverywhere(extension: Extension): boolean {
  return !extension.onAll && extension.on.length === 0;
}

/**
 * The extensions of one config folder: read at open, and again on every change of its extensions
 * folder and of each extension's folder, links followed. An extension reloads after a quiet
 * moment, one compile at a time; a change during a compile queues one more, of the latest files.
 */
export class Loader {
  readonly #options: LoaderOptions;
  #entries = new Map<string, Entry>();
  readonly #listeners = new Set<(name: string) => void>();
  #watch?: FileWatch;
  #scanTimer?: ReturnType<typeof setTimeout>;
  #scanning: Promise<void> = Promise.resolve();
  #closed = false;
  #unbackstop?: () => void;

  private constructor(options: LoaderOptions) {
    this.#options = options;
  }

  /** The loader of `configDir`'s extensions, each loaded once, in the core's order. */
  static async open(options: LoaderOptions): Promise<Loader> {
    const loader = new Loader(options);
    loader.#unbackstop = backstop((error) => loader.#claim(error));
    const folder = options.binding.extensionsFolder(options.configDir);
    loader.#watch = new FileWatch(dirname(folder), basename(folder), () => loader.#rescan(), {
      folder: true,
      what: "the extensions",
    });
    await loader.#scan(true);
    return loader;
  }

  /** Every extension, the built-in ones first, as the core lists them. */
  list(): ReadonlyArray<LoadedExtension> {
    return [...this.#entries.values()].map((entry) => entry.loaded);
  }

  get(name: string): LoadedExtension | undefined {
    return this.#entries.get(name)?.loaded;
  }

  /** Calls `listener` with an extension's name after each load, unload, or problem of it. */
  onChange(listener: (name: string) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** The page files of the extension's running version, when it has a page. */
  pageBundle(name: string): PageBundle | undefined {
    return this.#entries.get(name)?.page;
  }

  /**
   * Makes the next reloads of the extension `name` wait until `until` settles, its state
   * `waiting` meanwhile, with `waitingFor` saying what for.
   */
  defer(name: string, until: Promise<void>, waitingFor?: string): void {
    const entry = this.#entries.get(name);
    if (!entry) {
      return;
    }
    entry.deferrals.set(until, waitingFor);
    const done = () => entry.deferrals.delete(until);
    until.then(done, done);
  }

  /** Reads and loads the extension `name` again, after any load of it in progress. */
  reload(name: string): Promise<void> {
    return this.#reload(name);
  }

  /** Stops every watch, and unloads every extension, as the server stops. */
  close(): void {
    this.#closed = true;
    this.#unbackstop?.();
    clearTimeout(this.#scanTimer);
    this.#watch?.close();
    for (const entry of this.#entries.values()) {
      clearTimeout(entry.timer);
      this.#unwatch(entry);
      this.#stop(entry);
    }
    this.#listeners.clear();
  }

  /** Reads the extensions again after a quiet moment, as the extensions folder changed. */
  #rescan(): void {
    clearTimeout(this.#scanTimer);
    this.#scanTimer = setTimeout(() => {
      this.#scanning = this.#scanning.then(() => this.#scan(false)).catch(report);
    }, RELOAD_QUIET_MS);
  }

  /**
   * Reads the extensions: a new one, or one whose manifest or settings changed, loads; one gone
   * unloads. At open, each loads in turn before `open` returns.
   */
  async #scan(initial: boolean): Promise<void> {
    if (this.#closed) {
      return;
    }
    this.#watch?.refresh();
    const { extensions } = await this.#options.binding.readExtensions(this.#options.configDir);
    const before = this.#entries;
    this.#entries = new Map();
    const changed: Array<Extension> = [];
    for (const extension of extensions) {
      const entry = before.get(extension.name) ?? this.#entry(extension);
      this.#entries.set(extension.name, entry);
      if (
        !before.has(extension.name) ||
        JSON.stringify(entry.loaded.extension) !== JSON.stringify(extension)
      ) {
        changed.push(extension);
      }
    }
    for (const [name, entry] of before) {
      if (!this.#entries.has(name)) {
        this.#remove(name, entry);
      }
    }
    for (const extension of changed) {
      if (extension.isBuiltIn) {
        this.#builtIn(extension);
      } else if (initial) {
        await this.#reload(extension.name, extension).catch(report);
      } else {
        this.#schedule(extension.name);
      }
    }
  }

  /** A new entry for `extension`, nothing loaded yet. */
  #entry(extension: Extension): Entry {
    return {
      again: false,
      deferrals: new Map(),
      files: [],
      loaded: { extension, problems: [], state: "off", version: 0 },
      watched: "",
      watches: [],
    };
  }

  /** Lists a built-in extension, on or off, never evaluated here. */
  #builtIn(extension: Extension): void {
    const entry = this.#entries.get(extension.name);
    if (entry) {
      this.#set(
        entry,
        extension,
        offEverywhere(extension) ? "off" : "on",
        extension.problems.map(problemOf),
      );
    }
  }

  /** Reloads the extension `name` after a quiet moment. */
  #schedule(name: string): void {
    const entry = this.#entries.get(name);
    if (!entry || this.#closed) {
      return;
    }
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => void this.#reload(name).catch(report), RELOAD_QUIET_MS);
  }

  /**
   * Loads the extension `name`, `known` as just read, else read again; while a load of it runs,
   * queues exactly one more, which reads the latest files, and gives the running loop, which
   * settles after it.
   */
  #reload(name: string, known?: Extension): Promise<void> {
    const entry = this.#entries.get(name);
    if (!entry || entry.loaded.extension.isBuiltIn) {
      return Promise.resolve();
    }
    if (entry.loop) {
      entry.again = true;
      return entry.loop;
    }
    entry.loop = this.#loop(name, entry, known);
    return entry.loop;
  }

  /** Loads the entry's extension until no load is queued; clears `entry.loop` as it ends. */
  async #loop(name: string, entry: Entry, known?: Extension): Promise<void> {
    try {
      let extension = known;
      do {
        entry.again = false;
        await this.#waitFor(entry);
        extension ??= await this.#read(name);
        if (this.#closed || this.#entries.get(name) !== entry) {
          return;
        }
        if (extension === undefined) {
          // Gone from the folder: the scan that follows removes it.
          this.#rescan();
          return;
        }
        this.#load(entry, extension);
        extension = undefined;
      } while (entry.again && !this.#closed);
    } finally {
      entry.loop = undefined;
    }
  }

  /** The extension `name` as the core reads it now, or undefined when it is gone. */
  async #read(name: string): Promise<Extension | undefined> {
    const { extensions } = await this.#options.binding.readExtensions(this.#options.configDir);
    return extensions.find((extension) => extension.name === name && !extension.isBuiltIn);
  }

  /** Waits until every deferral of the entry settles, its state `waiting` meanwhile. */
  async #waitFor(entry: Entry): Promise<void> {
    while (entry.deferrals.size > 0 && !this.#closed) {
      const [waitingFor] = entry.deferrals.values();
      const { extension, problems } = entry.loaded;
      this.#set(entry, extension, "waiting", problems, entry.loaded.version, waitingFor);
      await Promise.allSettled(entry.deferrals.keys());
    }
  }

  /**
   * Loads one version of `extension`: off or broken by its manifest, else compiled, and on a
   * compile problem the running version kept; else the running version unloaded, then the new
   * one evaluated, synchronously, and unloaded again when it throws.
   */
  #load(entry: Entry, extension: Extension): void {
    const problems = extension.problems.map(problemOf);
    const api = this.#options.binding.extensionApi();
    if (extension.problems.some((problem) => problem.isFatal)) {
      this.#unwatch(entry);
      this.#stop(entry);
      this.#set(entry, extension, "broken", problems);
      return;
    }
    if (extension.api !== api || offEverywhere(extension)) {
      this.#watchFolder(entry, extension, entry.files);
      this.#stop(entry);
      const message = `built for extension API ${extension.api}, and Uraeda runs API ${api}`;
      const why = extension.api === api ? [] : [{ file: "extension.toml", message }];
      this.#set(entry, extension, "off", [...problems, ...why]);
      return;
    }
    const { binding, compilePage, shared } = this.#options;
    const compiled = compileVersion(extension, {
      compileModule: binding.compileModule,
      compilePage,
      shared,
    });
    if ("problems" in compiled) {
      // The working version's files and the files at fault, so a fix of either reloads.
      const faulty = compiled.problems.map((problem) => problem.file);
      this.#watchFolder(entry, extension, [...entry.files, ...faulty]);
      const state = entry.scope?.isLive() ? "on" : "broken";
      this.#set(entry, extension, state, [...problems, ...compiled.problems]);
      return;
    }
    const files = [
      ...(compiled.server?.files.keys() ?? []),
      ...Object.keys(compiled.page?.modules ?? {}),
    ];
    entry.files = files;
    this.#watchFolder(entry, extension, files);
    this.#stop(entry);
    const version = entry.loaded.version + 1;
    const scope = new Scope(extension.name);
    const graph = compiled.server ?? { entry: "", folder: extension.folder };
    const fail = (error: unknown) => {
      if (entry.scope === scope) {
        this.#stop(entry);
        this.#set(entry, extension, "broken", [...problems, failure(error, graph)]);
      }
    };
    try {
      if (compiled.server) {
        const { api, shared } = this.#options;
        evaluate(compiled.server, { api: api(scope), globals: scopedTimers(scope, fail), shared });
      }
    } catch (error) {
      scope.unload();
      this.#set(entry, extension, "broken", [...problems, failure(error, graph)], version);
      return;
    }
    if (this.#closed || this.#entries.get(extension.name) !== entry) {
      // Removed, or the loader closed, while it loaded: nothing of it stays.
      scope.unload();
      return;
    }
    entry.scope = scope;
    entry.fail = fail;
    entry.page = compiled.page && { ...compiled.page, version };
    this.#set(entry, extension, "on", problems, version);
  }

  /**
   * Watches what a change of the extension shows in: a linked folder and the folders of its
   * `files`, an installed one's `.ura-source`, which `ura extension update` rewrites.
   */
  #watchFolder(entry: Entry, extension: Extension, files: ReadonlyArray<string>): void {
    const folders = extension.isLinked
      ? [...new Set(["", ...files.map((file) => dirname(file)).filter((folder) => folder !== ".")])]
      : [];
    const watched = JSON.stringify([extension.folder, extension.isLinked, folders]);
    if (watched === entry.watched) {
      return;
    }
    this.#unwatch(entry);
    entry.watched = watched;
    const changed = () => {
      // A folder deleted and made again is a new one: follow it, or its saves go unseen.
      for (const watch of entry.watches) {
        watch.refresh();
      }
      this.#schedule(extension.name);
    };
    if (!extension.isLinked) {
      entry.watches = [
        new FileWatch(extension.folder, ".ura-source", changed, { what: extension.name }),
      ];
      return;
    }
    entry.watches = folders.map((folder) => {
      const path = join(extension.folder, folder);
      return new FileWatch(dirname(path), basename(path), changed, {
        folder: true,
        what: extension.name,
      });
    });
  }

  #unwatch(entry: Entry): void {
    for (const watch of entry.watches) {
      watch.close();
    }
    entry.watches = [];
    entry.watched = "";
  }

  /**
   * Takes an error the process did not handle when its stack names the folder of an extension
   * with a running version: that version breaks with it and unloads.
   */
  #claim(error: unknown): boolean {
    const stack = error instanceof Error ? (error.stack ?? "") : "";
    for (const entry of this.#entries.values()) {
      if (entry.fail && stack.includes(`${entry.loaded.extension.folder}/`)) {
        entry.fail(error);
        return true;
      }
    }
    return false;
  }

  /** Unloads the entry's running version, every registration undone, and drops its page. */
  #stop(entry: Entry): void {
    entry.scope?.unload();
    entry.scope = undefined;
    entry.fail = undefined;
    entry.page = undefined;
  }

  /** Forgets an extension gone from the folder, its version unloaded. */
  #remove(name: string, entry: Entry): void {
    clearTimeout(entry.timer);
    this.#unwatch(entry);
    this.#stop(entry);
    this.#tell(name);
  }

  #set(
    entry: Entry,
    extension: Extension,
    state: LoadedExtension["state"],
    problems: ReadonlyArray<Problem>,
    version = entry.loaded.version,
    waitingFor?: string,
  ): void {
    entry.loaded =
      waitingFor === undefined
        ? { extension, problems, state, version }
        : { extension, problems, state, version, waitingFor };
    this.#tell(extension.name);
  }

  /** Calls each listener: one that throws is printed, and the others are still called. */
  #tell(name: string): void {
    for (const listener of this.#listeners) {
      try {
        listener(name);
      } catch (error) {
        report(error);
      }
    }
  }
}
