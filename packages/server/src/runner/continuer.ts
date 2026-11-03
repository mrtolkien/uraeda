// The automatic continues of the run lifecycle decision: whether a stopped turn continues, and
// when; the switches, the cap, and what sets the count back; the stagger; and the cancels. The
// cache holds every pending continue: a timer only wakes this server to claim one.
import { resolve } from "node:path";
import type { FeatureView } from "uraeda-binding";
import type { SessionRow, TurnRow } from "./cache.ts";
import type { ContinueReason, Limit } from "./events.ts";
import { continuedLine } from "./message.ts";
import { deliverContinue } from "./send.ts";
import {
  type Live,
  ofDropped,
  SERVER_STOPPED,
  type SessionContext,
  TAKEN_BACK,
  type Timer,
} from "./session-state.ts";

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
/** How long after its cut a run the server's stop cut continues at the next start. */
export const RESTART_WINDOW_MS = 6 * 60 * MINUTE_MS;
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
  /** The worktree commit of each session at its last continue, in memory (R5). */
  #commits = new Map<string, string>();
  /**
   * How many times the human or the agent took each session's run over, by a message, Allow, Stop,
   * a dismiss, or going on: a decision that read meanwhile is dropped.
   */
  #takenOver = new Map<string, number>();
  /** Whether `start` ran: the restart's scan waits for it. */
  #started = false;
  /** Whether the server stops: no timer is armed then. */
  #closed = false;
  /** The worktree commit each session's pending continue was decided at, recorded as it fires. */
  #decidedAt = new Map<string, string>();

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
   * asking: a turn failed by a session's limit waits for the reset, and a workflow turn done
   * before its feature's next human gate is asked to go on to it, unless a turn queued after it
   * goes on with the run. A promise while the decision reads the feature, the end published once
   * it settles. A continue's turn that ends without starting, taken back or refused, gives the run
   * back its own reason.
   */
  ended(live: Live, turn: TurnRow, limit?: Limit): Promise<void> | undefined {
    this.#unclaim(turn);
    if (live.queue.length > 0) {
      return undefined;
    }
    const taken = this.#taken(turn.sessionId);
    if (turn.state === "failed" && limit?.kind === "session") {
      return this.#decide(turn, "limit", () => this.#limitContinue(limit), taken);
    }
    if (turn.state === "done" && turn.kind === "workflow") {
      return this.#beforeGate(turn, taken);
    }
    return undefined;
  }

  /**
   * Cancels the session's pending continue, and returns the turns it cancelled: the human's
   * message, or `stopped`, their Stop, which leaves the turn stopped.
   */
  cancel(session: string, { stopped }: { stopped: boolean }): Array<number> {
    return this.#cancel(session, { stopped }).map((turn) => turn.id);
  }

  /**
   * The human's message or Allow takes the place of the session's continue, and sets its count
   * back. Returns the turns cancelled, and what puts the wait and the count back, as they were,
   * for a refused one, which never went.
   */
  takeOver(session: string): { restore: () => void; turns: Array<number> } {
    const { cache } = this.#context;
    const count = cache.session(session)?.automaticContinues ?? 0;
    const cancelled = this.#cancel(session, { stopped: false });
    cache.resetContinues(session);
    const restore = () => {
      cache.resetContinues(session, count);
      for (const { continueAt, continueReason, id } of cancelled) {
        if (
          continueAt !== null &&
          continueReason !== null &&
          cache.scheduleContinue(id, continueAt, continueReason, TAKEN_BACK)
        ) {
          this.#arm(id, continueAt);
        }
      }
    };
    return { restore, turns: cancelled.map((turn) => turn.id) };
  }

  /** Drops the decisions of the session's continue under way: the run was taken over. */
  takenOver(session: string): void {
    this.#takenOver.set(session, this.#taken(session) + 1);
  }

  /** Cancels the session's pending continues, and returns their turns as they waited. */
  #cancel(session: string, { stopped }: { stopped: boolean }): Array<TurnRow> {
    const { cache } = this.#context;
    this.takenOver(session);
    return cache
      .pendingContinues()
      .filter((turn) => turn.sessionId === session && this.#clear(turn.id))
      .filter((turn) => cache.cancelContinue(turn.id, { stopped }));
  }

  /**
   * Claims the turn's continue, and queues its turn in the same step, so the run never reads as
   * stopped between them (R14). Nothing happens when another server or timer claimed it, or a
   * cancel cleared it. A refusal leaves the run asking: the agent gone, the feature moved or
   * dropped, or the run taken over another way. So does a failure of the cache, which writes the
   * turn and the count as one, or not at all.
   */
  fire(turn: number): void {
    this.#timers.delete(turn);
    const { cache, changed, live: sessions } = this.#context;
    const claimed = cache.takeContinue(turn);
    const reason = claimed?.continueReason;
    const row = claimed && cache.session(claimed.sessionId);
    if (!claimed || !reason || !row) {
      return;
    }
    const live = sessions.of(row);
    const refuse = () => {
      cache.cancelContinue(claimed.id, { stopped: false });
      changed(live, claimed.id, claimed.state);
    };
    try {
      if (this.#refused(claimed, row, live)) {
        refuse();
        return;
      }
      let queued: number;
      try {
        queued = deliverContinue(this.#context, live, {
          line: continuedLine(reason),
          reason,
          stopped: claimed,
        });
      } catch (error) {
        process.stderr.write(`The continue of turn ${claimed.id} failed: ${String(error)}\n`);
        refuse();
        return;
      }
      this.#claimed.set(queued, claimed.id);
      const commit = this.#decidedAt.get(row.id);
      if (commit !== undefined) {
        this.#commits.set(row.id, commit);
      }
    } finally {
      sessions.prune(live);
    }
  }

  /**
   * Whether the claimed continue is refused: the agent unavailable, a move or a drop holding the
   * session, or the human took the run over another way, a new session, Allow, or an archive.
   */
  #refused(claimed: TurnRow, row: SessionRow, live: Live): boolean {
    return (
      !this.#available() ||
      this.#context.live.moving(live) ||
      ofDropped(row) ||
      !this.#current(row) ||
      this.#latest(row.id)?.id !== claimed.id
    );
  }

  /**
   * Arms every pending continue, as the server starts: the ones of a kind now off are dropped. Then
   * continues the runs the server's stop cut in the last 6 hours, whose agent kept their session,
   * once the agent works.
   */
  async start(): Promise<void> {
    this.runsChanged();
    const { cache } = this.#context;
    // The limits' overdue waits go a minute apart, in their order, as they would have.
    let overdue = Date.now();
    for (const turn of cache.pendingContinues()) {
      const at = turn.continueAt ?? Date.now();
      if (turn.continueReason === "limit" && at <= Date.now()) {
        this.#arm(turn.id, overdue);
        overdue += MINUTE_MS;
      } else {
        this.#arm(turn.id, at);
      }
    }
    this.#started = true;
    await this.agentBack();
  }

  /**
   * Continues the runs the server's stop cut, once the agent works: at the start, or when a check
   * finds it back. Safe twice: a cut decided once has its continue's reason.
   */
  async agentBack(): Promise<void> {
    if (!this.#started || !this.#available() || !this.#runs().afterRestart) {
      return;
    }
    const { adapter, cache } = this.#context;
    const since = new Date(Date.now() - RESTART_WINDOW_MS).toISOString();
    for (const turn of cache.serverCuts(SERVER_STOPPED, since)) {
      const session = cache.session(turn.sessionId);
      if (session && adapter.hasSession(session.nativeId)) {
        await this.#decide(turn, "restart", Date.now, this.#taken(session.id));
      }
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

  /** Clears every timer, as the server stops: the waits stay in the cache, armed by no timer. */
  close(): void {
    this.#closed = true;
    for (const timer of this.#timers.values()) {
      clearTimeout(timer);
    }
    this.#timers.clear();
  }

  /**
   * Asks a workflow turn done before its feature's next human gate to go on to it: once, so the
   * gate's own continue's turn that ends so asks for the human, halted.
   */
  async #beforeGate(turn: TurnRow, taken: number): Promise<void> {
    const { binding, cache } = this.#context;
    const session = cache.session(turn.sessionId);
    if (!session?.folder || !this.#runs().beforeGate) {
      return;
    }
    // Asked once: the turn of the gate's own continue, sent, stops for the human. A gate past the
    // cap was never asked, so the next stop after the human's message is.
    const [first] = cache.items(turn.id, 0, 1);
    if (first?.kind === "system" && first.text === continuedLine("gate")) {
      return;
    }
    // A feature gone from the repository has no gate to go on to.
    const feature = await binding.readFeature(session.repo, session.folder).catch(() => undefined);
    const step = feature?.step;
    if (step?.waitsOn === "agent" && step.name !== "pull-request-unknown") {
      await this.#decide(turn, "gate", Date.now, taken, feature);
    }
  }

  /**
   * Waits the turn for its continue of `reason` at `at()`, or, at the session's cap, marks it
   * capped: nothing when that kind is off, the session is not its folder's latest, nor a chat, the
   * turn is not its latest, or it was refused an action the human has not allowed. A commit in the
   * feature's worktree since the session's last continue sets its count back to 0 first. The run
   * taken over since `taken`, or the switch turned off, while it reads, drops it.
   */
  async #decide(
    turn: TurnRow,
    reason: ContinueReason,
    at: () => number,
    taken: number,
    feature?: FeatureView,
  ): Promise<void> {
    const { cache } = this.#context;
    const session = cache.session(turn.sessionId);
    if (!session || !this.#runs()[SWITCHES[reason]] || !this.#current(session)) {
      return;
    }
    if (cache.itemsOf(turn.id, "denial").some((denial) => !denial.allowed)) {
      return;
    }
    const commit = await this.#commitOf(session, feature);
    // The human's message, Stop, or a dismiss while the commit was read takes the run over.
    const now = cache.turn(turn.id);
    if (
      this.#taken(session.id) !== taken ||
      !this.#runs()[SWITCHES[reason]] ||
      !now ||
      now.dismissedAt !== null ||
      now.continueReason !== null ||
      this.#latest(session.id)?.id !== turn.id
    ) {
      return;
    }
    if (commit === undefined) {
      this.#decidedAt.delete(session.id);
    } else {
      const recorded = this.#commits.get(session.id);
      if (recorded !== undefined && recorded !== commit) {
        cache.resetContinues(session.id);
      }
      this.#commits.delete(session.id);
      this.#decidedAt.set(session.id, commit);
    }
    const runs = this.#runs();
    if ((cache.session(session.id)?.automaticContinues ?? 0) >= runs.cap) {
      cache.markCapped(turn.id, reason, TAKEN_BACK);
      return;
    }
    const time = at();
    if (cache.scheduleContinue(turn.id, time, reason, TAKEN_BACK)) {
      this.#arm(turn.id, time);
    }
  }

  /**
   * The commit the feature's worktree has checked out, for its count: none for a chat, nor for a
   * feature without a worktree. Read only: the worktree is never created here, nor the repository
   * locked.
   */
  async #commitOf(session: SessionRow, read?: FeatureView): Promise<string | undefined> {
    const { binding } = this.#context;
    if (session.folder === null) {
      return undefined;
    }
    try {
      const feature = read ?? (await binding.readFeature(session.repo, session.folder));
      if (feature.worktree === undefined) {
        return undefined;
      }
      return (await binding.checkoutCommit(resolve(session.repo, feature.worktree))) ?? undefined;
    } catch {
      return undefined;
    }
  }

  /** The session's latest turn, or its latest before turn `before`, skipping those taken back. */
  #latest(session: string, before = Number.POSITIVE_INFINITY): TurnRow | undefined {
    return this.#context.cache
      .turns(session)
      .findLast(
        (turn) => turn.id < before && !(turn.state === "stopped" && turn.reason === TAKEN_BACK),
      );
  }

  /** How many times the session's run was taken over: a decision compares it after its reads. */
  #taken(session: string): number {
    return this.#takenOver.get(session) ?? 0;
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
   * sooner than a minute from now. The runs waiting for one reset go a minute apart: it steps a
   * minute at a time while another limit's continue waits in that minute, so a later wait, as one
   * without a reset, never delays it.
   */
  #limitContinue(limit: Limit): number {
    const now = Date.now();
    const reset = limit.resetsAt === undefined ? Number.NaN : Date.parse(limit.resetsAt);
    const at = Math.max(
      Number.isNaN(reset) ? now + RETRY_WITHOUT_RESET_MS : reset + MINUTE_MS,
      now + MINUTE_MS,
    );
    let time = at;
    while (this.#context.cache.limitContinueWithin(time, time + MINUTE_MS)) {
      time += MINUTE_MS;
    }
    return time;
  }

  /** Arms the turn's timer for `at`, unref'd: it never keeps the server running. */
  #arm(turn: number, at: number) {
    this.#clear(turn);
    if (this.#closed) {
      return;
    }
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
