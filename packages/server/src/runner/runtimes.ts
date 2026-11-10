import type { AccountState, AccountWindow, Adapter, Capabilities, ModelList } from "./adapter.ts";
import type { SessionRow } from "./cache.ts";
import type { UsageWindow } from "./events.ts";
import { REFUSALS, refused } from "./session-state.ts";

/** An agent runtime, as an extension registers it: the adapter its sessions are reached through. */
export type Runtime = Adapter;

/**
 * Whether the runtime of this name is on in the repository, by the path its sessions are kept
 * under, or in every repository for `null`.
 */
export type IsOn = (name: string, repo: string | null) => boolean;

/** Whether a runtime worked at its last check, and its version: unchecked, it is not available. */
export type RuntimeStatus = { available: boolean; version: string | null };

/** An account, for the UI. `isNext`: a new session would start on it now. */
export type AccountRecord = {
  /** What a session stores: for Claude Code, its folder. */
  id: string;
  isNext: boolean;
  name: string;
  state: AccountState;
  /** Shortest first, each the freshest read of an ask or of a running process. */
  windows: Array<AccountWindow>;
};

/** A runtime, for the UI: what its sessions show, what it can do, and its usage. */
export type RuntimeRecord = {
  /** Its accounts, in the listed order: none when it lists none. */
  accounts: Array<AccountRecord>;
  available: boolean;
  capabilities: Capabilities;
  icon: string;
  /** Whether it is on in the repository asked about. */
  isOn: boolean;
  /** The name it is registered as, which its sessions store as their `agent`. */
  kind: string;
  /** Its last model list, kept through a failed refresh: none before one, or without a list. */
  models: ModelList | null;
  /** Its name for people: "Claude Code". */
  name: string;
  /** Its extension's title, which its refusals name it by: its `kind` without one. */
  title: string;
  /**
   * Its windows, each from the freshest report of an open process: none before one, and none while
   * it lists accounts, whose windows are theirs.
   */
  usage: Array<UsageWindow>;
  version: string | null;
};

/** What each runtime's record reads: its accounts, and the usage of its open processes. */
export type UsageOf = {
  accounts: (name: string) => Array<AccountRecord>;
  usage: (name: string) => Array<UsageWindow>;
};

const UNCHECKED: RuntimeStatus = { available: false, version: null };

/** A runtime's model list is asked for at most once in this time. */
export const MODELS_REFRESH_MS = 60_000;

/** A model list asked for longer than this is given up on: the runtime keeps its last one. */
export const MODELS_REFRESH_TIMEOUT_MS = 15_000;

/**
 * A registered runtime: its status, and its last model list, with when it was last asked for and
 * the ask, which leave with it once it is unregistered. `asks` counts the asks: only the latest one
 * keeps its list.
 */
type Entry = {
  asks: number;
  listedAt?: number;
  listing?: Promise<void>;
  models?: ModelList;
  runtime: Adapter;
  status: RuntimeStatus;
};

/**
 * The agent runtimes sessions run on, by the names they are registered as, in registration order.
 * A session stores the name of the runtime it was made with, and runs on that runtime only: one
 * unregistered, or off in its repository, leaves it read-only until it returns. `isOn` says where
 * each one is on, every runtime everywhere by default.
 */
export class Runtimes {
  readonly isOn: IsOn;
  #entries = new Map<string, Entry>();
  #listeners = new Set<() => void>();
  /** Each name's status when it was unregistered, which a registration under it starts from. */
  #last = new Map<string, RuntimeStatus>();

  readonly #title: (name: string) => string | undefined;
  readonly #skills: (root: string) => ReadonlyArray<string>;

  /**
   * `title` names a runtime in refusals, its extension's title: the name itself by default.
   * `skills` gives the skill folders of the extensions on in a main checkout: none by default.
   */
  constructor({
    isOn = () => true,
    skills = () => [],
    title = () => undefined,
  }: {
    isOn?: IsOn;
    skills?: (root: string) => ReadonlyArray<string>;
    title?: (name: string) => string | undefined;
  } = {}) {
    this.isOn = isOn;
    this.#skills = skills;
    this.#title = title;
  }

  /** The skill folders a session opening in the main checkout `root` gets, beside Uraeda's. */
  skills(root: string): ReadonlyArray<string> {
    return this.#skills(root);
  }

  /** The runtime's name for people in refusals, registered or not. */
  title(name: string): string {
    return this.#title(name) ?? name;
  }

