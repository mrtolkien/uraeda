// The extensions host: what the server knows of its extensions. It reads them and their settings
// through the core, registers the built-ins' server parts, opens the loader for yours, and owns
// what both register through the server API: runtimes, records, actions, routes, and events, each
// only where its extension is on. It sends the `Extensions` record live as any of it changes.
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Changes, Extension } from "uraeda-binding";
import type { ApiRepository } from "../extension-api.ts";
import type { Binding } from "../fate/context.ts";
import { EXTENSIONS_ID } from "../fate/extensions.ts";
import { announceEverywhere, onSessionChange, sender } from "../live.ts";
import { layout } from "../paths.ts";
import type { Host, Hosts } from "../repositories.ts";
import type { Adapter } from "../runner/adapter.ts";
import { Runtimes } from "../runner/runtimes.ts";
import type { SessionRow } from "../runner/cache.ts";
import type { Sessions } from "../runner/sessions.ts";
import type { ServerSettings } from "../settings.ts";
import { type Registry, serverApi } from "./api.ts";
import { BUILT_IN_RUNTIMES, BuiltIns, type BuiltInDeps } from "./builtins.ts";
import { Contributions, type RecordValue } from "./contributions.ts";
import { EventBus, guarded, reportFor, StepWatch } from "./events.ts";
import { type LoadedExtension, Loader, type PageBundle, type Problem } from "./loader.ts";
import { compilePage } from "./page-compiler.ts";
import { RuntimeTurns } from "./turns.ts";

/** What `ExtensionsHost.open` takes. */
export type ExtensionsOptions = {
  /** See `BuiltInDeps.agents`; a name no built-in has is registered as is, on everywhere. */
  agents?: Record<string, Adapter>;
  binding: Binding;
  configDir: string;
  dataDir: string;
  /** Modules extensions' server code may import by name, besides `uraeda/server`: tests'. */
  modules?: Record<string, unknown>;
  /** The settings file's reads, after each of which the extensions' tables are read again. */
  settings?: Pick<ServerSettings, "onRead">;
};

/** An extension as the `Extensions` record shows it, before the settings page's own fields. */
export type ExtensionState = {
  extension: Extension;
  pageVersion: number | null;
  problems: ReadonlyArray<Problem>;
  state: LoadedExtension["state"];
  values: Record<string, unknown>;
  waitingFor: string | null;
};

const GLOBAL = "";

/** An extension whose `on`, or whose settings, changed at a read. */
type Changed = { name: string; onChanged: boolean; valuesChanged: boolean };

/**
 * The settings' print, compared between reads: every repository's, and each repository's that
 * differs, so a repository joining the list without settings of its own reloads nothing.
 */
function printOf(values: Map<string, Record<string, unknown>>): string {
  const global = JSON.stringify(values.get(GLOBAL) ?? {});
  const own = [...values].filter(
    ([key, value]) => key === GLOBAL || JSON.stringify(value) !== global,
  );
  return JSON.stringify(own);
}

/** The extensions of the server's config folder, and what they registered. */
export class ExtensionsHost implements Registry {
  readonly runtimes: Runtimes;
  readonly api: number;
  readonly #options: ExtensionsOptions;
  readonly #contributions = new Contributions();
  readonly #events: EventBus;
  readonly #steps: StepWatch;
  #folder = "";
  #extensions = new Map<string, Extension>();
  /** Each extension's settings: every repository's under "", then each repository's by name. */
  #values = new Map<string, Map<string, Record<string, unknown>>>();
  #prints = new Map<string, string>();
  readonly #builtIns: BuiltIns;
  #hosts?: Pick<Hosts, "all" | "byPath" | "get" | "rows">;
  #loader?: Loader;
  #turns?: RuntimeTurns;
  #warm: BuiltInDeps["warm"] = () => {};
  #refreshing: Promise<void> = Promise.resolve();
  #again = false;
  #stops: Array<() => void> = [];
  #closed = false;

