// The preview runner: the only code that starts, watches, and stops Storybook processes, each
// through `run.ts`, one per checkout's base path, `/r/<name>/preview/<secret>/<folder>/`. A view
// starts the checkout's Storybook, which is ready once its index answers; a view after its
// checkout's code version moved, a commit outside `specs/`, starts it again; it stops after 30
// minutes without a view or a keep, when its checkout or its repository is removed, and with the
// server. Its state lives in memory, and its process groups in a record the next start reads,
// should the server be killed.
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { freePort } from "../free-port.ts";
import { readIndex, type StoryIndex, UNREADABLE_INDEX } from "./index.ts";
import { type GroupRecorder, lastReason, portTaken } from "./process.ts";
import { KILL_MS, killRun, type Run, startRun } from "./run.ts";

export { freePort, type GroupRecorder, KILL_MS };

/** A checkout's Storybook: starting, ready on its port, or failed, with the sentence to show. */
export type PreviewState =
  | { state: "starting" }
  | { port: number; state: "ready" }
  | { error: string; state: "failed" };

/**
 * A checkout to run a Storybook in: its folder, `dir`, its preview decision's `preview-folder` and
 * `preview-command`, the path it is served under, `/r/<name>/preview/<secret>/<folder>/`, and the
 * code version it has checked out, its last commit outside `specs/`, when it was read, with the
 * `read` stamp `Previews.read` gave before the read began. Without a stamp, the version counts as
 * read now.
 */
export type Checkout = {
  base: string;
  command: string;
  dir: string;
  folder: string;
  read?: number;
  version?: string;
};

/** How often a starting Storybook's index is read. */
export const POLL_MS = 500;
/** How long a Storybook may take to start. */
export const START_MS = 120_000;
/** How long a Storybook runs without a view. */
export const IDLE_MS = 30 * 60_000;
/** How long a ready Storybook's index may take to answer. */
export const INDEX_MS = 5000;

export const TIMED_OUT = "Storybook did not start within 2 minutes.";
export const NO_PORT = "No free port for Storybook.";
/** The state a stopped runner gives every view: it starts nothing (R19). */
export const NOT_RUNNING = "Storybook is not running for this branch.";

/** One checkout's Storybook, from its first view until it is stopped. */
type Entry = {
  checkout: Checkout;
  lastView: number;
  reading?: AbortController;
  retried: boolean;
  run?: Run;
  /** The `read` stamp it started at: only a version read after it can move it. */
  stamp: number;
  /** When the first process started: the 2 minutes count from it, across the port's retry. */
  started: number;
  state: PreviewState;
  stopped: boolean;
  timer?: NodeJS.Timeout;
};

/**
 * Whether the entry's Storybook is at another code version than `now`'s: one whose first version
 * read failed is at an unknown version, which any known one is another than. A version read before
 * the Storybook started cannot say it moved: it may be the older of two views racing a move.
 */
function moved(entry: Entry, now: Checkout): boolean {
  return (
    now.version !== undefined &&
    now.version !== entry.checkout.version &&
    (now.read === undefined || now.read > entry.stamp)
  );
}

