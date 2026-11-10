import { allowAll, allowDenial } from "./allow.ts";
import type { Adapter } from "./adapter.ts";
import type { SessionCache, SessionRow } from "./cache.ts";
import { Chain } from "./chain.ts";
import { CONTINUES_ON, Continuer } from "./continuer.ts";
import type { TurnActivity, UsageWindow } from "./events.ts";
import { LiveSessions, working } from "./live-sessions.ts";
import { AccountRefresh, accountRecords } from "./account-records.ts";
import { Processes } from "./processes.ts";
import {
  type AccountRecord,
  readySession,
  type Runtimes,
  runsOn,
  sessionRuntime,
} from "./runtimes.ts";
import { checkSend, type SendInput } from "./send-input.ts";
import { sendTo } from "./send.ts";
import { newPickOf, stepPickOf } from "./run-session.ts";
import type { SessionPick } from "./picks.ts";
import { archive, dismiss, rename, seen, setEffort, stopRun } from "./session-edits.ts";
import { archiveFolder, attach, featureSession, newChat, newSession } from "./session-folders.ts";
import { takeBack } from "./take-back.ts";
import { StartMessages } from "./start-messages.ts";
import { Reviews } from "./reviews.ts";
import { SubSessions } from "./sub-sessions.ts";
import {
  type Live,
  REFUSALS,
  commandCount,
  refused,
  SERVER_STOPPED,
  type SessionContext,
  type SessionsOptions,
  wakeupPending,
} from "./session-state.ts";
import { Transcript } from "./transcript.ts";
import { Turns } from "./turns.ts";

export { type ContinueSettings } from "./continuer.ts";
export { type SendInput, type SentImage } from "./send-input.ts";
export {
  IDLE_CLOSE_MS,
  MAX_IMAGES,
  OUTPUT_LIMIT,
  REFUSALS,
  RESUMED,
  SERVER_STOPPED,
  type SessionChange,
  TERMINATE_AFTER_MS,
  WATCHDOG_MS,
} from "./session-state.ts";

/**
 * Sessions of turns with agents: at most one process and one turn per session, and one working
 * session per change or feature, whose sessions work in its worktree; a chat in the main checkout.
 * Turns and their items go to the cache, and every change to `onChange`.
 *
 * It answers the server's calls, and leaves the rest to its parts: the sessions kept in memory,
 * their processes, their turns, and the transcript their events are recorded in.
 */
export class Sessions {
  #options: SessionsOptions;
  #unsubscribe: () => void;
  /** Each repository's main checkout, by the path it was given as. */
  #roots = new Map<string, string>();
  #context: SessionContext;
  /** The messages sent to features whose start is still in the write queue. */
  readonly starts: StartMessages;
  /** The sessions Uraeda starts for its workflow runs' sub-agents. */
  readonly subSessions: SubSessions;
  /** The reviews its workflow sessions run, each reviewer at once. */
  readonly reviews: Reviews;
  readonly #accountRefresh: AccountRefresh;

