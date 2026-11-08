// The built-in extensions' server parts, registered through the same server API as yours: Claude
// Code's runtime, the fake agent's for tests and the sandbox, and the Storybook warmer of previews.
// The inbox, priorities, decisions, git, and notifications have no server part: their data stays
// in Uraeda's static fate views (R5).
import { chatImages } from "../attach.ts";
import type { ServerApi } from "../extension-api.ts";
import { layout } from "../paths.ts";
import type { Adapter } from "../runner/adapter.ts";
import { ClaudeAdapter } from "../runner/claude.ts";
import { type Registry, serverApi } from "./api.ts";
import { reportFor } from "./events.ts";
import type { Problem } from "./loader.ts";
import { Scope } from "./scope.ts";
import type { RuntimeTurns } from "./turns.ts";

/** What the built-ins' server parts need besides their API. */
export type BuiltInDeps = {
  /**
   * The agents the runtimes run on instead of the real ones, by runtime name: tests' and the
   * sandbox's. When given, a built-in runtime missing from it registers nothing.
   */
  agents?: Record<string, Adapter>;
  dataDir: string;
  /** Starts the Storybook of a repository's feature, by the repository's name. */
  warm: (repository: string, folder: string) => void;
};

/** The built-ins that register a runtime: their reload waits for their sessions' turns. */
export const BUILT_IN_RUNTIMES = new Set(["claude", "fake"]);

/** The command Claude Code's sessions run, from its `command` setting. */
function claudeCommand(api: ServerApi): string {
  const command = api.settings(null).command;
  return typeof command === "string" && command !== "" ? command : "claude";
}

/** Each built-in's server part, by its name. */
export const BUILT_IN_SERVER: Record<string, (api: ServerApi, deps: BuiltInDeps) => void> = {
  claude: (api, { agents, dataDir }) => {
    const adapter = agents
      ? agents.claude
      : new ClaudeAdapter({
          command: claudeCommand(api),
          imagesDir: chatImages(dataDir).dir,
          pluginDir: layout().plugin,
        });
    if (adapter) {
      api.runtime(adapter);
    }
  },
  fake: (api, { agents }) => {
    if (agents?.fake) {
      api.runtime(agents.fake);
    }
  },
  // A feature's turn that ends done starts its Storybook, so its stories are ready as you come.
  previews: (api, { warm }) => {
    api.on("turn-ended", ({ feature, repository, state }) => {
      if (state === "done" && feature !== null) {
        warm(repository, feature);
      }
    });
  },
};

/** A built-in's registration: its scope while registered, its problem, and its reload. */
type Entry = {
  problems: Array<Problem>;
  reloading: Promise<void>;
  scope?: Scope;
  waitingFor?: string;
};

/** What the built-ins register through, and how they wait for turns. */
export type BuiltInsOptions = Omit<BuiltInDeps, "warm"> & {
  /** Sends the `Extensions` record, as a built-in's state changes. */
  announce: () => void;
  /** Registers an extra agent outside any extension: gives its undo. */
  register: (name: string, agent: Adapter) => () => void;
  registry: Registry;
  /** The sessions at work, once the session manager is there. */
  turns: () => RuntimeTurns | undefined;
  warm: () => BuiltInDeps["warm"];
};

/**
 * The built-ins' server parts, each registered in a scope of its own, as an extension's version
 * is: registered again as its settings change, a runtime's once its sessions' turns end.
 */
export class BuiltIns {
  readonly #options: BuiltInsOptions;
  readonly #entries = new Map<string, Entry>();
  readonly #extras: Array<() => void> = [];
  #closed = false;

  constructor(options: BuiltInsOptions) {
    this.#options = options;
  }

  /**
   * Registers every built-in of `names`: the runtimes first, in `agents`' order, with the extra
   * agents, so new sessions run on the first one; then the others.
   */
  registerAll(names: ReadonlyArray<string>): void {
    const { agents } = this.#options;
    for (const name of agents ? Object.keys(agents) : ["claude"]) {
      if (BUILT_IN_RUNTIMES.has(name)) {
        this.register(name);
      } else if (agents?.[name]) {
        this.#extras.push(this.#options.register(name, agents[name]));
      }
    }
    for (const name of names) {
      if (!this.#entries.has(name)) {
        this.register(name);
      }
    }
  }

  /** Whether the built-in registered its server part, or has none. */
  registered(name: string): boolean {
    return this.#entries.get(name)?.scope !== undefined || !(name in BUILT_IN_SERVER);
  }

  problems(name: string): ReadonlyArray<Problem> {
    return this.#entries.get(name)?.problems ?? [];
  }

  waitingFor(name: string): string | undefined {
    return this.#entries.get(name)?.waitingFor;
  }

  /** Registers a built-in's server part in a new scope, the last one unloaded, a throw kept. */
  register(name: string): void {
    const entry = this.#entries.get(name) ?? { problems: [], reloading: Promise.resolve() };
    this.#entries.set(name, entry);
    entry.scope?.unload();
    entry.scope = undefined;
    entry.problems = [];
    const register = BUILT_IN_SERVER[name];
    if (!register) {
      return;
    }
    const scope = new Scope(name);
    try {
      register(serverApi(scope, this.#options.registry), {
        agents: this.#options.agents,
        dataDir: this.#options.dataDir,
        warm: (repository, folder) => this.#options.warm()(repository, folder),
      });
      entry.scope = scope;
    } catch (error) {
      scope.unload();
      reportFor(name, error);
      entry.problems = [
        { file: "", message: error instanceof Error ? error.message : String(error) },
      ];
    }
  }

  /** Registers a built-in again as its settings changed, a runtime's once its turns end. */
  reload(name: string): void {
    const entry = this.#entries.get(name);
    if (!entry || !(name in BUILT_IN_SERVER)) {
      return;
    }
    entry.reloading = entry.reloading.then(async () => {
      let title: string | undefined;
      while (!this.#closed && (title = this.#options.turns()?.busy(name)) !== undefined) {
        entry.waitingFor = title;
        this.#options.announce();
        await this.#options.turns()?.idle(name);
      }
      entry.waitingFor = undefined;
      if (!this.#closed) {
        this.register(name);
        this.#options.announce();
      }
    });
  }

  /** Unloads every built-in, as the server stops. */
  close(): void {
    this.#closed = true;
    this.#extras.splice(0).forEach((undo) => undo());
    for (const entry of this.#entries.values()) {
      entry.scope?.unload();
    }
  }
}
