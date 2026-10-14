import type { Outgoing } from "./adapter.ts";
import type { Trigger, TurnKind, TurnState } from "./events.ts";
import {
  IDLE_CLOSE_MS,
  type Live,
  type Message,
  REPLACED,
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
    let resolve = () => {};
    const ended = new Promise<void>((done) => (resolve = done));
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
      kind: TurnKind;
      trigger: Trigger | null;
      step: string | null;
      allowed: string | null;
      item: Message;
      message: Outgoing;
      replaced: boolean;
    },
  ): number {
    const { cache } = this.#context;
    const id = cache.addTurn({
      sessionId: live.id,
      kind: turn.kind,
      trigger: turn.trigger,
      step: turn.step,
      allowed: turn.allowed,
      state: "running",
    });
    this.track(id);
    if (turn.replaced) {
      cache.appendItem(id, { kind: "system", text: REPLACED });
    }
    const seq = cache.appendItem(id, turn.item);
    live.messages.set(turn.message.id, { turn: id, seq, item: turn.item, written: true });
    this.#run(live, id, turn.message);
    return id;
  }

  /** Makes the turn the running one, and writes its message. */
  #run(live: Live, id: number, message: Outgoing) {
    clearTimeout(live.idle);
    live.turn = { id, first: message.id, tools: new Map(), terminate: [] };
    this.watch(live, live.turn);
    this.#context.changed(live, id, "running");
    live.proc?.agent.send(message);
  }

  /** Restarts the turn's watchdog. */
  watch(live: Live, turn: Running) {
    clearTimeout(turn.watchdog);
    turn.watchdog = setTimeout(
      () => this.halt(live, turn, { state: "failed", reason: "No output for 30 minutes." }),
      WATCHDOG_MS,
    );
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
  end(live: Live, id: number, end: { state: TurnState; reason?: string }) {
    if (live.turn?.id === id) {
      clearTimeout(live.turn.watchdog);
      live.turn.terminate.forEach(clearTimeout);
      live.turn = undefined;
    }
    try {
      this.#context.cache.endTurn(id, end);
    } catch (error) {
      console.error(`The session manager could not record the end of turn ${id}: ${String(error)}`);
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
    if (proc && !proc.closing) {
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
    let replaced: boolean;
    try {
      ({ replaced } = await processes.open(live));
    } catch (error) {
      // The turns cannot run: each fails with why.
      const reason = String((error as Error).message ?? error).replace(/^refused: /, "");
      for (const turn of live.queue.splice(0)) {
        this.end(live, turn.id, { state: "failed", reason });
      }
      return;
    }
    // Stop, or a take-back, may have ended it while the process opened: the next one starts, or
    // the idle timer does.
    if (live.queue[0] !== queued) {
      this.next(live);
      return;
    }
    live.queue.shift();
    cache.startTurn(queued.id);
    if (replaced) {
      cache.appendItem(queued.id, { kind: "system", text: REPLACED });
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
