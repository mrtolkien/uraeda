import { randomUUID } from "node:crypto";
import type { AgentEvent, TokenCounts, UsageWindow } from "./events.ts";
import { sessionRuntime } from "./runtimes.ts";
import {
  type Live,
  type Proc,
  REFUSALS,
  refused,
  REPLACED,
  rowOf,
  type SessionContext,
  TERMINATE_AFTER_MS,
} from "./session-state.ts";

/** A turn failed by its process's exit keeps this many lines of its stderr. */
const STDERR_LINES = 20;

/** A new agent session's baseline: none of its tokens counted yet. */
const NO_TOKENS: TokenCounts = { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 };

type Exit = Extract<AgentEvent, { type: "exit" }>;

/**
 * The sessions' processes: at most one per session, across servers, opened in the session's
 * directory, read to their exit, and closed with a bounded wait.
 */
export class Processes {
  #context: SessionContext;
  /**
   * Each runtime's windows' reports, by the runtime's name and the window's ID, in report order:
   * the newest open process's report wins, even when usage decreased. A report without a window
   * keeps that window's last report. A runtime's windows keep the order they first came in.
   */
  #limits = new Map<string, Map<Proc, UsageWindow>>();
  #expiry: ReturnType<typeof setTimeout> | undefined;
  /** Each process's agent session total so far, which its next report's own work is counted from. */
  #baselines = new WeakMap<Proc, TokenCounts>();

  constructor(context: SessionContext) {
    this.#context = context;
  }

