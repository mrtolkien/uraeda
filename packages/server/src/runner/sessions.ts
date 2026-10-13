import { randomUUID } from "node:crypto";
import type { Binding } from "../fate/context.ts";
import type { Adapter, Outgoing } from "./adapter.ts";
import type { SessionCache, SessionRow } from "./cache.ts";
import type { Trigger, TurnKind } from "./events.ts";
import { LiveSessions } from "./live-sessions.ts";
import { chatOpening, chatTitle, retryMessage } from "./message.ts";
import { Processes } from "./processes.ts";
import {
  type Live,
  type Message,
  REFUSALS,
  refused,
  rowOf,
  type SessionChange,
  type SessionContext,
} from "./session-state.ts";
import { Transcript } from "./transcript.ts";
import { Turns } from "./turns.ts";

export {
  IDLE_CLOSE_MS,
  OUTPUT_LIMIT,
  REFUSALS,
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
    cache: SessionCache;
    binding: Binding;
    onChange: (change: SessionChange) => void;
  };
  #status: { available: boolean; version: string | null } = { available: false, version: null };
  /** Each repository's main checkout, by the path it was given as. */
  #roots = new Map<string, string>();
  #context: SessionContext;

  constructor(options: {
    adapter: Adapter;
    cache: SessionCache;
    binding: Binding;
    onChange: (change: SessionChange) => void;
  }) {
    this.#options = options;
    // Each part reaches the others through the context, filled once they are all made.
    const context = {
      adapter: options.adapter,
      cache: options.cache,
      binding: options.binding,
      changed: (live, turn, state) =>
        options.onChange({
          repo: live.repo,
          session: live.id,
          folder: live.folder,
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
  status(): { available: boolean; version: string | null } {
    return { ...this.#status };
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
    const root = this.#roots.get(repo) ?? repo;
    return [...this.#context.live.values()]
      .filter((live) => live.repo === root && live.folder !== null)
      .filter((live) => live.turn !== undefined || live.queue.length > 0)
      .map((live) => live.folder as string);
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
        repo: root,
        folder,
        agent: this.adapter.kind,
        nativeId: randomUUID(),
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
      repo: await this.mainRoot(repo),
      folder: null,
      agent: this.adapter.kind,
      nativeId: randomUUID(),
      title: null,
    });
  }

  /**
   * Sends a message to the session, and returns its turn. Idle, it starts a turn, opening the
   * process when it is closed. During a turn, the human's message is steered into it, and the
   * workflow's is queued after it. A workflow message is refused unless the feature waits on the
   * agent.
   */
  async send(
    repo: string,
    session: string,
    input: { text: string; workflow?: { trigger: Trigger; file?: string } },
  ): Promise<{ turn: number }> {
    if (input.text.trim() === "") {
      throw refused(REFUSALS.blank);
    }
    this.#available();
    const live = this.#context.live.of(await this.#own(repo, session));
    return this.#context.live.serial(live, () => this.#send(live, input));
  }

  async #send(
    live: Live,
    { text, workflow }: { text: string; workflow?: { trigger: Trigger; file?: string } },
  ): Promise<{ turn: number }> {
    const { cache, adapter, binding, turns, processes, changed } = this.#context;
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
      cache.updateSession(row.id, { title: chatTitle(text) });
    }
    if (row.archivedAt !== null) {
      cache.updateSession(row.id, { archivedAt: null });
    }
    const id = randomUUID();
    const origin = workflow ? "workflow" : "human";

    // During a turn, a human message joins it, when the agent can steer and the turn is not ending.
    if (live.turn && !live.turn.stop && !workflow && adapter.capabilities.steer) {
      const item: Message = { kind: "message", id, text, origin, state: "pending" };
      const seq = cache.appendItem(live.turn.id, item);
      live.messages.set(id, { turn: live.turn.id, seq, item, written: true });
      changed(live, live.turn.id);
      live.proc?.agent.send({ id, text, when: "steer" });
      return { turn: live.turn.id };
    }

    const kind: TurnKind = workflow ? "workflow" : "chat";
    const opening =
      kind === "chat" && live.folder !== null && branch !== undefined && this.#opens(live)
        ? chatOpening({
            folder: live.folder,
            branch,
            bug: (await binding.readFeature(live.repo, live.folder)).kind === "bug",
          })
        : undefined;
    const item: Message = {
      kind: "message",
      id,
      text,
      origin,
      ...(opening === undefined ? {} : { opening }),
      state: "pending",
    };
    const message: Outgoing = {
      id,
      text: opening === undefined ? text : `${opening}\n${text}`,
      when: "queue",
    };
    const turn = {
      kind,
      trigger: workflow?.trigger ?? null,
      step,
      allowed: null,
    };

    // A busy session queues the turn: Uraeda writes its message once the running turn ends.
    if (live.turn || live.queue.length > 0) {
      const queued = cache.addTurn({ sessionId: live.id, ...turn, state: "queued" });
      turns.track(queued);
      const seq = cache.appendItem(queued, item);
      live.messages.set(id, { turn: queued, seq, item, written: false });
      live.queue.push({ id: queued, message });
      changed(live, queued, "queued");
      return { turn: queued };
    }

    const { replaced } = await processes.open(live);
    return { turn: turns.begin(live, { ...turn, item, message, replaced }) };
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
      turns.end(live, sent.turn, { state: "stopped", reason: "Taken back." });
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
      const { cache, processes, turns, changed } = this.#context;
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
      const { replaced } = await processes.open(live, rule);
      const id = randomUUID();
      const text = retryMessage(denial);
      const started = turns.begin(live, {
        kind: "allow",
        trigger: null,
        step: null,
        allowed: rule,
        item: { kind: "message", id, text, origin: "human", state: "pending" },
        message: { id, text, when: "queue" },
        replaced,
      });
      cache.updateItem(turn, seq, {
        kind: "denial",
        tool: denial.tool,
        ...(denial.target === undefined ? {} : { target: denial.target }),
        rule,
        allowed: true,
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
    this.#options.onChange({ repo: row.repo, session: row.id, folder: row.folder });
  }

  /** Archives a chat, or brings it back. */
  archive(repo: string, session: string, archived: boolean): void {
    const row = this.#ownNow(repo, session);
    if (row.folder !== null) {
      throw new Error("a feature's session is not archived");
    }
    this.cache.updateSession(row.id, { archivedAt: archived ? now() : null });
    this.#options.onChange({ repo: row.repo, session: row.id, folder: row.folder });
  }

  /** Records that the human saw the session. */
  seen(repo: string, session: string): void {
    const row = this.#ownNow(repo, session);
    this.cache.updateSession(row.id, { seenAt: now() });
    this.#options.onChange({ repo: row.repo, session: row.id, folder: row.folder });
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
    const { turns, processes } = this.#context;
    const procs: Array<Promise<void>> = [];
    for (const live of this.#context.live.values()) {
      for (const queued of live.queue.splice(0)) {
        turns.end(live, queued.id, { state: "stopped", reason: SERVER_STOPPED });
      }
      if (live.turn) {
        turns.halt(live, live.turn, { state: "stopped", reason: SERVER_STOPPED });
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
