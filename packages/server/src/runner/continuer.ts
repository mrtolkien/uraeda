// The automatic continues of the run lifecycle decision: whether a stopped turn continues, and
// when; the switches, the cap, and what sets the count back; the stagger; and the cancels. The
// cache holds every pending continue: a timer only wakes this server to claim one.
import type { SessionRow, TurnRow } from "./cache.ts";
import type { ContinueReason, Limit } from "./events.ts";
import { continuedLine } from "./message.ts";
import { deliverContinue } from "./send.ts";
import { type Live, REFUSALS, refused, type SessionContext, type Timer } from "./session-state.ts";

/** Which automatic continues are on, and how many in a row a session takes: the `[runs]` settings. */
export type ContinueSettings = {
  afterLimit: boolean;
  afterRestart: boolean;
  beforeGate: boolean;
  cap: number;
};

/** Every automatic continue on, at most 3 in a row: the settings' defaults. */
export const CONTINUES_ON: ContinueSettings = {
  afterLimit: true,
  afterRestart: true,
  beforeGate: true,
  cap: 3,
};

/** Every automatic continue off, as the tests start (R4). */
export const CONTINUES_OFF: ContinueSettings = {
  afterLimit: false,
  afterRestart: false,
  beforeGate: false,
  cap: 3,
};

const MINUTE_MS = 60_000;
/** A limit without a reset time is tried again this long after, each try counting toward the cap. */
export const RETRY_WITHOUT_RESET_MS = 60 * MINUTE_MS;
/** The longest wait of a timer: past it, `setTimeout` fires at once. */
const LONGEST_TIMER_MS = 2 ** 31 - 1;

/** The setting that turns each kind of continue off. */
const SWITCHES: Record<ContinueReason, Exclude<keyof ContinueSettings, "cap">> = {
  gate: "beforeGate",
  limit: "afterLimit",
  restart: "afterRestart",
};

/**
 * The session manager's automatic continues. `Turns.end` reports each end to `ended`, which waits
 * the run for its continue in the cache, with a timer, or marks it capped. The timer claims the
 * continue, once whatever server or timer looks, and queues its turn; a message, Stop, a dismiss,
 * or a setting turned off clears it in the cache.
 */
export class Continuer {
  #context: SessionContext;
  #available: () => boolean;
  #runs: () => ContinueSettings;
  /** The timer of each pending continue this server armed, by its turn. */
  #timers = new Map<number, Timer>();
  /** The turn each continue queued, mapped to the turn it continues, until it ends. */
  #claimed = new Map<number, number>();

  constructor(
    context: SessionContext,
    options: { available: () => boolean; runs: () => ContinueSettings },
  ) {
    this.#context = context;
    this.#available = options.available;
    this.#runs = options.runs;
  }

  /**
   * Decides the continue of a turn that ended, before its end is published, so it never reads as
   * asking: a turn failed by a session's limit waits for the reset, unless a turn queued after it
   * goes on with the run. A promise while the decision reads more than the cache, the end
   * published once it settles. A continue's turn that ends without starting, taken back or
   * refused, gives the run back its own reason.
   */
  ended(live: Live, turn: TurnRow, limit?: Limit): Promise<void> | undefined {
    this.#unclaim(turn);
    if (turn.state === "failed" && limit?.kind === "session" && live.queue.length === 0) {
      this.#decide(turn, "limit", this.#limitContinue(limit));
    }
    return undefined;
  }

