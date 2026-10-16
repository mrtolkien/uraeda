// The preview runner: the only code that starts, watches, and stops Storybook processes, one per
// checkout's base path, `/r/<name>/preview/<folder>/`. A view starts the checkout's Storybook, which
// is ready once its index answers; it stops after 30 minutes without a view, when its checkout or
// its repository is removed, and with the server. Its state lives in memory, and its process groups
// in a record the next start reads, should the server be killed.
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { readIndex, type StoryIndex, UNREADABLE_INDEX } from "./index.ts";

/** A checkout's Storybook: starting, ready on its port, or failed, with the sentence to show. */
export type PreviewState =
  | { state: "starting" }
  | { port: number; state: "ready" }
  | { error: string; state: "failed" };

/**
 * A checkout to run a Storybook in: its folder, `dir`, its preview decision's `preview-folder` and
 * `preview-command`, and the path it is served under, `/r/<name>/preview/<folder>/`.
 */
export type Checkout = { base: string; command: string; dir: string; folder: string };

/** How often a starting Storybook's index is read. */
export const POLL_MS = 500;
/** How long a Storybook may take to start. */
export const START_MS = 120_000;
/** How long a Storybook runs without a view. */
export const IDLE_MS = 30 * 60_000;
/** How long a stopped Storybook has to exit before it is killed. */
export const KILL_MS = 5000;
/** How long a ready Storybook's index may take to answer. */
export const INDEX_MS = 5000;
/** How many lines of a Storybook's output are kept. */
const LINES_KEPT = 50;

export const TIMED_OUT = "Storybook did not start within 2 minutes.";
export const NO_PORT = "No free port for Storybook.";
/** The state a stopped runner gives every view: it starts nothing (R19). */
export const NOT_RUNNING = "Storybook is not running for this branch.";

/** A free port of 127.0.0.1, which the system picks. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

/** Whether another program holds `port` of 127.0.0.1 now. */
function portTaken(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", (error: NodeJS.ErrnoException) => resolve(error.code === "EADDRINUSE"));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(false)));
  });
}

/** Where a runner records its process groups: `GroupRecord`, in the data folder. */
export type GroupRecorder = { add(pid: number, base: string): void; remove(pid: number): void };

/**
 * The process groups every runner started, killed as the server exits, even on a crash; a server
 * killed past its exit hook leaves them to the next start, through the runner's record.
 */
const groups = new Set<number>();
let ending = false;

function endWithServer() {
  if (!ending) {
    ending = true;
    process.once("exit", () => {
      for (const pid of groups) {
        signalGroup(pid, "SIGKILL");
      }
    });
  }
}

function signalGroup(pid: number, signal: NodeJS.Signals) {
  try {
    process.kill(-pid, signal);
  } catch {
    // The group is gone.
  }
}

/** One started process: its port, its last lines of output, and a promise of its end. */
type Run = {
  child: ChildProcess;
  closed: Promise<void>;
  lines: Array<string>;
  port: number;
  running: boolean;
};

/** One checkout's Storybook, from its first view until it is stopped. */
type Entry = {
  checkout: Checkout;
  lastView: number;
  reading?: AbortController;
  retried: boolean;
  run?: Run;
  /** When the first process started: the 2 minutes count from it, across the port's retry. */
  started: number;
  state: PreviewState;
  stopped: boolean;
  timer?: NodeJS.Timeout;
};

/** Keeps a stream's lines, without colour codes, in `lines`, the last `LINES_KEPT` only. */
function keepLines(stream: NodeJS.ReadableStream | null, lines: Array<string>) {
  let partial = "";
  const keep = (line: string) => {
    const text = stripVTControlCharacters(line).trim();
    if (text !== "") {
      lines.push(text);
      lines.splice(0, Math.max(0, lines.length - LINES_KEPT));
    }
  };
  stream?.setEncoding("utf8");
  stream?.on("data", (chunk: string) => {
    const parts = (partial + chunk).split(/\r?\n|\r/);
    partial = parts.pop() ?? "";
    parts.forEach(keep);
  });
  stream?.on("end", () => keep(partial));
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
   * took, is stopped, and one started in the checkout. Once the runner is stopped, failed with
   * `NOT_RUNNING`, and nothing starts.
   */
  view(checkout: Checkout): PreviewState {
    if (this.#closed) {
      return { error: NOT_RUNNING, state: "failed" };
    }
    const entry = this.#entry(checkout) ?? this.#start(checkout);
    entry.lastView = this.#now();
    return entry.state;
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

  /** Stops each Storybook without a view for 30 minutes, or whose checkout was removed. */
  sweep(): void {
    for (const entry of this.#entries.values()) {
      if (this.#now() - entry.lastView > IDLE_MS || !existsSync(entry.checkout.dir)) {
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

  #start(checkout: Checkout): Entry {
    const now = this.#now();
    const entry: Entry = {
      checkout,
      lastView: now,
      retried: false,
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
    // A process group of its own, which its signals reach whole: Storybook's own children end
    // with it.
    const child = spawn("sh", ["-c", command.replaceAll("{port}", String(port))], {
      cwd,
      detached: true,
      env: { ...process.env, URAEDA_PREVIEW_BASE: base },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const run = this.#watch(entry, child, port);
    entry.run = run;
    entry.timer = setInterval(() => this.#poll(entry, run), POLL_MS);
  }

  /** Watches a started process: its output, and its end. */
  #watch(entry: Entry, child: ChildProcess, port: number): Run {
    let close!: () => void;
    const run: Run = {
      child,
      closed: new Promise((resolve) => (close = resolve)),
      lines: [],
      port,
      running: child.pid !== undefined,
    };
    if (child.pid !== undefined) {
      groups.add(child.pid);
      endWithServer();
      this.#record?.add(child.pid, entry.checkout.base);
    }
    keepLines(child.stdout, run.lines);
    keepLines(child.stderr, run.lines);
    // What the command started may outlive it, and keep its output open: its whole group goes
    // as soon as it exits, so its output closes, and its end follows at once.
    const stopGroup = () => {
      run.running = false;
      if (child.pid !== undefined && groups.delete(child.pid)) {
        signalGroup(child.pid, "SIGKILL");
        this.#record?.remove(child.pid);
      }
    };
    child.once("exit", stopGroup);
    let done = false;
    const ended = (why: string) => {
      if (done) {
        return;
      }
      done = true;
      stopGroup();
      close();
      void this.#exited(entry, run, why);
    };
    child.once("error", (error) => {
      run.lines.push(error.message);
      ended(error.message);
    });
    child.once("close", (code, signal) => {
      ended(
        signal ? `The command was stopped by ${signal}.` : `The command exited with code ${code}.`,
      );
    });
    return run;
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
   * is failed, with its last line of output.
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
    this.#fail(entry, `Storybook did not start: ${run.lines.at(-1) ?? why}`);
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
      void this.#kill(entry.run);
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
    return entry.run === undefined ? Promise.resolve() : this.#kill(entry.run);
  }

  /** Sends SIGTERM to the process's group, then SIGKILL after 5 seconds; resolves once it ended. */
  #kill(run: Run): Promise<void> {
    const pid = run.child.pid;
    if (!run.running || pid === undefined) {
      return run.closed;
    }
    signalGroup(pid, "SIGTERM");
    const timer = setTimeout(() => signalGroup(pid, "SIGKILL"), KILL_MS);
    return run.closed.then(() => clearTimeout(timer));
  }
}
