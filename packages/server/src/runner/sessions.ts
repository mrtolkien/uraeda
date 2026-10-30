import { randomUUID } from "node:crypto";
import type { Binding } from "../fate/context.ts";
import { allowAll, allowDenial } from "./allow.ts";
import type { Adapter } from "./adapter.ts";
import type { SessionCache, SessionRow } from "./cache.ts";
import type { TurnActivity, UsageLimit } from "./events.ts";
import { LiveSessions } from "./live-sessions.ts";
import { chatTitle } from "./message.ts";
import { transaction } from "./migrations.ts";
import { Processes } from "./processes.ts";
import { checkSend, type SendInput } from "./send-input.ts";
import { sendTo } from "./send.ts";
import { StartMessages } from "./start-messages.ts";
import {
  type Live,
  REFUSALS,
  commandCount,
  ofDropped,
  refused,
  type SessionChange,
  type SessionContext,
} from "./session-state.ts";
import { Transcript } from "./transcript.ts";
import { Turns } from "./turns.ts";

export { type SendInput, type SentImage } from "./send-input.ts";
export {
  IDLE_CLOSE_MS,
  MAX_IMAGES,
  OUTPUT_LIMIT,
  REFUSALS,
  RESUMED,
  type SessionChange,
  TERMINATE_AFTER_MS,
  WATCHDOG_MS,
} from "./session-state.ts";

/** Why a turn stopped as the server stopped. */
const SERVER_STOPPED = "Stopped: the server stopped while it ran.";

const now = () => new Date().toISOString();

/** Whether a turn of the session runs, starts, or waits. */
const working = (live: Live) =>
  live.turn !== undefined || live.starting === true || live.queue.length > 0;

/**
 * Sessions of turns with agents: at most one process and one turn per session, and one working
 * session per change or feature, whose sessions work in its worktree; a chat in the main checkout.
 * Turns and their items go to the cache, and every change to `onChange`.
 *
 * It answers the server's calls, and leaves the rest to its parts: the sessions kept in memory,
 * their processes, their turns, and the transcript their events are recorded in.
 */