  /**
   * The runtime's windows, each the freshest unexpired report of it from an open process, across
   * repositories.
   */
  usage(runtime: string): Array<UsageWindow> {
    const now = Date.now();
    return [...this.#limits].flatMap(([key, reports]) => {
      const fresh = key.startsWith(`${runtime}\0`)
        ? [...reports.values()].filter((window) => Date.parse(window.resetsAt) > now).at(-1)
        : undefined;
      return fresh ? [fresh] : [];
    });
  }

  /** Drops the process's reports of every window: whether it had any. */
  #dropLimits(proc: Proc): boolean {
    return [...this.#limits.values()].map((reports) => reports.delete(proc)).includes(true);
  }

  /** Keeps a report's windows as the process's newest, each in report order. */
  #report(proc: Proc, event: Extract<AgentEvent, { type: "usage" }>) {
    for (const window of event.windows) {
      const key = `${proc.kind}\0${window.id}`;
      const reports = this.#limits.get(key) ?? new Map<Proc, UsageWindow>();
      this.#limits.set(key, reports);
      reports.delete(proc);
      reports.set(proc, window);
    }
    this.#usageChanged();
  }

  /** Drops expired reports, and publishes expiry even when no process prints another event. */
  #usageChanged() {
    clearTimeout(this.#expiry);
    const now = Date.now();
    const resets: Array<number> = [];
    for (const reports of this.#limits.values()) {
      for (const [proc, window] of reports) {
        const reset = Date.parse(window.resetsAt);
        if (reset <= now) {
          reports.delete(proc);
        } else {
          resets.push(reset);
        }
      }
    }
    const next = Math.min(...resets);
    this.#expiry = Number.isFinite(next)
      ? setTimeout(() => this.#usageChanged(), Math.min(next - Date.now(), 2_147_483_647))
      : undefined;
    this.#expiry?.unref();
    this.#context.agentChanged();
  }

  /**
   * The session's open process, opened when it has none, or when it is closing: then once it
   * exited. A transcript that is gone starts a new agent session: `line` says so, in the session
   * that ran before. `allowed` reopens the process with the rules. The directory is the session's
   * folder as it is now: a session moved to a change opens in the change's worktree.
   */
  async open(
    live: Live,
    { allowed }: { allowed?: ReadonlyArray<string> } = {},
  ): Promise<{ line?: string; proc: Proc }> {
    const { binding, cache, runtimes } = this.#context;
    if (live.proc && !live.proc.closing && allowed === undefined) {
      // A turn taken back while the process opened left its line to the next one.
      const { line } = live.proc;
      delete live.proc.line;
      return { proc: live.proc, ...(line === undefined ? {} : { line }) };
    }
    if (live.proc) {
      this.close(live.proc);
      await live.proc.done;
    }
    // Another server may share the cache: one process per session, across servers.
    if (!cache.claimSession(live.id)) {
      throw refused(REFUSALS.working);
    }
    try {
      const cwd = live.folder === null ? live.repo : await binding.workDir(live.repo, live.folder);
      const row = rowOf(cache, live);
      // The session's own runtime, never another: one unregistered or turned off since leaves it
      // read-only.
      const adapter = sessionRuntime(runtimes, row);
      const resume = adapter.hasSession(row.nativeId);
      const ran = cache.turns(live.id).some((turn) => turn.startedAt !== null);
      // A session that ran before has lost its transcript: Claude Code deletes old ones.
      const line = resume || !ran ? undefined : REPLACED;
      const nativeId = line === undefined ? row.nativeId : randomUUID();
      if (line !== undefined) {
        cache.updateSession(live.id, { nativeId });
      }
      const agent = adapter.open({
        cwd,
        nativeId,
        resume,
        skills: runtimes.skills(live.repo),
        ...(allowed === undefined ? {} : { allowed }),
      });
      const proc: Proc = {
        agent,
        background: new Map(),
        closing: false,
        cwd,
        done: Promise.resolve(),
        kind: row.agent,
        runtime: adapter,
        terminate: [],
      };
      live.proc = proc;
      // A resumed agent session reports its earlier turns' tokens again.
      this.#baselines.set(proc, resume ? cache.agentSessionTokens(live.id) : NO_TOKENS);
      proc.done = this.#consume(live, proc);
      return { proc, ...(line === undefined ? {} : { line }) };
    } catch (error) {
      cache.releaseSession(live.id);
      throw error;
    }
  }

  /** Starts the process's new agent session, after `/clear`: its next total counts whole. */
  cleared(proc: Proc) {
    if (this.#baselines.has(proc)) {
      this.#baselines.set(proc, NO_TOKENS);
    }
  }

  /**
   * Adds the work of the process's agent session since its last report to the turn running on it.
   * Without one, the next report counts it.
   */
  tokens(live: Live, proc: Proc, total: TokenCounts) {
    const turn = live.turn?.id;
    const baseline = this.#baselines.get(proc);
    if (turn === undefined || baseline === undefined) {
      return;
    }
    // An agent session's total never decreases: a lower one is a new agent session's, should its
    // `init` have been missed.
    const started = (Object.keys(total) as Array<keyof TokenCounts>).some(
      (field) => total[field] < baseline[field],
    );
    const own = (field: keyof TokenCounts) => total[field] - (started ? 0 : baseline[field]);
    this.#context.cache.addTurnTokens(turn, {
      cacheRead: own("cacheRead"),
      cacheWrite: own("cacheWrite"),
      input: own("input"),
      output: own("output"),
    });
    this.#baselines.set(proc, total);
  }

  /**
   * Closes the process once its turn is over: it exits, and is reopened by the next message. One
   * that is still running 10 seconds later gets SIGTERM, and SIGKILL 10 seconds after that, so that
   * no send, nor the server's stop, waits on it forever.
   */
  close(proc: Proc) {
    if (!proc.closing) {
      proc.closing = true;
      if (this.#dropLimits(proc)) {
        this.#usageChanged();
      }
      proc.agent.close();
      proc.terminate.push(
        setTimeout(() => proc.agent.kill("SIGTERM"), TERMINATE_AFTER_MS),
        setTimeout(() => proc.agent.kill("SIGKILL"), 2 * TERMINATE_AFTER_MS),
      );
    }
  }

  /** Reads the process's events into the cache, until it exits. */
  async #consume(live: Live, proc: Proc): Promise<void> {
    for await (const event of proc.agent.events) {
      try {
        if (event.type === "exit") {
          this.#exited(live, proc, event);
          return;
        }
        if (event.type === "usage") {
          if (!proc.closing) {
            this.#report(proc, event);
          }
          continue;
        }
        this.#context.transcript.record(live, proc, event);
      } catch (error) {
        // A cache write that fails does not stop the session.
        process.stderr.write(
          `The session manager could not record an event of ${live.id}: ${String(error)}\n`,
        );
      }
    }
    this.#exited(live, proc, { code: null, stderr: "", type: "exit" });
  }

  /** The process exited: its turn ends, and the queued turns start on a new one. */
  #exited(live: Live, proc: Proc, exit: Exit) {
    const { cache, turns } = this.#context;
    const adapter = proc.runtime;
    if (this.#dropLimits(proc)) {
      this.#usageChanged();
    }
    proc.terminate.forEach(clearTimeout);
    if (live.proc !== proc) {
      return;
    }
    live.proc = undefined;
    clearTimeout(live.idle);
    cache.releaseSession(live.id);
    const turn = live.turn;
    if (turn) {
      const stderr = exit.stderr.trimEnd().split("\n").slice(-STDERR_LINES).join("\n");
      const end =
        turn.stop ??
        (exit.missing
          ? { reason: REFUSALS.unavailable(adapter.name), state: "failed" as const }
          : {
              reason: stderr || `${adapter.name} exited with code ${exit.code}.`,
              state: "failed" as const,
            });
      turns.end(live, turn.id, end);
    }
    this.#context.changed(live);
    turns.next(live);
    this.#context.live.prune(live);
  }
}