  /**
   * Cancels the session's pending continue, and returns the turns it cancelled: the human's
   * message, or `stopped`, their Stop, which leaves the turn stopped.
   */
  cancel(session: string, { stopped }: { stopped: boolean }): Array<number> {
    const { cache } = this.#context;
    return cache
      .pendingContinues()
      .filter((turn) => turn.sessionId === session && this.#clear(turn.id))
      .filter((turn) => cache.cancelContinue(turn.id, { stopped }))
      .map((turn) => turn.id);
  }

  /**
   * Claims the turn's continue, and queues its turn in the same step, so the run never reads as
   * stopped between them (R14). Nothing happens when another server or timer claimed it, or a
   * cancel cleared it. A refusal, the agent gone or the feature dropped, leaves the run asking.
   */
  fire(turn: number): void {
    this.#timers.delete(turn);
    const { adapter, cache, changed, live: sessions } = this.#context;
    const claimed = cache.takeContinue(turn);
    const reason = claimed?.continueReason;
    const row = claimed && cache.session(claimed.sessionId);
    if (!claimed || !reason || !row) {
      return;
    }
    const live = sessions.of(row);
    try {
      if (!this.#available()) {
        throw refused(REFUSALS.unavailable(adapter.name));
      }
      const line = continuedLine(reason);
      const queued = deliverContinue(this.#context, live, { line, reason, stopped: claimed });
      cache.addContinue(row.id);
      this.#claimed.set(queued, claimed.id);
    } catch {
      cache.cancelContinue(claimed.id, { stopped: false });
      changed(live, claimed.id, claimed.state);
    } finally {
      sessions.prune(live);
    }
  }

  /** Arms every pending continue, as the server starts: the ones of a kind now off are dropped. */
  async start(): Promise<void> {
    this.runsChanged();
    for (const turn of this.#context.cache.pendingContinues()) {
      this.#arm(turn.id, turn.continueAt ?? Date.now());
    }
  }

  /** Drops the pending continues of each kind whose setting is now off: their runs ask. */
  runsChanged(): void {
    const { cache } = this.#context;
    const runs = this.#runs();
    for (const [reason, setting] of Object.entries(SWITCHES) as Array<
      [ContinueReason, (typeof SWITCHES)[ContinueReason]]
    >) {
      if (runs[setting]) {
        continue;
      }
      for (const turn of cache.dropContinues(reason)) {
        this.#clear(turn.id);
        this.#publish(turn);
      }
    }
  }

  /** Clears every timer, as the server stops. */
  close(): void {
    for (const timer of this.#timers.values()) {
      clearTimeout(timer);
    }
    this.#timers.clear();
  }

  /**
   * Waits the turn for its continue of `reason` at `at`, or, at the session's cap, marks it capped:
   * nothing when that kind is off, or the session is not its folder's latest, nor a chat.
   */
  #decide(turn: TurnRow, reason: ContinueReason, at: number): void {
    const { cache } = this.#context;
    const session = cache.session(turn.sessionId);
    const runs = this.#runs();
    if (!session || !runs[SWITCHES[reason]] || !this.#current(session)) {
      return;
    }
    if (session.automaticContinues >= runs.cap) {
      cache.markCapped(turn.id, reason);
      return;
    }
    cache.scheduleContinue(turn.id, at, reason);
    this.#arm(turn.id, at);
  }

  /** Whether the session's runs continue: a chat, or its folder's latest session, not archived. */
  #current(session: SessionRow): boolean {
    if (session.archivedAt !== null) {
      return false;
    }
    return (
      session.folder === null ||
      this.#context.cache.latestSession(session.repo, session.folder)?.id === session.id
    );
  }

  /**
   * When a limit's continue goes: a minute after its reset, an hour from now without one, never
   * sooner than a minute from now, and a minute after the latest limit's continue at that time or
   * later, so the runs waiting for one reset go one by one.
   */
  #limitContinue(limit: Limit): number {
    const now = Date.now();
    const reset = limit.resetsAt === undefined ? Number.NaN : Date.parse(limit.resetsAt);
    const at = Math.max(
      Number.isNaN(reset) ? now + RETRY_WITHOUT_RESET_MS : reset + MINUTE_MS,
      now + MINUTE_MS,
    );
    const latest = this.#context.cache.latestLimitContinue(at);
    return latest === undefined ? at : latest + MINUTE_MS;
  }

  /** Arms the turn's timer for `at`, unref'd: it never keeps the server running. */
  #arm(turn: number, at: number) {
    this.#clear(turn);
    const wait = Math.max(0, at - Date.now());
    const timer =
      wait > LONGEST_TIMER_MS
        ? setTimeout(() => this.#arm(turn, at), LONGEST_TIMER_MS)
        : setTimeout(() => this.fire(turn), wait);
    timer.unref();
    this.#timers.set(turn, timer);
  }

  /** Clears the turn's timer; always true, to filter with. */
  #clear(turn: number): true {
    clearTimeout(this.#timers.get(turn));
    this.#timers.delete(turn);
    return true;
  }

  /**
   * Forgets a continue's turn once it ends: one that never started, taken back, stopped, or
   * refused, clears the reason of the turn it continued, which would read capped again.
   */
  #unclaim(turn: TurnRow) {
    const continued = this.#claimed.get(turn.id);
    if (continued === undefined) {
      return;
    }
    this.#claimed.delete(turn.id);
    if (turn.startedAt === null) {
      this.#context.cache.cancelContinue(continued, { stopped: false });
    }
  }

  /** Publishes the turn's change, its session kept in memory only while it is. */
  #publish(turn: TurnRow) {
    const { cache, changed, live: sessions } = this.#context;
    const row = cache.session(turn.sessionId);
    if (!row) {
      return;
    }
    const live = sessions.of(row);
    changed(live, turn.id, turn.state);
    sessions.prune(live);
  }
}
