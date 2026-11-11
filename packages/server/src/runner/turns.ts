import { randomUUID } from "node:crypto";
import { waitingLabel, working } from "./activity.ts";
import type { Outgoing } from "./adapter.ts";
import type { Limit, Trigger, TurnKind, TurnState } from "./events.ts";
import { messageItem, recheckQueued } from "./send-input.ts";
import {
  IDLE_CLOSE_MS,
  type Live,
  type Message,
  type Proc,
  type Queued,
  QUIET_MS,
  quietCheck,
  RESUMED,
  runtimeOf,
  SERVER_STOPPED,
  type Running,
  type Sent,
  type SessionContext,
  TERMINATE_AFTER_MS,
  type TurnEnd,
  UNANSWERED,
  WAKEUP_GRACE_MS,
  WATCHDOG_MS,
  wakeupPending,
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
      /** A catch-up's commit of the default branch. */
      caughtUpTo?: string | null;
      item: Message;
      kind: TurnKind;
      /**
       * The system lines it opens with: its process's, when it started a new agent session, and
       * its workflow message's, as a catch-up's.
       */
      lines?: Array<string>;
      message: Outgoing;
      step: string | null;
      trigger: Trigger | null;
    },
  ): number {
    const { cache } = this.#context;
    // The turn, its lines, and its message are written as one, or not at all.
    const { id, seq } = cache.atomically(() => {
      const id = cache.addTurn({
        allowed: turn.allowed,
        caughtUpTo: turn.caughtUpTo ?? null,
        kind: turn.kind,
        sessionId: live.id,
        state: "running",
        step: turn.step,
        trigger: turn.trigger,
      });
      for (const text of turn.lines ?? []) {
        cache.appendItem(id, { kind: "system", text });
      }
      return { id, seq: cache.appendItem(id, turn.item) };
    });
    this.track(id);
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
    const { cache, continuer } = this.#context;
    // The agent goes on by itself: the run no longer waits to continue.
    continuer.cancel(live.id, { stopped: false });
    cache.reopenTurn(ended.id);
    cache.appendItem(ended.id, { kind: "system", text: RESUMED });
    this.track(ended.id);
    return this.#open(live, ended.id, ended.first);
  }

  /**
   * Stops a run that waits for its agent's own wakeup, no turn running: its process closes, which
   * drops the wakeup, so nothing reopens its turn, and its last turn, done, reads stopped by the
   * human. Nothing without a pending wakeup.
   */
  stopWakeup(live: Live) {
    const proc = live.proc;
    if (live.turn || !proc || !wakeupPending(proc)) {
      return;
    }
    this.#context.processes.close(proc);
    const ended = proc.ended?.id;
    if (ended !== undefined && this.#context.cache.stopEnded(ended)) {
      this.#context.changed(live, ended, "stopped");
    }
  }

  /**
   * Restarts the turn's watchdog, as it shows something new. It waits while a background task
   * runs, and while the session's sub-sessions work or one of its tool calls waits for them: their
   * own watchdogs stop them. A reply that ended and waits for its background tasks is checked
   * instead, `#check`.
   */
  watch(live: Live, turn: Running) {
    turn.asked = undefined;
    this.#watchdog(live, turn);
    this.#check(live, turn);
  }

  #watchdog(live: Live, turn: Running) {
    clearTimeout(turn.watchdog);
    turn.watchdog = setTimeout(() => {
      if ((live.proc?.background.size ?? 0) > 0 || this.#context.subSessions.busy(live.id)) {
        this.#watchdog(live, turn);
        return;
      }
      this.halt(live, turn, { reason: "No output for 30 minutes.", state: "failed" });
    }, WATCHDOG_MS);
  }

  /**
   * Checks a turn whose reply ended and that waits for its background tasks, after `QUIET_MS`
   * without output: a command that never ends would hold it forever, and its parent's call with
   * it. The agent is asked to look at them, in a message steered into the turn; with no output
   * `QUIET_MS` after it, the turn fails, and its process closes, which ends its commands. Nothing
   * for an agent that cannot be steered.
   */
  #check(live: Live, turn: Running) {
    clearTimeout(turn.quiet);
    turn.quiet = setTimeout(() => {
      const proc = live.proc;
      if (live.turn !== turn || turn.stop) {
        return;
      }
      const waits = turn.replied && proc && !proc.closing && proc.background.size > 0;
      if (!waits || !proc.runtime.capabilities.steer) {
        this.#check(live, turn);
        return;
      }
      if (turn.asked) {
        this.halt(live, turn, { reason: UNANSWERED, state: "failed" });
        this.#context.processes.close(proc);
        return;
      }
      turn.asked = true;
      const id = randomUUID();
      const text = quietCheck(waitingLabel(proc.background));
      const item = messageItem(id, "workflow", text);
      const seq = this.#context.cache.appendItem(turn.id, item);
      live.messages.set(id, { item, seq, turn: turn.id, written: true });
      this.#context.changed(live, turn.id);
      proc.agent.send({ id, images: [], text, when: "steer" });
      this.#check(live, turn);
    }, QUIET_MS);
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
    clearTimeout(turn.quiet);
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
    if (!runtimeOf(this.#context, live)?.capabilities.takeBack) {
      return [];
    }
    return [...live.messages].filter(
      ([id, sent]) =>
        sent.turn === turn.id && sent.written && sent.item.state === "pending" && id !== turn.first,
    );
  }

  /**
   * Records the end of a turn, running or queued, and reports it to the continuer, then to the step
   * chain. A running turn that failed or stopped, but by a usage limit or the server's stop, stops
   * the session's sub-sessions: nothing waits for their answers any more. The end is published once the continuer decided, or the chain sent the next step's run,
   * so a run that waits to continue, or goes on with its next step, never reads as asking.
   */
  end(live: Live, id: number, end: { reason?: string; state: TurnState }) {
    const running = live.turn?.id === id ? live.turn : undefined;
    if (running) {
      clearTimeout(running.watchdog);
      clearTimeout(running.quiet);
      running.terminate.forEach(clearTimeout);
      if (live.proc) {
        live.proc.ended = { first: running.first, id };
      }
      live.turn = undefined;
    }
    // A limit counts only when it failed the turn on its own, not halted.
    const limit = end.state === "failed" && !running?.stop ? running?.limit : undefined;
    const failed = (error: unknown) =>
      process.stderr.write(
        `The session manager could not record the end of turn ${id}: ${String(error)}\n`,
      );
    let deciding: Promise<void> | undefined;
    try {
      this.#context.cache.endTurn(id, end);
      const row = this.#context.cache.turn(id);
      deciding =
        row &&
        (this.#context.continuer.ended(live, row, limit) ?? this.#context.chain.ended(live, row));
    } catch (error) {
      failed(error);
    }
    if (running && endsSubSessions(end, limit)) {
      this.#context.subSessions.stopAll(live.id);
    }
    this.#forget(live, id);
    if (deciding) {
      // Every change of the session waits for the decision: the process's exit publishes too.
      live.held ??= { changes: [], deciding: 0 };
      live.held.deciding += 1;
      void deciding.catch(failed).then(() => this.#release(live, id, end.state));
    } else {
      this.#ended(live, id, end.state);
    }
  }

  /** Publishes the turn's end once decided, then the session's changes held meanwhile. */
  #release(live: Live, id: number, state: TurnState) {
    const held = live.held;
    if (held && --held.deciding === 0) {
      live.held = undefined;
    }
    this.#ended(live, id, state);
    if (held && live.held === undefined) {
      for (const [turn, changed] of held.changes) {
        this.#context.changed(live, turn, changed);
      }
      this.#context.live.prune(live);
    }
  }

  /** Publishes the turn's end, and lets `settled` resolve. */
  #ended(live: Live, id: number, state: TurnState) {
    this.#pending.get(id)?.resolve();
    this.#pending.delete(id);
    this.#context.changed(live, id, state);
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
    // A background task still runs: the idle timer starts once it ends. A pending wakeup holds the
    // process open until a minute after it, for the agent to go on by itself.
    if (proc && !proc.closing && proc.background.size === 0) {
      const wakeup = (proc.wakeup ?? 0) + WAKEUP_GRACE_MS - Date.now();
      live.idle = setTimeout(
        () => this.#context.processes.close(proc),
        Math.max(IDLE_CLOSE_MS, wakeup),
      );
    }
    this.wake(live);
  }

  /**
   * Starts the turns of the change's or feature's other sessions that waited for this one, now
   * idle: the first to start makes the others wait again.
   */
  wake(live: Live) {
    for (const other of this.#context.live.waiting(live)) {
      this.next(other);
    }
  }

  /**
   * Starts the first queued turn, reopening the process when it is gone. It waits while another
   * session of its change or feature works: that one wakes it once idle.
   */
  async #startQueued(live: Live): Promise<void> {
    const { cache, live: sessions } = this.#context;
    if (live.turn) {
      return;
    }
    const queued = live.queue[0];
    if (!queued || sessions.otherWorking(live, { queued: false })) {
      return;
    }
    let line: string | undefined;
    live.starting = true;
    try {
      line = await this.#prepare(live, queued);
    } catch (error) {
      // The turns cannot run: each fails with why.
      const reason = String((error as Error).message ?? error).replace(/^refused: /, "");
      for (const turn of live.queue.splice(0)) {
        this.end(live, turn.id, { reason, state: "failed" });
      }
      this.wake(live);
      return;
    } finally {
      live.starting = false;
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

  /** Checks the queued turn again, and opens the process it starts on: the line of a new one. */
  async #prepare(live: Live, queued: Queued): Promise<string | undefined> {
    await recheckQueued(this.#context, live, queued);
    return (await this.#context.processes.open(live)).line;
  }

  /** Clears the timers of the session's running turn. */
  clearTimers(live: Live) {
    if (live.turn) {
      clearTimeout(live.turn.watchdog);
      clearTimeout(live.turn.quiet);
      live.turn.terminate.forEach(clearTimeout);
    }
  }
}

/**
 * Whether a running turn's end stops its session's sub-sessions: a failure, but a usage limit's,
 * or a stop, but the server's, whose runs continue after it (R21).
 */
function endsSubSessions(end: { reason?: string; state: TurnState }, limit: Limit | undefined) {
  return (
    (end.state === "failed" && limit === undefined) ||
    (end.state === "stopped" && end.reason !== SERVER_STOPPED)
  );
}
