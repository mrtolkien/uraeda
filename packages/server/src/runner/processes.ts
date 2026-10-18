import { randomUUID } from "node:crypto";
import type { AgentEvent, TokenCounts, UsageLimit } from "./events.ts";
import {
  FRESH,
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
  /** In report order: the newest open process's report wins, even when usage decreased. */
  #limits = new Map<Proc, UsageLimit>();
  #expiry: ReturnType<typeof setTimeout> | undefined;
  /** Each process's agent session total so far, which its next report's own work is counted from. */
  #baselines = new WeakMap<Proc, TokenCounts>();

  constructor(context: SessionContext) {
    this.#context = context;
  }

  /** The freshest unexpired five-hour report from an open process, across repositories. */
  fiveHourLimit(): UsageLimit | null {
    return (
      [...this.#limits.values()]
        .filter((limit) => Date.parse(limit.resetsAt) > Date.now())
        .at(-1) ?? null
    );
  }

  /** Drops expired reports, and publishes expiry even when no process prints another event. */
  #usageChanged() {
    clearTimeout(this.#expiry);
    for (const [proc, limit] of this.#limits) {
      if (Date.parse(limit.resetsAt) <= Date.now()) {
        this.#limits.delete(proc);
      }
    }
    const next = Math.min(...[...this.#limits.values()].map((limit) => Date.parse(limit.resetsAt)));
    this.#expiry = Number.isFinite(next)
      ? setTimeout(() => this.#usageChanged(), Math.min(next - Date.now(), 2_147_483_647))
      : undefined;
    this.#expiry?.unref();
    this.#context.agentChanged();
  }

  /**
   * The session's open process, opened when it has none, or when it is closing: then once it
   * exited. A transcript that is gone starts a new agent session, and so does `fresh`, for a run
   * that starts from the repository alone, the process open closed first: `line` says so, in the
   * session that ran before. `allowed` reopens the process with the rule.
   */
  async open(
    live: Live,
    { allowed, fresh = false }: { allowed?: string; fresh?: boolean } = {},
  ): Promise<{ line?: string; proc: Proc }> {
    const { adapter, binding, cache } = this.#context;
    if (live.proc && !live.proc.closing && allowed === undefined && !fresh) {
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
      const resume = !fresh && adapter.hasSession(row.nativeId);
      const ran = cache.turns(live.id).some((turn) => turn.startedAt !== null);
      // A session that ran before has lost its transcript: Claude Code deletes old ones.
      const line = resume || !ran ? undefined : fresh ? FRESH : REPLACED;
      const nativeId = line === undefined ? row.nativeId : randomUUID();
      if (line !== undefined) {
        cache.updateSession(live.id, { nativeId });
      }
      const agent = adapter.open({
        cwd,
        nativeId,
        resume,
        ...(allowed === undefined ? {} : { allowed }),
      });
      const proc: Proc = {
        agent,
        background: new Map(),
        closing: false,
        cwd,
        done: Promise.resolve(),
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
      if (this.#limits.delete(proc)) {
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
            this.#limits.delete(proc);
            this.#limits.set(proc, event.fiveHour);
            this.#usageChanged();
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
    const { adapter, cache, turns } = this.#context;
    if (this.#limits.delete(proc)) {
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
