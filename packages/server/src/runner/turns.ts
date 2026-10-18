import { working } from "./activity.ts";
import type { Outgoing } from "./adapter.ts";
import type { Trigger, TurnKind, TurnState } from "./events.ts";
import { recheckQueued } from "./send-input.ts";
import {
  IDLE_CLOSE_MS,
  type Live,
  type Message,
  type Proc,
  RESUMED,
  type Running,
  type Sent,
  type SessionContext,
  TERMINATE_AFTER_MS,
  type TurnEnd,
  WATCHDOG_MS,
} from "./session-state.ts";

/**
 * The sessions' turns: one running per session, the others queued after it. A turn is started,
 * watched for output, halted, and ended, and its messages are forgotten once the agent cannot read
 * them any more.
 */
export class Turns {
  #context: SessionContext;
  /** The turns not ended yet, which `settled` waits for. */
  #pending = new Map<number, { ended: Promise<void>; resolve: () => void }>();

  constructor(context: SessionContext) {
    this.#context = context;
  }

  /** Records that the turn will end, for `settled`. */
  track(turn: number) {
    const { promise: ended, resolve } = Promise.withResolvers<void>();
    this.#pending.set(turn, { ended, resolve });
  }

  /** Resolves once the turn has ended, at once when this server does not run it. */
  async settled(turn: number): Promise<void> {
    await this.#pending.get(turn)?.ended;
  }

  /** Starts a turn on the open process, and writes its message. */
  begin(
    live: Live,
    turn: {
      allowed: string | null;
      item: Message;
      kind: TurnKind;
      /** The system line it opens with, when its process started a new agent session. */
      line?: string;
      message: Outgoing;
      step: string | null;
      trigger: Trigger | null;
    },
  ): number {
    const { cache } = this.#context;
    const id = cache.addTurn({
      allowed: turn.allowed,
      kind: turn.kind,
      sessionId: live.id,
      state: "running",
      step: turn.step,
      trigger: turn.trigger,
    });
    this.track(id);
    if (turn.line !== undefined) {
      cache.appendItem(id, { kind: "system", text: turn.line });
    }
    const seq = cache.appendItem(id, turn.item);
    live.messages.set(turn.message.id, { item: turn.item, seq, turn: id, written: true });
    this.#run(live, id, turn.message);
    return id;
  }