  /**
   * Registers `runtime` as `name`: gives the undo, which unregisters it. It starts from the status
   * the last runtime of that name had, unchecked for a new name, so a runtime reloaded is not
   * refused as unavailable until its next check. Its model list is asked for at once.
   */
  register(name: string, runtime: Adapter): () => void {
    if (this.#entries.has(name)) {
      throw new Error(`a runtime is registered as ${name} already`);
    }
    const entry: Entry = { asks: 0, runtime, status: this.#last.get(name) ?? UNCHECKED };
    this.#entries.set(name, entry);
    this.changed();
    void this.refreshModels([name]);
    return () => {
      if (this.#entries.get(name) === entry) {
        this.#last.set(name, entry.status);
        this.#entries.delete(name);
        this.changed();
      }
    };
  }

  get(name: string): Adapter | undefined {
    return this.#entries.get(name)?.runtime;
  }

  /** The names registered, in registration order. */
  names(): Array<string> {
    return [...this.#entries.keys()];
  }

  /** The runtimes on in the repository, in registration order. */
  forRepository(repo: string | null): Array<Adapter> {
    return this.#onIn(repo).map((name) => this.#entries.get(name)!.runtime);
  }

  /** The name of the runtime a new session of the repository runs on: the first one on there. */
  defaultFor(repo: string | null): string | undefined {
    return this.#onIn(repo)[0];
  }

  /** The runtime's status at its last check. */
  status(name: string): RuntimeStatus {
    return this.#entries.get(name)?.status ?? UNCHECKED;
  }

  /**
   * Asks each runtime for its version: whether any status changed, and whether a runtime that
   * changed is available.
   */
  async check(): Promise<{ back: boolean; changed: boolean }> {
    const found = { back: false, changed: false };
    await Promise.all(
      [...this.#entries.values()].map(async (entry) => {
        const version = (await entry.runtime.version().catch(() => undefined)) ?? null;
        const status = { available: version !== null, version };
        if (
          status.available !== entry.status.available ||
          status.version !== entry.status.version
        ) {
          entry.status = status;
          found.changed = true;
          found.back ||= status.available;
        }
      }),
    );
    return found;
  }

  /** The runtime's last model list: none before one, nor for a runtime without a list. */
  models(name: string): ModelList | undefined {
    return this.#entries.get(name)?.models;
  }

  /**
   * Asks the runtimes of these names, every one by default, for their model lists, each at most
   * once a minute: one asked for less than a minute ago waits for that ask. A list that cannot be
   * read, or not within `MODELS_REFRESH_TIMEOUT_MS`, keeps the last one. Each list that changed calls
   * `changed` as it comes, without waiting for the others.
   */
  async refreshModels(names: ReadonlyArray<string> = this.names()): Promise<void> {
    const asks = names.flatMap((name) => {
      const entry = this.#entries.get(name);
      if (!entry?.runtime.models) {
        return [];
      }
      if (entry.listing && Date.now() - entry.listedAt! < MODELS_REFRESH_MS) {
        return [entry.listing];
      }
      entry.listedAt = Date.now();
      entry.listing = this.#list(entry);
      return [entry.listing];
    });
    await Promise.all(asks);
  }

  /**
   * Asks the runtime for its model list, and keeps it if it is still the latest ask's: calls
   * `changed` when it changed.
   */
  async #list(entry: Entry): Promise<void> {
    const ask = ++entry.asks;
    let timer: NodeJS.Timeout | undefined;
    const timedOut = new Promise<undefined>((resolve) => {
      timer = setTimeout(resolve, MODELS_REFRESH_TIMEOUT_MS, undefined);
      timer.unref();
    });
    // An extension's runtime may throw at once, as well as reject.
    const asked = Promise.resolve()
      .then(() => entry.runtime.models!())
      .catch(() => undefined);
    const list = await Promise.race([asked, timedOut]);
    clearTimeout(timer);
    // Unregistered meanwhile, it took its list with it.
    if (list === undefined || ask !== entry.asks || ![...this.#entries.values()].includes(entry)) {
      return;
    }
    const same = JSON.stringify(list) === JSON.stringify(entry.models);
    entry.models = list;
    if (!same) {
      this.changed();
    }
  }

  /** Calls `listener` at each registration, unregistration, or `changed`: gives its removal. */
  onChange(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  /** Tells the listeners that the runtimes, or where they are on, changed. */
  changed(): void {
    this.#listeners.forEach((listener) => listener());
  }

  /** Each runtime, for the UI, its `isOn` in `repo`. */
  records(repo: string | null, { accounts, usage }: UsageOf): Array<RuntimeRecord> {
    return [...this.#entries].map(([kind, { models, runtime, status }]) => {
      const listed = accounts(kind);
      return {
        ...status,
        accounts: listed,
        capabilities: { ...runtime.capabilities },
        icon: runtime.icon,
        isOn: this.isOn(kind, repo),
        kind,
        models: models ?? null,
        name: runtime.name,
        title: this.title(kind),
        usage: listed.length > 0 ? [] : usage(kind),
      };
    });
  }

  #onIn(repo: string | null): Array<string> {
    return this.names().filter((name) => this.isOn(name, repo));
  }
}