export class Sessions {
  #options: {
    adapter: Adapter;
    binding: Binding;
    cache: SessionCache;
    onChange: (change: SessionChange) => void;
  };
  #status: { available: boolean; version: string | null } = { available: false, version: null };
  /** Each repository's main checkout, by the path it was given as. */
  #roots = new Map<string, string>();
  #context: SessionContext;
  /** The messages sent to features whose start is still in the write queue. */
  readonly starts: StartMessages;

  constructor(options: {
    adapter: Adapter;
    binding: Binding;
    cache: SessionCache;
    onChange: (change: SessionChange) => void;
  }) {
    this.#options = options;
    this.starts = new StartMessages(options.cache);
    // Each part reaches the others through the context, filled once they are all made.
    const context = {
      adapter: options.adapter,
      agentChanged: () => options.onChange({ agent: true }),
      binding: options.binding,
      cache: options.cache,
      changed: (live, turn, state) =>
        options.onChange({
          folder: live.folder,
          repo: live.repo,
          session: live.id,
          ...(turn === undefined ? {} : { turn }),
          ...(state === undefined ? {} : { state }),
        }),
      live: new LiveSessions(),
    } as SessionContext;
    context.processes = new Processes(context);
    context.turns = new Turns(context);
    context.transcript = new Transcript(context);
    this.#context = context;
  }

  /** The cache the sessions are written to, which the server reads them from. */
  get cache(): SessionCache {
    return this.#options.cache;
  }

  get adapter(): Adapter {
    return this.#options.adapter;
  }

  /** Whether the agent worked at the last check, and its version. */
  status(): {
    available: boolean;
    fiveHourLimit: UsageLimit | null;
    version: string | null;
    weekLimit: UsageLimit | null;
  } {
    const { processes } = this.#context;
    return {
      ...this.#status,
      fiveHourLimit: processes.limit("fiveHour"),
      weekLimit: processes.limit("week"),
    };
  }

  /** Asks the agent for its version, and reports a change of availability. */
  async check(): Promise<void> {
    const version = (await this.adapter.version()) ?? null;
    const status = { available: version !== null, version };
    if (status.available === this.#status.available && status.version === this.#status.version) {
      return;
    }
    this.#status = status;
    this.#options.onChange({ agent: true });
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
    return this.#busy(repo)
      .filter((live) => live.folder !== null)
      .map((live) => live.folder as string);
  }

  /**
   * Whether any session of the repository, a feature's or a chat, has a turn running, starting, or
   * queued.
   */
  busy(repo: string): boolean {
    return this.#busy(repo).length > 0;
  }

  #busy(repo: string) {
    const root = this.#roots.get(repo) ?? repo;
    return [...this.#context.live.values()].filter((live) => live.repo === root && working(live));
  }

  /** What the turn does now, while it runs on this server's process. */
  activity(turn: number): TurnActivity | undefined {
    for (const live of this.#context.live.values()) {
      if (live.turn?.id === turn) {
        return { ...live.turn.activity };
      }
    }
    return undefined;
  }

  /** How many background commands of the session's run still run, on this server's process. */
  backgroundCommands(session: string): number {
    return commandCount(this.#context.live.get(session)?.proc?.background);
  }

  /**
   * The latest session of a change or a feature, created when it has none: refused for a dropped
   * one, whose sessions are all archived, so its runs never recreate its worktree.
   */
  async featureSession(repo: string, folder: string): Promise<SessionRow> {
    const { cache } = this;
    const root = await this.mainRoot(repo);
    // One transaction: another server cannot create a first session between the read and the write.
    return transaction(cache.db, () => {
      const latest = cache.latestSession(root, folder);
      if (latest && ofDropped(latest)) {
        throw refused(REFUSALS.dropped);
      }
      return (
        latest ??
        cache.createSession({
          agent: this.adapter.kind,
          folder,
          nativeId: randomUUID(),
          repo: root,
          title: null,
        })
      );
    });
  }

  /**
   * A new session of a change or a feature, which becomes its latest: its runs go to it. Its
   * feature's open pages are sent it. Refused for a dropped one.
   */
  async newSession(repo: string, folder: string): Promise<SessionRow> {
    const root = await this.mainRoot(repo);
    const latest = this.cache.latestSession(root, folder);
    if (latest && ofDropped(latest)) {
      throw refused(REFUSALS.dropped);
    }
    const row = this.cache.createSession({
      agent: this.adapter.kind,
      folder,
      nativeId: randomUUID(),
      repo: root,
      title: null,
    });
    this.#options.onChange({ folder, repo: root, session: row.id });
    return row;
  }

  /**
   * Moves a session without a workflow to the change it became, between turns: refused while its
   * agent works. Its open process closes, so its next turn opens in the change's worktree, and
   * resumes its agent session there.
   */
  async attach(repo: string, session: string, folder: string): Promise<void> {
    const { live: sessions, processes } = this.#context;
    const live = sessions.of(await this.#own(repo, session));
    await sessions.serial(live, async () => {
      if (live.turn !== undefined || live.queue.length > 0) {
        throw refused(REFUSALS.agentWorking);
      }
      this.cache.attach(live.id, folder);
      // Kept in memory with the folder it had: its next turn reads this one.
      live.folder = folder;
      if (live.proc) {
        processes.close(live.proc);
      }
      this.#context.changed(live);
    });
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
    const root = await this.mainRoot(repo);
    for (const row of this.cache.folderSessions(root, folder)) {
      const proc = this.#context.live.get(row.id)?.proc;
      if (proc) {
        this.#context.processes.close(proc);
      }
      this.cache.updateSession(row.id, { archivedAt: now() });
      this.#options.onChange({ folder, repo: root, session: row.id });
    }
  }

  /** A new chat, without a feature, titled by its first message. */
  async newChat(repo: string): Promise<SessionRow> {
    return this.cache.createSession({
      agent: this.adapter.kind,
      folder: null,
      nativeId: randomUUID(),
      repo: await this.mainRoot(repo),
      title: null,
    });
  }

  /**
   * Sends a message to the session, and returns the session it went to and its turn. Idle, it
   * starts a turn, opening the process when it is closed. During a turn, the human's message is
   * steered into it, and the workflow's is queued after it. A workflow message that no longer
   * applies, as `sentAsChat` decides, runs as a chat, with the line saying so. A message may be
   * images alone, at most 10, to an agent that declares images; the workflow's message takes none.
   * A run that starts fresh goes to a new session of the change or the feature, which it returns;
   * another session of it working refuses a message.
   */
  async send(
    repo: string,
    session: string,
    input: SendInput,
  ): Promise<{ session: string; turn: number }> {
    const message = checkSend(input, this.adapter.capabilities);
    this.#available();
    const live = this.#context.live.of(await this.#own(repo, session));
    return this.#context.live.serial(live, () =>
      sendTo(this.#context, live, message, () => this.#available()),
    );
  }

  /**
   * Takes back a message the agent has not read: the agent's own take-back for a message written
   * to it, which ends with its `cancelled` event, or at once for a queued turn's.
   */
  takeBack(repo: string, session: string, message: string): void {
    const live = this.#context.live.of(this.#ownNow(repo, session));
    try {
      this.#takeBack(live, message);
    } finally {
      this.#context.live.prune(live);
    }
  }

  #takeBack(live: Live, message: string) {
    const { turns } = this.#context;
    const sent = live.messages.get(message);
    // A message no longer kept belongs to a turn that ended with nothing left to read.
    if (!sent) {
      throw refused(REFUSALS.read);
    }
    if (sent.item.state === "taken-back") {
      return;
    }
    if (sent.item.state === "read" || live.turn?.first === message) {
      throw refused(REFUSALS.read);
    }
    const queued = live.queue.findIndex((turn) => turn.message.id === message);
    if (queued >= 0) {
      live.queue.splice(queued, 1);
      turns.mark(live, sent, "taken-back");
      turns.end(live, sent.turn, { reason: "Taken back.", state: "stopped" });
      return;
    }
    if (!this.adapter.capabilities.takeBack) {
      throw new Error(`${this.adapter.name} cannot take a message back`);
    }
    live.proc?.agent.takeBack(message);
  }

  /** Stops the running turn, which keeps the session, and the turns queued after it. */
  stop(repo: string, session: string): void {
    const { turns } = this.#context;
    const live = this.#context.live.of(this.#ownNow(repo, session));
    for (const queued of live.queue.splice(0)) {
      turns.end(live, queued.id, { state: "stopped" });
    }
    if (live.turn) {
      turns.halt(live, live.turn, { state: "stopped" });
    }
    this.#context.live.prune(live);
  }

  /**
   * Allows the blocked action of item `seq` of `turn`: reopens the session's process with its rule,
   * for that process only, and asks the agent to try again, in a turn of its own.
   */
  async allow(repo: string, session: string, turn: number, seq: number): Promise<{ turn: number }> {
    this.#available();
    const live = this.#context.live.of(await this.#own(repo, session));
    return this.#context.live.serial(live, () => allowDenial(this.#context, live, turn, seq));
  }

  /**
   * Allows every covered blocked action of the session's latest turn at once: one reopen of its
   * process with every rule, and one turn asking the agent to try them again. Refused while a turn
   * runs or waits, and with no covered action.
   */
  async allowAll(repo: string, session: string): Promise<{ turn: number }> {
    this.#available();
    const live = this.#context.live.of(await this.#own(repo, session));
    return this.#context.live.serial(live, () => allowAll(this.#context, live));
  }

  /** Renames a session, by the title's first line that is not blank, cut at 80 characters. */
  rename(repo: string, session: string, title: string): void {
    const row = this.#ownNow(repo, session);
    if (title.trim() === "") {
      throw refused(REFUSALS.blank);
    }
    this.cache.updateSession(row.id, { title: chatTitle(title) });
    this.#options.onChange({ folder: row.folder, repo: row.repo, session: row.id });
  }

  /** Archives a chat, or brings it back. */
  archive(repo: string, session: string, archived: boolean): void {
    const row = this.#ownNow(repo, session);
    if (row.folder !== null) {
      throw new Error("a feature's session is not archived");
    }
    this.cache.updateSession(row.id, { archivedAt: archived ? now() : null });
    this.#options.onChange({ folder: row.folder, repo: row.repo, session: row.id });
  }

  /** Records that the human saw the session. */
  seen(repo: string, session: string): void {
    const row = this.#ownNow(repo, session);
    this.cache.updateSession(row.id, { seenAt: now() });
    this.#options.onChange({ folder: row.folder, repo: row.repo, session: row.id });
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
    const { processes, turns } = this.#context;
    const procs: Array<Promise<void>> = [];
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

  /** Clears every timer. */
  close(): void {
    for (const live of this.#context.live.values()) {
      clearTimeout(live.idle);
      live.proc?.terminate.forEach(clearTimeout);
      this.#context.turns.clearTimers(live);
    }
  }

  // Sessions and their owners.

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

  #available() {
    if (!this.#status.available) {
      throw refused(REFUSALS.unavailable(this.adapter.name));
    }
  }
}