  /** Makes the turn the running one, and writes its message. */
  #run(live: Live, id: number, message: Outgoing) {
    this.#open(live, id, message.id);
    live.proc?.agent.send(message);
  }

  /** Makes the turn the running one, started by the message `first`. */
  #open(live: Live, id: number, first: string): Running {
    clearTimeout(live.idle);
    live.turn = { activity: working(), first, id, terminate: [], tools: new Map() };
    this.watch(live, live.turn);
    this.#context.changed(live, id, "running");
    return live.turn;
  }

  /**
   * Reopens the turn that last ended on the process, whose agent goes on by itself: a background
   * task reported back. Without it, its output would show nowhere, and the idle timer would close
   * the process mid-work. None when a turn runs or starts, or the process is closing.
   */
  resume(live: Live, proc: Proc): Running | undefined {
    const ended = proc.ended;
    if (!ended || live.turn || live.queue.length > 0 || proc.closing || live.proc !== proc) {
      return undefined;
    }
    const { cache } = this.#context;
    cache.reopenTurn(ended.id);
    cache.appendItem(ended.id, { kind: "system", text: RESUMED });
    this.track(ended.id);
    return this.#open(live, ended.id, ended.first);
  }

  /**
   * Restarts the turn's watchdog, which waits while a background task runs: the agent's own limit
   * stops a background command.
   */
  watch(live: Live, turn: Running) {
    clearTimeout(turn.watchdog);
    turn.watchdog = setTimeout(() => {
      if ((live.proc?.background.size ?? 0) > 0) {
        this.watch(live, turn);
        return;
      }
      this.halt(live, turn, { reason: "No output for 30 minutes.", state: "failed" });
    }, WATCHDOG_MS);
  }

  /**
   * Interrupts the turn, which then ends as `end` says: SIGINT when it has not ended 10 seconds
   * later, and SIGTERM 10 seconds after that. Its messages not read yet are taken back, and marked
   * so by the agent's `cancelled`.
   */
  halt(live: Live, turn: Running, end: TurnEnd) {
    if (turn.stop) {
      return;
    }
    turn.stop = end;
    clearTimeout(turn.watchdog);
    const proc = live.proc;
    if (!proc) {
      return;
    }
    for (const [id] of this.unread(live, turn)) {
      proc.agent.takeBack(id);
    }
    proc.agent.interrupt();
    turn.terminate.push(
      setTimeout(() => proc.agent.kill("SIGINT"), TERMINATE_AFTER_MS),
      setTimeout(() => proc.agent.kill("SIGTERM"), 2 * TERMINATE_AFTER_MS),
    );
  }

  /**
   * The messages steered into the turn that the agent has not read, which it can take back: none
   * when it cannot.
   */
  unread(live: Live, turn: Running): Array<[string, Sent]> {
    if (!this.#context.adapter.capabilities.takeBack) {
      return [];
    }
    return [...live.messages].filter(
      ([id, sent]) =>
        sent.turn === turn.id && sent.written && sent.item.state === "pending" && id !== turn.first,
    );
  }

  /** Records the end of a turn, running or queued. */
  end(live: Live, id: number, end: { reason?: string; state: TurnState }) {
    if (live.turn?.id === id) {
      clearTimeout(live.turn.watchdog);
      live.turn.terminate.forEach(clearTimeout);
      if (live.proc) {
        live.proc.ended = { first: live.turn.first, id };
      }
      live.turn = undefined;
    }
    try {
      this.#context.cache.endTurn(id, end);
    } catch (error) {
      process.stderr.write(
        `The session manager could not record the end of turn ${id}: ${String(error)}\n`,
      );
    }
    this.#pending.get(id)?.resolve();
    this.#pending.delete(id);
    this.#forget(live, id);
    this.#context.changed(live, id, end.state);
  }

  /** Forgets the messages of the turn once it ended, but those the agent may still read. */
  #forget(live: Live, turn: number) {
    if (live.turn?.id === turn || live.queue.some((queued) => queued.id === turn)) {
      return;
    }
    for (const [id, sent] of live.messages) {
      if (sent.turn === turn && sent.item.state !== "pending") {
        live.messages.delete(id);
      }
    }
  }

  /** Marks a message read or taken back. */
  mark(live: Live, sent: Sent, state: Message["state"]) {
    sent.item = { ...sent.item, state };
    this.#context.cache.updateItem(sent.turn, sent.seq, sent.item);
    this.#context.changed(live, sent.turn);
    this.#forget(live, sent.turn);
  }

  /** After a turn: the next queued turn starts, or the idle timer does. */
  next(live: Live) {
    if (live.turn) {
      return;
    }
    if (live.queue.length > 0) {
      void this.#context.live.serial(live, () => this.#startQueued(live));
      return;
    }
    clearTimeout(live.idle);
    const proc = live.proc;
    // A background task still runs: the idle timer starts once it ends.
    if (proc && !proc.closing && proc.background.size === 0) {
      live.idle = setTimeout(() => this.#context.processes.close(proc), IDLE_CLOSE_MS);
    }
  }

  /** Starts the first queued turn, reopening the process when it is gone. */
  async #startQueued(live: Live): Promise<void> {
    const { cache, processes } = this.#context;
    if (live.turn) {
      return;
    }
    const queued = live.queue[0];
    if (!queued) {
      return;
    }
    let line: string | undefined;
    try {
      await recheckQueued(this.#context, live, queued);
      ({ line } = await processes.open(live, { fresh: queued.fresh === true }));
    } catch (error) {
      // The turns cannot run: each fails with why.
      const reason = String((error as Error).message ?? error).replace(/^refused: /, "");
      for (const turn of live.queue.splice(0)) {
        this.end(live, turn.id, { reason, state: "failed" });
      }
      return;
    }
    // Stop, or a take-back, may have ended it while the process opened: the next one starts, or
    // the idle timer does.
    if (live.queue[0] !== queued) {
      if (line !== undefined && live.proc) {
        live.proc.line = line;
      }
      this.next(live);
      return;
    }
    live.queue.shift();
    cache.startTurn(queued.id);
    if (line !== undefined) {
      cache.appendItem(queued.id, { kind: "system", text: line });
    }
    this.#run(live, queued.id, queued.message);
  }

  /** Clears the timers of the session's running turn. */
  clearTimers(live: Live) {
    if (live.turn) {
      clearTimeout(live.turn.watchdog);
      live.turn.terminate.forEach(clearTimeout);
    }
  }
}