/** The runtimes `entries` give, registered by their names in their order, on where `isOn` says. */
export function runtimesOf(entries: Record<string, Adapter>, isOn?: IsOn): Runtimes {
  const runtimes = new Runtimes(isOn === undefined ? {} : { isOn });
  Object.entries(entries).forEach(([name, runtime]) => runtimes.register(name, runtime));
  return runtimes;
}

/**
 * The runtime a session runs on, by its stored `agent`: refused while it is unregistered, or off
 * in the session's repository. Its title is the stored name.
 */
export function sessionRuntime(runtimes: Runtimes, row: SessionRow): Adapter {
  const runtime = runtimes.get(row.agent);
  if (!runtime || !runtimes.isOn(row.agent, row.repo)) {
    throw refused(REFUSALS.runtimeOff(runtimes.title(row.agent)));
  }
  return runtime;
}

/**
 * The name of the runtime a new session of the repository runs on: `chosen`, else the first one on
 * there. Refused when none is on, or `chosen` is off there.
 */
export function newSessionRuntime(runtimes: Runtimes, repo: string, chosen?: string): string {
  if (chosen !== undefined) {
    if (!runtimes.get(chosen) || !runtimes.isOn(chosen, repo)) {
      throw refused(REFUSALS.runtimeOff(runtimes.title(chosen)));
    }
    return chosen;
  }
  const name = runtimes.defaultFor(repo);
  if (name === undefined) {
    throw refused(REFUSALS.noRuntime);
  }
  return name;
}

/** Whether the session's runtime is registered, on in its repository, and available. */
export function runsOn(runtimes: Runtimes, row: SessionRow): boolean {
  return (
    runtimes.get(row.agent) !== undefined &&
    runtimes.isOn(row.agent, row.repo) &&
    runtimes.status(row.agent).available
  );
}

/**
 * Refuses a message to the runtime of this name while it is not available: at its last check, its
 * version was missing.
 */
export function checkAvailable(runtimes: Runtimes, name: string): void {
  if (!runtimes.status(name).available) {
    throw refused(REFUSALS.unavailable(runtimes.get(name)?.name ?? name));
  }
}

/** The session, once its runtime is on in its repository, and available: else refused. */
export function readySession(runtimes: Runtimes, row: SessionRow): SessionRow {
  sessionRuntime(runtimes, row);
  checkAvailable(runtimes, row.agent);
  return row;
}

/**
 * The runtime a message to `session` goes to, or without one to a new session of the main checkout
 * `root`, on `chosen` or the first one on there: refused while it is off there, unregistered, or
 * not available.
 */
export function messageRuntime(
  runtimes: Runtimes,
  root: string,
  session?: SessionRow,
  chosen?: string,
): Adapter {
  const name = session === undefined ? newSessionRuntime(runtimes, root, chosen) : session.agent;
  if (session !== undefined) {
    sessionRuntime(runtimes, session);
  }
  checkAvailable(runtimes, name);
  return runtimes.get(name)!;
}

/**
 * Whether a message to `session`, or to a new session of `root`, on `chosen` when one was picked,
 * would go, as `messageRuntime` says: the runtime's name, and why not.
 */
export function runtimeState(
  runtimes: Runtimes,
  root: string,
  session?: SessionRow,
  chosen?: string,
): { available: boolean; name: string; refusal?: string } {
  try {
    return { available: true, name: messageRuntime(runtimes, root, session, chosen).name };
  } catch (error) {
    const refusal = (error as Error).message.replace(/^refused: /, "");
    const name =
      runtimes.get(session?.agent ?? chosen ?? runtimes.defaultFor(root) ?? "")?.name ?? "";
    return { available: false, name, refusal };
  }
}