/** Whether `path` is a folder. */
function isFolder(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

/** The Storybook processes of the server's checkouts, by base path. */
export class Previews {
  readonly #entries = new Map<string, Entry>();
  readonly #now: () => number;
  readonly #freePort: () => Promise<number>;
  readonly #onChange: (base: string) => void;
  readonly #indexMs: number;
  readonly #record: GroupRecorder | undefined;
  #reads = 0;
  /** Set by `stopAll`: the server stops, and nothing starts again. */
  #closed = false;

  constructor(
    options: {
      freePort?: () => Promise<number>;
      /** How long a ready Storybook's index may take to answer: `INDEX_MS`. */
      indexMs?: number;
      now?: () => number;
      onChange?: (base: string) => void;
      /** Where each running process group is recorded, for the next start to kill (R52). */
      record?: GroupRecorder;
    } = {},
  ) {
    this.#now = options.now ?? Date.now;
    this.#freePort = options.freePort ?? freePort;
    this.#onChange = options.onChange ?? (() => {});
    this.#indexMs = options.indexMs ?? INDEX_MS;
    this.#record = options.record;
  }

  /**
   * The checkout's state, its Storybook started when none runs, and the view recorded. A Storybook
   * under the same base in another folder, a removed repository's whose folder name another one
   * took, is stopped, and one started in the checkout. One started at another code version of the
   * checkout, which may have changed what Storybook only reads as it starts, such as its
   * configuration or its dependencies, is started again, its records kept. Once the runner is stopped, failed with
   * `NOT_RUNNING`, and nothing starts.
   */
  view(checkout: Checkout): PreviewState {
    if (this.#closed) {
      return { error: NOT_RUNNING, state: "failed" };
    }
    const current = this.#entry(checkout);
    const entry =
      current === undefined
        ? this.#start(checkout)
        : moved(current, checkout)
          ? this.#replace(current, checkout)
          : current;
    entry.lastView = this.#now();
    return entry.state;
  }

  /**
   * A stamp for a code version read, taken before the read begins: the Storybooks started since
   * have a greater one, and a version read earlier does not move them.
   */
  read(): number {
    return ++this.#reads;
  }

  /** The state of the Storybook under `base`, undefined when none was started or it stopped. */
  state(base: string): PreviewState | undefined {
    return this.#entries.get(base)?.state;
  }

  /** Stops the checkout's Storybook, if one runs, and starts it again: a view too. */
  restart(checkout: Checkout): PreviewState {
    const entry = this.#entry(checkout);
    if (entry !== undefined) {
      void this.#stop(entry);
    }
    return this.view(checkout);
  }

  /**
   * The index of the ready Storybook under `base`; undefined when none is ready, or it fails or
   * does not answer within `INDEX_MS`.
   */
  async index(base: string): Promise<StoryIndex | undefined> {
    const state = this.state(base);
    if (state?.state !== "ready") {
      return undefined;
    }
    try {
      return await readIndex(state.port, AbortSignal.timeout(this.#indexMs));
    } catch {
      return undefined;
    }
  }

  /**
   * Stops each Storybook whose checkout was removed, kept or not, and each without a view for 30
   * minutes. One whose base is in `kept`, a folder whose file waits for the human, counts as viewed
   * now: it stops 30 minutes after it is no longer kept.
   */
  sweep(kept: ReadonlySet<string> = new Set()): void {
    const now = this.#now();
    for (const entry of this.#entries.values()) {
      if (!existsSync(entry.checkout.dir)) {
        void this.#stop(entry);
      } else if (kept.has(entry.checkout.base)) {
        entry.lastView = now;
      } else if (now - entry.lastView > IDLE_MS) {
        void this.#stop(entry);
      }
    }
  }

  /** Stops the Storybooks of the repository `name`, as it is removed from the list. */
  stopRepository(name: string): void {
    const prefix = `/r/${encodeURIComponent(name)}/preview/`;
    for (const entry of this.#entries.values()) {
      if (entry.checkout.base.startsWith(prefix)) {
        void this.#stop(entry);
      }
    }
  }

  /**
   * Stops every Storybook, starting or running, as the frame secret is replaced: the runner stays
   * open, and the next view starts one again, under the new base.
   */
  stopEach(): void {
    for (const entry of this.#entries.values()) {
      void this.#stop(entry);
    }
  }

  /** Stops every Storybook, once their processes exited; nothing starts afterwards. */
  async stopAll(): Promise<void> {
    this.#closed = true;
    await Promise.all([...this.#entries.values()].map((entry) => this.#stop(entry)));
  }

  /** The checkout's entry; one under its base in another folder is stopped, and none is given. */
  #entry(checkout: Checkout): Entry | undefined {
    const entry = this.#entries.get(checkout.base);
    if (entry !== undefined && entry.checkout.dir !== checkout.dir) {
      void this.#stop(entry);
      return undefined;
    }
    return entry;
  }

  /**
   * Starts the checkout's Storybook in place of the entry's, then stops the entry's: its base never
   * goes without a state, so the records read for it stay, and get the new one's updates.
   */
  #replace(entry: Entry, checkout: Checkout): Entry {
    const started = this.#start(checkout);
    void this.#stop(entry);
    return started;
  }

  #start(checkout: Checkout): Entry {
    const now = this.#now();
    const entry: Entry = {
      checkout,
      lastView: now,
      retried: false,
      stamp: this.#reads,
      started: now,
      state: { state: "starting" },
      stopped: false,
    };
    this.#entries.set(checkout.base, entry);
    this.#onChange(checkout.base);
    void this.#launch(entry);
    return entry;
  }

  /** Starts the entry's command on a free port, and polls its index. */
  async #launch(entry: Entry) {
    const { base, command, dir, folder } = entry.checkout;
    const cwd = join(dir, folder);
    if (!isFolder(cwd)) {
      this.#fail(entry, `Storybook did not start: ${folder} is not a folder of this checkout.`);
      return;
    }
    let port: number;
    try {
      port = await this.#freePort();
    } catch {
      this.#fail(entry, NO_PORT);
      return;
    }
    if (entry.stopped) {
      return;
    }
    const run = startRun({
      base,
      command,
      cwd,
      ended: (ended, why) => void this.#exited(entry, ended, why),
      port,
      record: this.#record,
    });
    entry.run = run;
    entry.timer = setInterval(() => this.#poll(entry, run), POLL_MS);
  }

  /** Reads a starting Storybook's index: ready on its first answer, failed after 2 minutes. */
  #poll(entry: Entry, run: Run) {
    if (entry.run !== run || entry.state.state !== "starting") {
      return;
    }
    if (this.#now() - entry.started > START_MS) {
      this.#fail(entry, TIMED_OUT);
      return;
    }
    if (entry.reading !== undefined) {
      return;
    }
    const reading = new AbortController();
    entry.reading = reading;
    readIndex(run.port, reading.signal).then(
      () => {
        if (entry.run === run && entry.state.state === "starting" && !entry.stopped) {
          this.#idle(entry);
          entry.state = { port: run.port, state: "ready" };
          this.#onChange(entry.checkout.base);
        }
      },
      (error: unknown) => {
        if (entry.reading === reading) {
          entry.reading = undefined;
        }
        if ((error as Error).message === UNREADABLE_INDEX && entry.run === run && !entry.stopped) {
          this.#fail(entry, UNREADABLE_INDEX);
        }
      },
    );
  }

  /**
   * After a process ended by itself: a taken port is tried once more on a new one; any other end
   * is failed, with its last error line of output, or its last line.
   */
  async #exited(entry: Entry, run: Run, why: string) {
    if (entry.stopped || entry.run !== run || entry.state.state === "failed") {
      return;
    }
    this.#idle(entry);
    if (entry.state.state === "starting" && (await portTaken(run.port))) {
      if (entry.stopped || entry.run !== run) {
        return;
      }
      if (entry.retried) {
        this.#fail(entry, NO_PORT);
        return;
      }
      entry.retried = true;
      void this.#launch(entry);
      return;
    }
    this.#fail(entry, `Storybook did not start: ${lastReason(run.lines) ?? why}`);
  }

  /** Stops polling the entry's index. */
  #idle(entry: Entry) {
    clearInterval(entry.timer);
    entry.timer = undefined;
    entry.reading?.abort();
    entry.reading = undefined;
  }

  /** The entry failed: its process, if any runs, is stopped, and the entry kept for its error. */
  #fail(entry: Entry, error: string) {
    this.#idle(entry);
    entry.state = { error, state: "failed" };
    if (entry.run !== undefined) {
      void killRun(entry.run);
    }
    this.#onChange(entry.checkout.base);
  }

  /** Stops the entry's process, and forgets the entry. */
  #stop(entry: Entry): Promise<void> {
    entry.stopped = true;
    this.#idle(entry);
    if (this.#entries.get(entry.checkout.base) === entry) {
      this.#entries.delete(entry.checkout.base);
      this.#onChange(entry.checkout.base);
    }
    return entry.run === undefined ? Promise.resolve() : killRun(entry.run);
  }
}