  private constructor(options: ExtensionsOptions) {
    this.#options = options;
    this.api = options.binding.extensionApi();
    this.runtimes = new Runtimes({
      isOn: (name, root) => this.#runtimeOn(name, root),
      skills: (root) => {
        const repository = this.#hosts?.byPath(root)?.name;
        return repository === undefined ? [] : this.skillsFor(repository);
      },
      title: (name) => this.#extensions.get(name)?.title,
    });
    this.#events = new EventBus((name, repository) => this.isOn(name, repository));
    this.#steps = new StepWatch(options.binding, this.#events);
    this.#builtIns = new BuiltIns({
      agents: options.agents,
      announce: () => this.#announce(),
      dataDir: options.dataDir,
      extensionsDir: options.binding.extensionsFolder(options.configDir),
      register: (name, agent) => this.runtimes.register(name, agent),
      registry: this,
      turns: () => this.#turns,
      warm: () => this.#warm,
    });
  }

  /**
   * Reads the extensions and registers the built-ins' server parts, runtimes first: the session
   * manager starts on them. Yours load in `start`, once the repositories are open.
   */
  static async open(options: ExtensionsOptions): Promise<ExtensionsHost> {
    const host = new ExtensionsHost(options);
    await host.#read();
    host.#builtIns.registerAll(
      [...host.#extensions.values()].filter((one) => one.isBuiltIn).map((one) => one.name),
    );
    const stop = options.settings?.onRead(() => void host.refresh());
    if (stop) {
      host.#stops.push(stop);
    }
    return host;
  }

  /**
   * Opens the loader of your extensions, once the hosts and the session manager are there, and
   * delivers the sessions' events from now on. `warm` starts a feature's Storybook.
   */
  async start(deps: {
    hosts: Pick<Hosts, "all" | "byPath" | "get" | "rows">;
    sessions: Sessions;
    warm: BuiltInDeps["warm"];
  }): Promise<void> {
    this.#hosts = deps.hosts;
    this.#warm = deps.warm;
    const { sessions } = deps;
    this.#turns = new RuntimeTurns(
      sessions,
      (runtime, title) => this.#busy(runtime, title),
      () => this.#announce(),
    );
    this.#stops.push(
      onSessionChange(sessions, (change) => {
        if (!("agent" in change)) {
          this.#turns?.changed(change.session);
          this.#turnEnded(change);
        }
      }),
    );
    // After the session's insert, not inside it.
    const started = (row: SessionRow) => {
      const repository = this.#hosts?.byPath(row.repo)?.name;
      if (repository !== undefined && !this.#closed) {
        this.#events.emit("session-started", { repository, runtime: row.agent, session: row.id });
      }
    };
    this.#stops.push(sessions.cache.onCreated((row) => queueMicrotask(() => started(row))));
    // The repositories' own settings, read before your extensions load.
    await this.#read();
    const { binding, configDir, modules = {} } = this.#options;
    const tokens = layout().stylexTokens;
    this.#loader = await Loader.open({
      api: (scope) => serverApi(scope, this),
      binding,
      compilePage: (source, filename) => compilePage(source, filename, tokens),
      configDir,
      shared: { ...modules, "uraeda/server": {} },
    });
    this.#stops.push(this.#loader.onChange(() => void this.refresh()));
    await this.refresh();
  }

  /** Reads a repository's steps, as its host starts. */
  seed(host: Pick<Host, "name" | "path">): void {
    this.#steps.seed(host);
  }

  /** Forgets a repository's steps, as its host stops. */
  stopped(host: Pick<Host, "name" | "path">): void {
    this.#steps.forget(host);
  }

  /** Turns a repository's changes into events. */
  changes(host: Pick<Host, "name" | "path">, changes: Changes): void {
    void this.#steps.changes(host, changes);
  }

  /** Whether the extension is on in the repository of this name. */
  isOn(name: string, repository: string): boolean {
    const extension = this.#extensions.get(name);
    return extension !== undefined && (extension.onAll || extension.on.includes(repository));
  }

  /**
   * The skill folders sessions get in the repository of this name: the `skills/` folder of each
   * extension of yours on there, loadable on this API, as `<extensions folder>/<name>/skills`,
   * whose last folder names it. The built-ins ship no skills.
   */
  skillsFor(repository: string): Array<string> {
    const folder = this.#options.binding.extensionsFolder(this.#options.configDir);
    return [...this.#extensions.values()]
      .filter(
        (extension) =>
          !extension.isBuiltIn &&
          extension.api === this.api &&
          !extension.problems.some((problem) => problem.isFatal) &&
          this.isOn(extension.name, repository) &&
          existsSync(join(extension.folder, "skills")),
      )
      .map((extension) => join(folder, extension.name, "skills"));
  }

  /** Whether a runtime is on in the main checkout `root`, one of no extension everywhere. */
  #runtimeOn(name: string, root: string | null): boolean {
    const extension = this.#extensions.get(name);
    if (!extension || extension.onAll) {
      return true;
    }
    const repository = root === null ? undefined : this.#hosts?.byPath(root)?.name;
    return repository !== undefined && extension.on.includes(repository);
  }

  /** The repository name of a main checkout, refused when it is not listed. */
  #nameOf(root: string): string {
    const name = this.#hosts?.byPath(root)?.name;
    if (name === undefined) {
      throw new Error("refused: no repository");
    }
    return name;
  }

  /** The extensions, their states, and their settings, for the `Extensions` record. */
  states(): { api: number; docs: string; extensions: Array<ExtensionState>; folder: string } {
    const { docs } = layout();
    const extensions = [...this.#extensions.values()].map((extension) => this.#state(extension));
    return { api: this.api, docs, extensions, folder: this.#folder };
  }

  #state(extension: Extension): ExtensionState {
    const values = this.settings(extension.name, null);
    const own = extension.problems.map(({ file, line, message }) =>
      line === undefined ? { file, message } : { file, line, message },
    );
    if (extension.isBuiltIn) {
      const { name } = extension;
      const off = !extension.onAll && extension.on.length === 0;
      const unregistered = BUILT_IN_RUNTIMES.has(name) && this.runtimes.get(name) === undefined;
      const { problems, ...state } = this.#builtIns.state(name, off || unregistered);
      return { extension, pageVersion: null, problems: [...own, ...problems], values, ...state };
    }
    const loaded = this.#loader?.get(extension.name);
    // A runtime's reload waits for its sessions at work: it names the one at work now.
    const waitingFor =
      loaded?.waitingFor && (this.#turns?.busy(extension.name) ?? loaded.waitingFor);
    return {
      extension,
      pageVersion: this.#loader?.pageBundle(extension.name)?.version ?? null,
      problems: loaded?.problems ?? own,
      state: loaded?.state ?? "off",
      values,
      waitingFor: waitingFor || null,
    };
  }

  /** The page files of your extension's running version. */
  pageBundle(name: string): PageBundle | undefined {
    return this.#loader?.pageBundle(name);
  }

  /** Reads the record `<extension>/<name>` for the main checkout `root`, where it is on. */
  async readRecord(id: string, root: string): Promise<RecordValue> {
    const extension = id.split("/")[0];
    const repository = this.#hosts?.byPath(root)?.name;
    if (repository === undefined || !this.isOn(extension, repository)) {
      const where = repository ?? "this repository";
      return { error: `${extension} is off in ${where}`, id, value: "null" };
    }
    return this.#contributions.read(id, repository);
  }

  /** Runs an action in the main checkout `root`: refused where its extension is off. */
  act(extension: string, name: string, inputJson: string, root: string): Promise<string> {
    const repository = this.#nameOf(root);
    if (!this.isOn(extension, repository)) {
      throw new Error(`refused: ${extension} is off in ${repository}`);
    }
    return this.#contributions.act(extension, name, inputJson, repository);
  }

  /** Answers a route of the extension, in a repository by name or globally. */
  async answer(
    c: Parameters<Contributions["answer"]>[0],
    extension: string,
    path: string,
    repository: string | null,
  ): Promise<Response> {
    if (repository !== null && !this.isOn(extension, repository)) {
      return c.text(`${extension} is off in ${repository}`, 404);
    }
    const answered = await this.#contributions.answer(c, extension, path, repository);
    return answered ?? c.text(`${extension} has no route ${path}`, 404);
  }

  // The registry the server API registers into.

  addRuntime(extension: string, runtime: Adapter): () => void {
    return this.runtimes.register(extension, runtime);
  }

  addRecord(extension: string, name: string, read: (repository: string) => unknown) {
    return this.#contributions.addRecord(extension, name, read);
  }

  addAction(extension: string, name: string, run: (input: unknown, repository: string) => unknown) {
    return this.#contributions.addAction(extension, name, run);
  }

  addRoute(extension: string, route: Parameters<Contributions["addRoute"]>[1]) {
    return this.#contributions.addRoute(extension, route);
  }

  on: Registry["on"] = (extension, event, handler) => this.#events.on(extension, event, handler);

  changed(extension: string, name: string, repository?: string): void {
    const hosts =
      repository === undefined
        ? (this.#hosts?.all() ?? [])
        : [this.#hosts?.get(repository)].filter((host) => host !== undefined);
    for (const host of hosts) {
      sender(host.live)("ExtensionRecord", `${extension}/${name}`);
    }
  }

  repositories(extension: string): ReadonlyArray<ApiRepository> {
    return (this.#hosts?.rows() ?? [])
      .filter((row) => this.isOn(extension, row.name))
      .map(({ name, path }) => ({ name, path }));
  }

  /** The extension's settings in a repository, none where it is off, or every repository's. */
  settings(extension: string, repository: string | null): Record<string, unknown> {
    if (repository !== null && !this.isOn(extension, repository)) {
      return {};
    }
    const values = this.#values.get(extension);
    return { ...(values?.get(repository ?? GLOBAL) ?? values?.get(GLOBAL) ?? {}) };
  }

  // Reading, and what a change of the settings reloads.

  /**
   * Reads the extensions and their settings again, after any read in progress: an extension
   * whose `on` or settings changed reloads, a runtime's after its turns end, and the `Extensions`
   * record is sent.
   */
  refresh(): Promise<void> {
    if (this.#again) {
      return this.#refreshing;
    }
    this.#again = true;
    this.#refreshing = this.#refreshing.then(async () => {
      this.#again = false;
      if (this.#closed) {
        return;
      }
      try {
        this.#reloadChanged(await this.#read());
      } catch (error) {
        reportFor("extensions", error);
      }
      this.#announce();
    });
    return this.#refreshing;
  }

  /** Reads the extensions and their settings: gives the names whose `on` or settings changed. */
  async #read(): Promise<Array<Changed>> {
    const { binding, configDir } = this.#options;
    const { extensions, folder } = await binding.readExtensions(configDir);
    const repositories = (this.#hosts?.rows() ?? []).map((row) => row.name);
    const values = new Map<string, Map<string, Record<string, unknown>>>();
    for (const extension of extensions) {
      const byRepository = new Map<string, Record<string, unknown>>();
      if (extension.settings.length > 0) {
        for (const repository of [GLOBAL, ...repositories]) {
          const json = await binding.extensionSettings(
            configDir,
            extension.name,
            repository || null,
          );
          byRepository.set(repository, JSON.parse(json) as Record<string, unknown>);
        }
      }
      values.set(extension.name, byRepository);
    }
    const changed = [];
    const before = this.#extensions;
    for (const extension of extensions) {
      const print = printOf(values.get(extension.name)!);
      const old = before.get(extension.name);
      const onChanged =
        old !== undefined && (old.onAll !== extension.onAll || `${old.on}` !== `${extension.on}`);
      const known = this.#prints.get(extension.name);
      const valuesChanged = known !== undefined && known !== print;
      if (onChanged || valuesChanged) {
        changed.push({ name: extension.name, onChanged, valuesChanged });
      }
      this.#prints.set(extension.name, print);
    }
    this.#folder = folder;
    this.#extensions = new Map(extensions.map((extension) => [extension.name, extension]));
    this.#values = values;
    return changed;
  }

  #reloadChanged(changed: Array<Changed>): void {
    let runtimes = false;
    for (const { name, onChanged, valuesChanged } of changed) {
      runtimes ||= onChanged && this.runtimes.get(name) !== undefined;
      for (const record of this.#contributions.records(name)) {
        this.changed(name, record);
      }
      const extension = this.#extensions.get(name)!;
      if (!extension.isBuiltIn) {
        void this.#loader?.reload(name).catch((error: unknown) => reportFor(name, error));
      } else if (valuesChanged) {
        this.#builtIns.reload(name);
      }
    }
    if (runtimes) {
      this.runtimes.changed();
    }
  }

  /** A runtime of yours got a session at work: its reloads wait until the turns end. */
  #busy(runtime: string, title: string): void {
    const extension = this.#extensions.get(runtime);
    if (extension && !extension.isBuiltIn && this.#turns) {
      this.#loader?.defer(runtime, this.#turns.idle(runtime), title);
    }
  }

  /** Sends `turn-ended` for a change that ends a turn. */
  #turnEnded(change: { folder: string | null; repo: string; session: string; state?: string }) {
    const { state } = change;
    if (state !== "done" && state !== "failed" && state !== "stopped") {
      return;
    }
    const repository = this.#hosts?.byPath(change.repo)?.name;
    if (repository !== undefined) {
      this.#events.emit("turn-ended", {
        feature: change.folder,
        repository,
        session: change.session,
        state,
      });
    }
  }

  /** Sends the `Extensions` record on every bus. */
  #announce(): void {
    if (this.#hosts) {
      guarded("extensions", () => announceEverywhere(this.#hosts!, "Extensions", EXTENSIONS_ID));
    }
  }

  /** Unloads every extension, built-in or yours, and stops the watches, as the server stops. */
  close(): void {
    this.#closed = true;
    this.#stops.splice(0).forEach((stop) => stop());
    this.#loader?.close();
    this.#turns?.close();
    this.#builtIns.close();
  }
}
