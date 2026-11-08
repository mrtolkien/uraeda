import type { Adapter, Capabilities } from "./adapter.ts";
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

/** A runtime, for the UI: what its sessions show, what it can do, and its usage. */
export type RuntimeRecord = {
  available: boolean;
  capabilities: Capabilities;
  icon: string;
  /** Whether it is on in the repository asked about. */
  isOn: boolean;
  /** The name it is registered as, which its sessions store as their `agent`. */
  kind: string;
  /** Its name for people: "Claude Code". */
  name: string;
  /** Its extension's title, which its refusals name it by: its `kind` without one. */
  title: string;
  /** Its windows, each from the freshest report of an open process: none before one. */
  usage: Array<UsageWindow>;
  version: string | null;
};

const UNCHECKED: RuntimeStatus = { available: false, version: null };

/**
 * The agent runtimes sessions run on, by the names they are registered as, in registration order.
 * A session stores the name of the runtime it was made with, and runs on that runtime only: one
 * unregistered, or off in its repository, leaves it read-only until it returns. `isOn` says where
 * each one is on, every runtime everywhere by default.
 */
export class Runtimes {
  readonly isOn: IsOn;
  #entries = new Map<string, { runtime: Adapter; status: RuntimeStatus }>();
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
   * refused as unavailable until its next check.
   */
  register(name: string, runtime: Adapter): () => void {
    if (this.#entries.has(name)) {
      throw new Error(`a runtime is registered as ${name} already`);
    }
    const entry = { runtime, status: this.#last.get(name) ?? UNCHECKED };
    this.#entries.set(name, entry);
    this.changed();
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
  records(repo: string | null, usage: (name: string) => Array<UsageWindow>): Array<RuntimeRecord> {
    return [...this.#entries].map(([kind, { runtime, status }]) => ({
      ...status,
      capabilities: { ...runtime.capabilities },
      icon: runtime.icon,
      isOn: this.isOn(kind, repo),
      kind,
      name: runtime.name,
      title: this.title(kind),
      usage: usage(kind),
    }));
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