  constructor(options: SessionsOptions) {
    this.#options = options;
    this.starts = new StartMessages(options.cache);
    // Each part reaches the others through the context, filled once they are all made.
    const context = {
      agentChanged: () => options.onChange({ agent: true }),
      binding: options.binding,
      cache: options.cache,
      changed: (live, turn, state) => {
        if (live.held) {
          live.held.changes.push([turn, state]);
          return;
        }
        options.onChange({
          folder: live.folder,
          repo: live.repo,
          session: live.id,
          ...(turn === undefined ? {} : { turn }),
          ...(state === undefined ? {} : { state }),
        });
      },
      live: new LiveSessions(),
      ...(options.mcp === undefined ? {} : { mcp: options.mcp }),
      queue: options.queue ?? (() => undefined),
      runOptions: options.runOptions ?? (() => ({ steps: [] })),
      runtimes: options.runtimes,
    } as SessionContext;
    context.processes = new Processes(context);
    context.turns = new Turns(context);
    context.transcript = new Transcript(context);
    context.chain = new Chain(context);
    const { runtimes } = options;
    context.continuer = new Continuer(context, {
      available: (row) => runsOn(runtimes, row),
      hosted: options.hosted ?? (() => true),
      runs: options.runs ?? (() => CONTINUES_ON),
    });
    this.#context = context;
    this.subSessions = new SubSessions(context);
    context.subSessions = this.subSessions;
    this.reviews = new Reviews(context);
    // A runtime registered, unregistered, or turned on or off is checked, and shown, at once. One
    // turned on finds no change of availability, but continues the runs a restart cut on it.
    this.#accountRefresh = new AccountRefresh(
      runtimes,
      (runtime) => this.accounts(runtime),
      () => runtimes.changed(),
    );
    this.#unsubscribe = runtimes.onChange(() => {
      options.onChange({ agent: true });
      this.refreshAccounts();
      void this.check({ continueCuts: true });
    });
    this.refreshAccounts();
  }

  /** The cache the sessions are written to, which the server reads them from. */
  get cache(): SessionCache {
    return this.#options.cache;
  }

  /** The runtimes sessions run on. */
  get runtimes(): Runtimes {
    return this.#options.runtimes;
  }

  /** The runtime the session runs on, by its stored `agent`: undefined while unregistered. */
  runtimeOf(session: string): Adapter | undefined {
    const row = this.cache.session(session);
    return row && this.runtimes.get(row.agent);
  }

  /** The runtime's usage windows, from its open processes' freshest reports. */
  usage(runtime: string): Array<UsageWindow> {
    return this.#context.processes.usage(runtime);
  }

  /** The runtime's accounts, each with the freshest usage of an ask or an open process. */
  accounts(runtime: string): Array<AccountRecord> {
    return accountRecords(this.runtimes, runtime, this.#context.processes.reports(runtime));
  }

  /** Asks each stale account's usage, announcing the runtimes only when an answer changed one. */
  refreshAccounts(): void {
    this.#accountRefresh.run();
  }

  /**
   * Asks each runtime for its version, and reports a change of availability. A runtime back, or
   * `continueCuts`, continues the runs the server's restart cut, on the runtimes that work.
   */
  async check({ continueCuts = false }: { continueCuts?: boolean } = {}): Promise<void> {
    const { back, changed } = await this.runtimes.check();
    if (changed) {
      this.#options.onChange({ agent: true });
    }
    if (back || continueCuts) {
      await this.#context.continuer.agentBack();
    }
  }

  /** The repository's main checkout, which keys its sessions. */
  async mainRoot(repo: string): Promise<string> {
    const known = this.#roots.get(repo);
    if (known !== undefined) {
      return known;
    }
    const root = await this.#options.binding.mainRoot(repo);
    this.#roots.set(repo, root);
    return root;
  }

  /** The folders of the repository whose session has a turn running, starting, or queued. */
  working(repo: string): Array<string> {
    return this.#busy(repo).flatMap((live) => (live.folder === null ? [] : [live.folder]));
  }

  /** Whether a chat, a session without a feature, has a turn running, starting, or queued. */
  chatWorking(repo: string): boolean {
    return this.#busy(repo).some((live) => live.folder === null);
  }

  /** Whether any session of the repository, a chat's too, has a turn running, starting, or queued. */
  busy(repo: string): boolean {
    return this.#busy(repo).length > 0;
  }

  #busy(repo: string) {
    return this.#context.live.working(this.#roots.get(repo) ?? repo);
  }

  /** What the turn does now, while it runs on this server's process. */
  activity(turn: number): TurnActivity | undefined {
    const live = [...this.#context.live.values()].find((one) => one.turn?.id === turn);
    return live?.turn && { ...live.turn.activity };
  }

  /** How many background commands of the session's run still run, on this server's process. */
  backgroundCommands(session: string): number {
    return commandCount(this.#context.live.get(session)?.proc?.background);
  }

  /** Whether the session's process, on this server, waits for a wakeup the agent set. */
  wakeup(session: string): boolean {
    return wakeupPending(this.#context.live.get(session)?.proc);
  }

  /**
   * The latest session of a change or a feature, made with none on `pick`, else on its next step's:
   * `featureSession`.
   */
  async featureSession(repo: string, folder: string, pick?: SessionPick): Promise<SessionRow> {
    const root = await this.mainRoot(repo);
    const made = this.#context.cache.latestSession(root, folder) === undefined;
    const starting = this.starts.runStep(root, folder);
    const picked = made ? await newPickOf(this.#context, root, folder, pick, starting) : pick;
    return featureSession(this.#context, root, folder, picked);
  }

  /**
   * A new session of a change or a feature, on `pick`, else on its next step's, which becomes its
   * latest: `newSession`.
   */
  async newSession(repo: string, folder: string, pick?: SessionPick): Promise<SessionRow> {
    const root = await this.mainRoot(repo);
    const starting = this.starts.runStep(root, folder);
    const picked = await newPickOf(this.#context, root, folder, pick, starting);
    return newSession(this.#context, this.#options.onChange, root, { folder, pick: picked });
  }

  /** What a session of `folder` in `root`, made without a pick for `runStep`, runs on. */
  stepPick(root: string, folder: string, runStep: string | null | undefined) {
    return stepPickOf(this.#context, root, folder, runStep);
  }

  /** Moves a session without a workflow to the change it became, between turns: `attach`. */
  async attach(repo: string, session: string, folder: string): Promise<void> {
    await attach(this.#context, await this.#own(repo, session), folder);
  }

  /** Whether the session's agent works: a turn of it runs, starts, or waits, on this server. */
  sessionWorking(session: string): boolean {
    const live = this.#context.live.get(session);
    return live !== undefined && working(live);
  }

  /**
   * Holds the change or the feature, or the session without one, for a move or a drop: refused
   * while one of its sessions works, or another move holds it. Until `release`, its sessions take
   * no message.
   */
  async hold(repo: string, target: { folder: string } | { session: string }): Promise<() => void> {
    const root = await this.mainRoot(repo);
    const busy =
      "folder" in target
        ? this.working(repo).includes(target.folder)
        : this.sessionWorking(target.session);
    const release = busy
      ? undefined
      : this.#context.live.hold("folder" in target ? { ...target, repo: root } : target);
    if (!release) {
      throw refused(REFUSALS.agentWorking);
    }
    return release;
  }

  /** Archives every session of a dropped change or feature, and closes their processes. */
  async archiveFolder(repo: string, folder: string): Promise<void> {
    archiveFolder(this.#context, this.#options.onChange, await this.mainRoot(repo), folder);
  }

  /** A new chat, without a feature, on `pick`, titled by its first message. */
  async newChat(repo: string, pick?: SessionPick): Promise<SessionRow> {
    return newChat(this.#context, await this.mainRoot(repo), pick);
  }

  /**
   * Sends a message to the session, and returns the session it went to and its turn. Idle, it
   * starts a turn, opening the process when it is closed. During a turn, the human's message is
   * steered into it, and the workflow's is queued after it. A workflow message that no longer
   * applies, as `sentAsChat` decides, runs as a chat, with the line saying so. A message may be
   * images alone, at most 10, to an agent that declares images; the workflow's message takes none.
   * A workflow run goes to the session its step's options give, maybe a new session of the change
   * or the feature, which it returns; another session of it working refuses a message.
   */
  async send(
    repo: string,
    session: string,
    input: SendInput,
  ): Promise<{ session: string; turn: number }> {
    const row = await this.#own(repo, session);
    // A workflow message takes no images, and its run's session, maybe another, checks its agent.
    const capabilities =
      input.workflow === undefined
        ? sessionRuntime(this.runtimes, readySession(this.runtimes, row)).capabilities
        : { images: false };
    const message = checkSend(input, capabilities);
    const live = this.#context.live.of(row);
    return this.#context.live.serial(live, () =>
      this.#asHuman(live, () => sendTo(this.#context, live, message)),
    );
  }

  /**
   * Takes back a message the agent has not read: the agent's own take-back for a message written
   * to it, which ends with its `cancelled` event, or at once for a queued turn's.
   */
  takeBack(repo: string, session: string, message: string): void {
    const live = this.#context.live.of(this.#ownNow(repo, session));
    try {
      takeBack(this.#context, live, message);
    } finally {
      this.#context.live.prune(live);
    }
  }

  /**
   * Stops the running turn, which keeps the session, and the turns queued after it, or the run's
   * wait to continue, or its agent's own wakeup, for good: `stopRun`. Its sub-sessions stop too.
   */
  stop(repo: string, session: string): void {
    stopRun(this.#context, this.#context.live.of(this.#ownNow(repo, session)));
    this.subSessions.stopAll(session);
  }

  /**
   * Allows the blocked action of item `seq` of `turn`: reopens the session's process with its rule,
   * for that process only, and asks the agent to try again, in a turn of its own.
   */
  async allow(repo: string, session: string, turn: number, seq: number): Promise<{ turn: number }> {
    const live = this.#context.live.of(readySession(this.runtimes, await this.#own(repo, session)));
    return this.#context.live.serial(live, () =>
      this.#asHuman(live, () => allowDenial(this.#context, live, turn, seq)),
    );
  }

  /**
   * Allows every covered blocked action of the session's latest turn at once: one reopen of its
   * process with every rule, and one turn asking the agent to try them again. Refused while a turn
   * runs or waits, and with no covered action.
   */
  async allowAll(repo: string, session: string): Promise<{ turn: number }> {
    const live = this.#context.live.of(readySession(this.runtimes, await this.#own(repo, session)));
    return this.#context.live.serial(live, () =>
      this.#asHuman(live, () => allowAll(this.#context, live)),
    );
  }

  /** Renames a session, by the title's first line that is not blank, cut at 80 characters. */
  rename(repo: string, session: string, title: string): void {
    rename(this.#context, this.#options.onChange, this.#ownNow(repo, session), title);
  }

  /** Archives a chat, or brings it back. */
  archive(repo: string, session: string, archived: boolean): void {
    archive(this.#context, this.#options.onChange, this.#ownNow(repo, session), archived);
  }

  /** Dismisses a failed or stopped turn of the repository's: `dismiss`. */
  dismiss(repo: string, turn: number): void {
    const row = this.cache.turn(turn);
    if (!row) {
      throw new Error(`no turn ${turn}`);
    }
    dismiss(this.#context, this.#options.onChange, this.#ownNow(repo, row.sessionId), row);
  }

  /** Changes the effort the session runs on, from its next turn: `setEffort`. */
  setEffort(repo: string, session: string, effort: string | null): void {
    setEffort(this.#context, this.#options.onChange, this.#ownNow(repo, session), effort);
  }

  /** Records that the human saw the session. */
  seen(repo: string, session: string): void {
    seen(this.#context, this.#options.onChange, this.#ownNow(repo, session));
  }

  /**
   * How many of the session's messages this server keeps: those of its turns not ended, or unread.
   */
  tracked(session: string): number {
    return this.#context.live.get(session)?.messages.size ?? 0;
  }

  /** Whether a move or a drop holds the folder of `root`'s main checkout: it takes no message. */
  moving(root: string, folder: string): boolean {
    return this.#context.live.holds({ folder, repo: root });
  }

  /** Whether this server keeps the session in memory: while it has a process, a turn, or a call. */
  held(session: string): boolean {
    return this.#context.live.has(session);
  }

  /** Resolves once the turn has ended, at once when this server does not run it. */
  async settled(turn: number): Promise<void> {
    await this.#context.turns.settled(turn);
  }

  /** Stops every turn and closes every process, as the server stops, and waits for them. */
  async closeAll(): Promise<void> {
    const { continuer, processes, turns } = this.#context;
    const procs: Array<Promise<void>> = [];
    // A continue whose time comes while the processes close is the next start's.
    continuer.close();
    this.starts.dropAll();
    for (const live of this.#context.live.values()) {
      for (const queued of live.queue.splice(0)) {
        turns.end(live, queued.id, { reason: SERVER_STOPPED, state: "stopped" });
      }
      if (live.turn) {
        turns.halt(live, live.turn, { reason: SERVER_STOPPED, state: "stopped" });
      }
      if (live.proc) {
        processes.close(live.proc);
        procs.push(live.proc.done);
      }
    }
    await Promise.all(procs);
  }

  /**
   * Arms every pending continue, as the server starts, after `check`: an overdue one goes at once.
   */
  async startContinues(): Promise<void> {
    await this.#context.continuer.start();
  }

  /** Drops the pending continues of each kind the settings turned off: their runs ask. */
  runsChanged(): void {
    this.#context.continuer.runsChanged();
  }

  /** Clears every timer, and stops following the runtimes. */
  close(): void {
    this.#unsubscribe();
    this.#accountRefresh.close();
    this.#context.continuer.close();
    for (const live of this.#context.live.values()) {
      clearTimeout(live.idle);
      live.proc?.terminate.forEach(clearTimeout);
      this.#context.turns.clearTimers(live);
    }
  }

  /**
   * The human's message or Allow takes the place of the run's continue, and sets the count back:
   * a refused one gives both back. The cancelled turns' change is published either way.
   */
  async #asHuman<T>(live: Live, body: () => Promise<T>): Promise<T> {
    const { changed, continuer } = this.#context;
    const taken = continuer.takeOver(live.id);
    try {
      return await body();
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("refused: ")) {
        taken.restore();
      }
      throw error;
    } finally {
      for (const turn of taken.turns) {
        changed(live, turn);
      }
    }
  }

  /** The session, when it is one of the repository's: the cache holds every repository's. */
  async #own(repo: string, session: string): Promise<SessionRow> {
    const row = this.cache.session(session);
    if (!row || row.repo !== (await this.mainRoot(repo))) {
      throw new Error(`no session ${session}`);
    }
    return row;
  }

  /** `#own`, for the calls that answer at once: the main checkout as `mainRoot` last read it. */
  #ownNow(repo: string, session: string): SessionRow {
    const row = this.cache.session(session);
    if (!row || row.repo !== (this.#roots.get(repo) ?? repo)) {
      throw new Error(`no session ${session}`);
    }
    return row;
  }
}
