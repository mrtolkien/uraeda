import { randomUUID } from "node:crypto";
import type { Binding } from "../fate/context.ts";
import type { Adapter, Outgoing } from "./adapter.ts";
import type { SessionCache, SessionRow } from "./cache.ts";
import type { TurnActivity, TurnKind, UsageLimit } from "./events.ts";
import { LiveSessions } from "./live-sessions.ts";
import { chatOpening, chatTitle, retryMessage } from "./message.ts";
import { Processes } from "./processes.ts";
import { checkSend, messageItem, type SendInput } from "./send-input.ts";
import {
  type Live,
  type Message,
  REFUSALS,
  commandCount,
  refused,
  rowOf,
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

/**
 * Sessions of turns with agents: at most one process and one turn per session, a feature's session
 * in its worktree, a chat in the main checkout. Turns and their items go to the cache, and every
 * change to `onChange`.
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

  constructor(options: {
    adapter: Adapter;
    binding: Binding;
    cache: SessionCache;
    onChange: (change: SessionChange) => void;
  }) {
    this.#options = options;
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
  status(): { available: boolean; fiveHourLimit: UsageLimit | null; version: string | null } {
    return { ...this.#status, fiveHourLimit: this.#context.processes.fiveHourLimit() };
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

  /** The folders of the repository whose session has a turn running, or queued. */
  working(repo: string): Array<string> {
    return this.#busy(repo)
      .filter((live) => live.folder !== null)
      .map((live) => live.folder as string);
  }

  /** Whether any session of the repository, a feature's or a chat, has a turn running or queued. */
  busy(repo: string): boolean {
    return this.#busy(repo).length > 0;
  }

  #busy(repo: string) {
    const root = this.#roots.get(repo) ?? repo;
    return [...this.#context.live.values()].filter(
      (live) => live.repo === root && (live.turn !== undefined || live.queue.length > 0),
    );
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

  /** The feature's one session, created when it has none. */
  async featureSession(repo: string, folder: string): Promise<SessionRow> {
    const { cache } = this;
    const root = await this.mainRoot(repo);
    const existing = cache.featureSession(root, folder);
    if (existing) {
      return existing;
    }
    try {
      return cache.createSession({
        agent: this.adapter.kind,
        folder,
        nativeId: randomUUID(),
        repo: root,
        title: null,
      });
    } catch (error) {
      // Another request, or another server, created it first.
      const created = cache.featureSession(root, folder);
      if (created) {
        return created;
      }
      throw error;
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
   * Sends a message to the session, and returns its turn. Idle, it starts a turn, opening the
   * process when it is closed. During a turn, the human's message is steered into it, and the
   * workflow's is queued after it. A workflow message is refused unless the feature waits on the
   * agent. A message may be images alone, at most 10, to an agent that declares images; the
   * workflow's message takes none.
   */
  async send(repo: string, session: string, input: SendInput): Promise<{ turn: number }> {
    const message = checkSend(input, this.adapter.capabilities);
    this.#available();
    const live = this.#context.live.of(await this.#own(repo, session));
    return this.#context.live.serial(live, () => this.#send(live, message));
  }

  async #send(
    live: Live,
    { held, paths, text, workflow }: ReturnType<typeof checkSend>,
  ): Promise<{ turn: number }> {
    const { adapter, binding, cache, changed, processes, turns } = this.#context;
    let step: string | null = null;
    let branch: string | undefined;
    if (live.folder !== null) {
      const next = await binding.nextStep(live.repo, live.folder);
      if (next.branch === undefined) {
        throw refused(REFUSALS.noBranch);
      }
      branch = next.branch;
      if (workflow) {
        if (next.step.waitsOn !== "agent") {
          throw refused(REFUSALS.human);
        }
        step = next.step.name;
      }
    } else if (workflow) {
      throw new Error("a chat has no workflow to continue");
    }
    this.#available();
    const row = rowOf(cache, live);
    if (row.folder === null && row.title === null) {
      cache.updateSession(row.id, { title: chatTitle(text, paths.length > 0) });
    }
    if (row.archivedAt !== null) {
      cache.updateSession(row.id, { archivedAt: null });
    }
    const id = randomUUID();
    const origin = workflow ? "workflow" : "human";
    // During a turn, a human message joins it, when the agent can steer and the turn is not ending.
    if (live.turn && !live.turn.stop && !workflow && adapter.capabilities.steer) {
      const item: Message = { ...messageItem(id, origin, text), ...held };
      const seq = cache.appendItem(live.turn.id, item);
      live.messages.set(id, { item, seq, turn: live.turn.id, written: true });
      changed(live, live.turn.id);
      live.proc?.agent.send({ id, images: paths, text, when: "steer" });
      return { turn: live.turn.id };
    }

    const kind: TurnKind = workflow ? "workflow" : "chat";
    const fresh = workflow?.fresh === true;
    const opening =
      kind === "chat" && live.folder !== null && branch !== undefined && this.#opens(live)
        ? chatOpening({ branch, feature: await binding.readFeature(live.repo, live.folder) })
        : undefined;
    const item: Message = {
      ...messageItem(id, origin, text),
      ...(opening === undefined ? {} : { opening }),
      ...held,
    };
    const message: Outgoing = {
      id,
      images: paths,
      text: opening === undefined ? text : text === "" ? opening : `${opening}\n${text}`,
      when: "queue",
    };
    const turn = {
      allowed: null,
      kind,
      step,
      trigger: workflow?.trigger ?? null,
    };

    // A busy session queues the turn: Uraeda writes its message once the running turn ends.
    if (live.turn || live.queue.length > 0) {
      const queued = cache.addTurn({ sessionId: live.id, ...turn, state: "queued" });
      turns.track(queued);
      const seq = cache.appendItem(queued, item);
      live.messages.set(id, { item, seq, turn: queued, written: false });
      live.queue.push({ ...(fresh ? { fresh } : {}), id: queued, message });
      changed(live, queued, "queued");
      return { turn: queued };
    }

    const { line } = await processes.open(live, { fresh });
    return { turn: turns.begin(live, { ...turn, item, line, message }) };
  }

  /** Whether a chat message starts with the opening line: first, or after a workflow run. */
  #opens(live: Live): boolean {
    const last = this.cache
      .turns(live.id)
      .filter((turn) => turn.kind !== "allow")
      .at(-1);
    return last === undefined || last.kind === "workflow";
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
    return this.#context.live.serial(live, async () => {
      const { cache, changed, processes, turns } = this.#context;
      const denial = cache.itemsOf(turn, "denial").find((item) => item.seq === seq);
      if (cache.turn(turn)?.sessionId !== live.id || !denial) {
        throw new Error(`no blocked action ${seq} in turn ${turn}`);
      }
      const { rule } = denial;
      if (rule === undefined) {
        throw refused(REFUSALS.noRule);
      }
      if (live.turn || live.queue.length > 0) {
        throw refused(REFUSALS.working);
      }
      const { line } = await processes.open(live, { allowed: rule });
      const id = randomUUID();
      const text = retryMessage(denial);
      const started = turns.begin(live, {
        allowed: rule,
        item: { id, kind: "message", origin: "human", state: "pending", text },
        kind: "allow",
        message: { id, images: [], text, when: "queue" },
        ...(line === undefined ? {} : { line }),
        step: null,
        trigger: null,
      });
      cache.updateItem(turn, seq, {
        kind: "denial",
        tool: denial.tool,
        ...(denial.target === undefined ? {} : { target: denial.target }),
        allowed: true,
        rule,
      });
      changed(live, turn);
      return { turn: started };
    });
  }

  /** Renames a chat, by the title's first line that is not blank, cut at 80 characters. */
  rename(repo: string, session: string, title: string): void {
    const row = this.#ownNow(repo, session);
    if (row.folder !== null) {
      throw new Error("a feature's session takes its feature's name");
    }
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

  /** How many of the session's messages this server keeps: those of its turns not ended, or unread. */
  tracked(session: string): number {
    return this.#context.live.get(session)?.messages.size ?? 0;
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
