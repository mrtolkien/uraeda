import { randomUUID } from "node:crypto";
import type { AgentEvent } from "./events.ts";
import {
  type Live,
  type Proc,
  REFUSALS,
  refused,
  rowOf,
  type SessionContext,
  TERMINATE_AFTER_MS,
} from "./session-state.ts";

/** A turn failed by its process's exit keeps this many lines of its stderr. */
const STDERR_LINES = 20;

type Exit = Extract<AgentEvent, { type: "exit" }>;

/**
 * The sessions' processes: at most one per session, across servers, opened in the session's
 * directory, read to their exit, and closed with a bounded wait.
 */
export class Processes {
  #context: SessionContext;

  constructor(context: SessionContext) {
    this.#context = context;
  }

  /**
   * The session's open process, opened when it has none, or when it is closing: then once it
   * exited. A transcript that is gone starts a new agent session. `allowed` reopens the process
   * with the rule.
   */
  async open(live: Live, allowed?: string): Promise<{ proc: Proc; replaced: boolean }> {
    const { cache, adapter, binding } = this.#context;
    if (live.proc && !live.proc.closing && allowed === undefined) {
      return { proc: live.proc, replaced: false };
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
      const resume = adapter.hasSession(row.nativeId);
      // A session that ran before has lost its transcript: Claude Code deletes old ones.
      const replaced = !resume && cache.turns(live.id).some((turn) => turn.startedAt !== null);
      const nativeId = replaced ? randomUUID() : row.nativeId;
      if (replaced) {
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
        cwd,
        closing: false,
        done: Promise.resolve(),
        terminate: [],
        background: new Set(),
      };
      live.proc = proc;
      proc.done = this.#consume(live, proc);
      return { proc, replaced };
    } catch (error) {
      cache.releaseSession(live.id);
      throw error;
    }
  }

  /**
   * Closes the process once its turn is over: it exits, and is reopened by the next message. One
   * that is still running 10 seconds later gets SIGTERM, and SIGKILL 10 seconds after that, so that
   * no send, nor the server's stop, waits on it forever.
   */
  close(proc: Proc) {
    if (!proc.closing) {
      proc.closing = true;
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
        this.#context.transcript.record(live, proc, event);
      } catch (error) {
        // A cache write that fails does not stop the session.
        console.error(
          `The session manager could not record an event of ${live.id}: ${String(error)}`,
        );
      }
    }
    this.#exited(live, proc, { type: "exit", code: null, stderr: "" });
  }

  /** The process exited: its turn ends, and the queued turns start on a new one. */
  #exited(live: Live, proc: Proc, exit: Exit) {
    const { cache, adapter, turns } = this.#context;
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
          ? { state: "failed" as const, reason: REFUSALS.unavailable(adapter.name) }
          : {
              state: "failed" as const,
              reason: stderr || `${adapter.name} exited with code ${exit.code}.`,
            });
      turns.end(live, turn.id, end);
    }
    this.#context.changed(live);
    turns.next(live);
    this.#context.live.prune(live);
  }
}
