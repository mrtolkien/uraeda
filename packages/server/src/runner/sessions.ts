import { randomUUID } from "node:crypto";
import type { Binding } from "../fate/context.ts";
import type { Adapter, AgentProcess, Outgoing } from "./adapter.ts";
import type { SessionCache, SessionRow } from "./cache.ts";
import type { AgentEvent, Item, Trigger, TurnKind, TurnState } from "./events.ts";
import { chatOpening, chatTitle, retryMessage, toolTarget } from "./message.ts";

/** A session's process is closed after this long without a turn, and resumed by its next message. */
export const IDLE_CLOSE_MS = 15 * 60_000;
/** A turn without any output for this long is stopped, and fails. */
export const WATCHDOG_MS = 30 * 60_000;
/** SIGINT follows an unanswered interrupt after this long, and SIGTERM as long after SIGINT. */
export const TERMINATE_AFTER_MS = 10_000;
/** A tool's output is cut to this many characters. */
export const OUTPUT_LIMIT = 4_000;
/** A turn failed by its process's exit keeps this many lines of its stderr. */
const STDERR_LINES = 20;

export const REFUSALS = {
  /** A write on a feature, or a session another server holds, while its agent works. */
  working: "An agent is working on this feature. Stop it first, or wait for it.",
  /** A workflow message on a feature whose step waits on the human. */
  human: "The feature waits on you now: there is nothing to continue.",
  noBranch: "This feature has no branch yet: commit its proposal first.",
  /** A take-back of a message the agent read. */
  read: "The agent already read it.",
  blank: "The message is empty.",
  unavailable: (name: string) => `${name} is not available on this machine.`,
};

/** The line a turn shows when its session's transcript was gone, and a new one started. */
const REPLACED = "Started a new session: the previous one is gone.";
/** Why a turn stopped as the server stopped. */
const SERVER_STOPPED = "Stopped: the server stopped while it ran.";

/** What changed: the agent's availability, or a session, with the turn and its new state. */
export type SessionChange =
  | { agent: true }
  | { repo: string; session: string; folder: string | null; turn?: number; state?: TurnState };

type Timer = ReturnType<typeof setTimeout>;
type Exit = Extract<AgentEvent, { type: "exit" }>;
type Result = Extract<AgentEvent, { type: "result" }>;
type Message = Extract<Item, { kind: "message" }>;
type Tool = Extract<Item, { kind: "tool" }>;

/** A session's open process. */
type Proc = {
  agent: AgentProcess;
  cwd: string;
  /** Closed by the idle timer, a plugin error, or "Allow and retry": no message goes to it. */
  closing: boolean;
  /** Resolves once its events are read to its exit. */
  done: Promise<void>;
};

/** The turn running on a session's process. */
type Running = {
  id: number;
  /** How the turn ends once it was halted: by Stop, the watchdog, its plugin, or the server. */
  stop?: { state: TurnState; reason?: string };
  /** The ID of the message that started it. */
  first: string;
  tools: Map<string, { seq: number; item: Tool; at: number }>;
  /** The text block being streamed. */
  text?: { seq: number; text: string };
  skipped?: { seq: number; count: number };
  cost?: number;
  watchdog?: Timer;
  terminate: Array<Timer>;
};

/** A turn waiting for the running one to end: its message is written when it starts. */
type Queued = { id: number; message: Outgoing };

/** A message this server sent, or will send, and where its item is. */
type Sent = { turn: number; seq: number; item: Message; written: boolean };

/** What this server keeps of a session while it is used. */
type Live = {
  id: string;
  repo: string;
  folder: string | null;
  proc?: Proc;
  turn?: Running;
  queue: Array<Queued>;
  messages: Map<string, Sent>;
  idle?: Timer;
  /** Sends and turn starts, one after another. */
  lock: Promise<unknown>;
};

const refused = (text: string) => new Error(`refused: ${text}`);
const now = () => new Date().toISOString();

/**
 * Sessions of turns with agents: at most one process and one turn per session, a feature's session
 * in its worktree, a chat in the main checkout. Turns and their items go to the cache, and every
 * change to `onChange`.
 */
export class Sessions {
  #options: {
    adapter: Adapter;
    cache: SessionCache;
    binding: Binding;
    onChange: (change: SessionChange) => void;
  };
  #status: { available: boolean; version: string | null } = { available: false, version: null };
  #live = new Map<string, Live>();
  /** Each repository's main checkout, by the path it was given as. */
  #roots = new Map<string, string>();
  /** The turns not ended yet, which `settled` waits for. */
  #pending = new Map<number, { ended: Promise<void>; resolve: () => void }>();

  constructor(options: {
    adapter: Adapter;
    cache: SessionCache;
    binding: Binding;
    onChange: (change: SessionChange) => void;
  }) {
    this.#options = options;
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
    return [...this.#live.values()]
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
    const live = this.#liveOf(await this.#own(repo, session));
    return this.#serial(live, () => this.#send(live, input));
  }

  async #send(
    live: Live,
    { text, workflow }: { text: string; workflow?: { trigger: Trigger; file?: string } },
  ): Promise<{ turn: number }> {
    const { cache, adapter } = this;
    let step: string | null = null;
    let branch: string | undefined;
    if (live.folder !== null) {
      const next = await this.#options.binding.nextStep(live.repo, live.folder);
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
    const row = this.#row(live);
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
      this.#changed(live, live.turn.id);
      live.proc?.agent.send({ id, text, when: "steer" });
      return { turn: live.turn.id };
    }

    const kind: TurnKind = workflow ? "workflow" : "chat";
    const opening =
      kind === "chat" && live.folder !== null && branch !== undefined && this.#opens(live)
        ? chatOpening({
            folder: live.folder,
            branch,
            bug: (await this.#options.binding.readFeature(live.repo, live.folder)).kind === "bug",
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
      this.#track(queued);
      const seq = cache.appendItem(queued, item);
      live.messages.set(id, { turn: queued, seq, item, written: false });
      live.queue.push({ id: queued, message });
      this.#changed(live, queued, "queued");
      return { turn: queued };
    }

    const { replaced } = await this.#process(live);
    return { turn: this.#begin(live, { ...turn, item, message, replaced }) };
  }

  /** Whether a chat message starts with the opening line: first, or after a workflow run. */
  #opens(live: Live): boolean {
    const last = this.cache
      .turns(live.id)
      .filter((turn) => turn.kind !== "allow")
      .at(-1);
    return last === undefined || last.kind === "workflow";
  }

  /** Starts a turn on the open process, and writes its message. */
  #begin(
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
    const { cache } = this;
    const id = cache.addTurn({
      sessionId: live.id,
      kind: turn.kind,
      trigger: turn.trigger,
      step: turn.step,
      allowed: turn.allowed,
      state: "running",
    });
    this.#track(id);
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
    this.#watch(live, live.turn);
    this.#changed(live, id, "running");
    live.proc?.agent.send(message);
  }

  /**
   * The session's open process, opened when it has none, or when it is closing: then once it
   * exited. A transcript that is gone starts a new agent session. `allowed` reopens the process
   * with the rule.
   */
  async #process(live: Live, allowed?: string): Promise<{ proc: Proc; replaced: boolean }> {
    const { cache, adapter } = this;
    if (live.proc && !live.proc.closing && allowed === undefined) {
      return { proc: live.proc, replaced: false };
    }
    if (live.proc) {
      this.#close(live.proc);
      await live.proc.done;
    }
    // Another server may share the cache: one process per session, across servers.
    if (!cache.claimSession(live.id)) {
      throw refused(REFUSALS.working);
    }
    try {
      const cwd =
        live.folder === null
          ? live.repo
          : await this.#options.binding.workDir(live.repo, live.folder);
      const row = this.#row(live);
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
      const proc: Proc = { agent, cwd, closing: false, done: Promise.resolve() };
      live.proc = proc;
      proc.done = this.#consume(live, proc);
      return { proc, replaced };
    } catch (error) {
      cache.releaseSession(live.id);
      throw error;
    }
  }

  /** Closes the process once its turn is over: it exits, and is reopened by the next message. */
  #close(proc: Proc) {
    if (!proc.closing) {
      proc.closing = true;
      proc.agent.close();
    }
  }

  /**
   * Takes back a message the agent has not read: the agent's own take-back for a message written
   * to it, which ends with its `cancelled` event, or at once for a queued turn's.
   */
  takeBack(repo: string, session: string, message: string): void {
    const live = this.#liveOf(this.#ownNow(repo, session));
    const sent = live.messages.get(message);
    if (!sent) {
      throw new Error(`no message ${message} in session ${session}`);
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
      this.#mark(live, sent, "taken-back");
      this.#endTurn(live, sent.turn, { state: "stopped", reason: "Taken back." });
      return;
    }
    if (!this.adapter.capabilities.takeBack) {
      throw new Error(`${this.adapter.name} cannot take a message back`);
    }
    live.proc?.agent.takeBack(message);
  }

  /** Stops the running turn, which keeps the session, and the turns queued after it. */
  stop(repo: string, session: string): void {
    const live = this.#liveOf(this.#ownNow(repo, session));
    for (const queued of live.queue.splice(0)) {
      this.#endTurn(live, queued.id, { state: "stopped" });
    }
    if (live.turn) {
      this.#halt(live, live.turn, { state: "stopped" });
    }
  }

  /**
   * Allows the blocked action of item `seq` of `turn`: reopens the session's process with its rule,
   * for that process only, and asks the agent to try again, in a turn of its own.
   */
  async allow(repo: string, session: string, turn: number, seq: number): Promise<{ turn: number }> {
    this.#available();
    const live = this.#liveOf(await this.#own(repo, session));
    return this.#serial(live, async () => {
      const { cache } = this;
      const denial = cache.itemsOf(turn, "denial").find((item) => item.seq === seq);
      if (cache.turn(turn)?.sessionId !== live.id || !denial) {
        throw new Error(`no blocked action ${seq} in turn ${turn}`);
      }
      if (live.turn || live.queue.length > 0) {
        throw refused(REFUSALS.working);
      }
      const { replaced } = await this.#process(live, denial.rule);
      const id = randomUUID();
      const text = retryMessage(denial);
      const started = this.#begin(live, {
        kind: "allow",
        trigger: null,
        step: null,
        allowed: denial.rule,
        item: { kind: "message", id, text, origin: "human", state: "pending" },
        message: { id, text, when: "queue" },
        replaced,
      });
      cache.updateItem(turn, seq, {
        kind: "denial",
        tool: denial.tool,
        ...(denial.target === undefined ? {} : { target: denial.target }),
        rule: denial.rule,
        allowed: true,
      });
      this.#changed(live, turn);
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
    return this.#live.get(session)?.messages.size ?? 0;
  }

  /** Resolves once the turn has ended, at once when this server does not run it. */
  async settled(turn: number): Promise<void> {
    await this.#pending.get(turn)?.ended;
  }

  /** Stops every turn and closes every process, as the server stops, and waits for them. */
  async closeAll(): Promise<void> {
    const procs: Array<Promise<void>> = [];
    for (const live of this.#live.values()) {
      for (const queued of live.queue.splice(0)) {
        this.#endTurn(live, queued.id, { state: "stopped", reason: SERVER_STOPPED });
      }
      if (live.turn) {
        this.#halt(live, live.turn, { state: "stopped", reason: SERVER_STOPPED });
      }
      if (live.proc) {
        this.#close(live.proc);
        procs.push(live.proc.done);
      }
    }
    await Promise.all(procs);
  }

  /** Clears every timer. */
  close(): void {
    for (const live of this.#live.values()) {
      clearTimeout(live.idle);
      if (live.turn) {
        clearTimeout(live.turn.watchdog);
        live.turn.terminate.forEach(clearTimeout);
      }
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

  #liveOf(row: SessionRow): Live {
    let live = this.#live.get(row.id);
    if (!live) {
      live = {
        id: row.id,
        repo: row.repo,
        folder: row.folder,
        queue: [],
        messages: new Map(),
        lock: Promise.resolve(),
      };
      this.#live.set(row.id, live);
    }
    return live;
  }

  #row(live: Live): SessionRow {
    const row = this.cache.session(live.id);
    if (!row) {
      throw new Error(`no session ${live.id}`);
    }
    return row;
  }

  #available() {
    if (!this.#status.available) {
      throw refused(REFUSALS.unavailable(this.adapter.name));
    }
  }

  /** Runs `body` after the session's earlier sends and turn starts. */
  #serial<T>(live: Live, body: () => Promise<T>): Promise<T> {
    const run = live.lock.then(body, body);
    live.lock = run.catch(() => {});
    return run;
  }

  #track(turn: number) {
    let resolve = () => {};
    const ended = new Promise<void>((done) => (resolve = done));
    this.#pending.set(turn, { ended, resolve });
  }

  #changed(live: Live, turn?: number, state?: TurnState) {
    this.#options.onChange({
      repo: live.repo,
      session: live.id,
      folder: live.folder,
      ...(turn === undefined ? {} : { turn }),
      ...(state === undefined ? {} : { state }),
    });
  }

  // Turns.

  /** Restarts the turn's watchdog. */
  #watch(live: Live, turn: Running) {
    clearTimeout(turn.watchdog);
    turn.watchdog = setTimeout(
      () => this.#halt(live, turn, { state: "failed", reason: "No output for 30 minutes." }),
      WATCHDOG_MS,
    );
  }

  /**
   * Interrupts the turn, which then ends as `end` says: SIGINT when it has not ended 10 seconds
   * later, and SIGTERM 10 seconds after that. Its messages not read yet are taken back, and marked
   * so by the agent's `cancelled`.
   */
  #halt(live: Live, turn: Running, end: { state: TurnState; reason?: string }) {
    if (turn.stop) {
      return;
    }
    turn.stop = end;
    clearTimeout(turn.watchdog);
    const proc = live.proc;
    if (!proc) {
      return;
    }
    for (const [id] of this.#unread(live, turn)) {
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
  #unread(live: Live, turn: Running): Array<[string, Sent]> {
    if (!this.adapter.capabilities.takeBack) {
      return [];
    }
    return [...live.messages].filter(
      ([id, sent]) =>
        sent.turn === turn.id && sent.written && sent.item.state === "pending" && id !== turn.first,
    );
  }

  /** Records the end of a turn, running or queued. */
  #endTurn(live: Live, id: number, end: { state: TurnState; reason?: string; costUsd?: number }) {
    if (live.turn?.id === id) {
      clearTimeout(live.turn.watchdog);
      live.turn.terminate.forEach(clearTimeout);
      live.turn = undefined;
    }
    try {
      this.cache.endTurn(id, end);
    } catch (error) {
      console.error(`The session manager could not record the end of turn ${id}: ${String(error)}`);
    }
    this.#pending.get(id)?.resolve();
    this.#pending.delete(id);
    this.#forget(live, id);
    this.#changed(live, id, end.state);
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

  /** After a turn: the next queued turn starts, or the idle timer does. */
  #next(live: Live) {
    if (live.turn) {
      return;
    }
    if (live.queue.length > 0) {
      void this.#serial(live, () => this.#startQueued(live));
      return;
    }
    clearTimeout(live.idle);
    const proc = live.proc;
    if (proc && !proc.closing) {
      live.idle = setTimeout(() => this.#close(proc), IDLE_CLOSE_MS);
    }
  }

  /** Starts the first queued turn, reopening the process when it is gone. */
  async #startQueued(live: Live): Promise<void> {
    if (live.turn) {
      return;
    }
    const queued = live.queue[0];
    if (!queued) {
      return;
    }
    let replaced: boolean;
    try {
      ({ replaced } = await this.#process(live));
    } catch (error) {
      // The turns cannot run: each fails with why.
      const reason = String((error as Error).message ?? error).replace(/^refused: /, "");
      for (const turn of live.queue.splice(0)) {
        this.#endTurn(live, turn.id, { state: "failed", reason });
      }
      return;
    }
    // Stop, or a take-back, may have ended it while the process opened: the next one starts, or
    // the idle timer does.
    if (live.queue[0] !== queued) {
      this.#next(live);
      return;
    }
    live.queue.shift();
    this.cache.startTurn(queued.id);
    if (replaced) {
      this.cache.appendItem(queued.id, { kind: "system", text: REPLACED });
    }
    this.#run(live, queued.id, queued.message);
  }

  // Events.

  /** Reads the process's events into the cache, until it exits. */
  async #consume(live: Live, proc: Proc): Promise<void> {
    for await (const event of proc.agent.events) {
      try {
        if (event.type === "exit") {
          this.#exited(live, proc, event);
          return;
        }
        this.#record(live, proc, event);
      } catch (error) {
        // A cache write that fails does not stop the session.
        console.error(
          `The session manager could not record an event of ${live.id}: ${String(error)}`,
        );
      }
    }
    this.#exited(live, proc, { type: "exit", code: null, stderr: "" });
  }

  #record(live: Live, proc: Proc, event: Exclude<AgentEvent, { type: "exit" }>) {
    const { cache, adapter } = this;
    const turn = live.turn;
    if (turn && !turn.stop) {
      this.#watch(live, turn);
    }
    switch (event.type) {
      case "init": {
        // `/clear` starts a new agent session in the same process.
        if (event.sessionId !== "" && event.sessionId !== this.#row(live).nativeId) {
          cache.updateSession(live.id, { nativeId: event.sessionId });
          this.#changed(live);
        }
        if (event.pluginErrors.length > 0) {
          if (turn) {
            this.#halt(live, turn, {
              state: "failed",
              reason: `The Uraeda skill did not load: ${event.pluginErrors.join("; ")}`,
            });
          }
          this.#close(proc);
        }
        return;
      }
      case "accepted":
      case "cancelled": {
        const sent = live.messages.get(event.id);
        if (sent && sent.item.state === "pending") {
          this.#mark(live, sent, event.type === "accepted" ? "read" : "taken-back");
        }
        return;
      }
    }
    if (!turn) {
      return;
    }
    const append = (item: Item) => {
      const seq = cache.appendItem(turn.id, item);
      this.#changed(live, turn.id);
      return seq;
    };
    const update = (seq: number, item: Item) => {
      cache.updateItem(turn.id, seq, item);
      this.#changed(live, turn.id);
    };
    switch (event.type) {
      case "textDelta":
        if (turn.text) {
          turn.text.text += event.text;
          update(turn.text.seq, { kind: "text", text: turn.text.text, streaming: true });
        } else {
          const item = { kind: "text" as const, text: event.text, streaming: true };
          turn.text = { seq: append(item), text: event.text };
        }
        return;
      case "text":
        if (turn.text) {
          update(turn.text.seq, { kind: "text", text: event.text, streaming: false });
          turn.text = undefined;
        } else {
          append({ kind: "text", text: event.text, streaming: false });
        }
        return;
      case "toolStart": {
        const item: Tool = {
          kind: "tool",
          id: event.id,
          name: event.name,
          toolKind: event.kind,
          ...(event.target === undefined ? {} : { target: event.target }),
          status: "in_progress",
          ...(event.parent === undefined ? {} : { parent: event.parent }),
          ...(event.subagent === undefined ? {} : { subagent: event.subagent }),
        };
        turn.tools.set(event.id, { seq: append(item), item, at: Date.now() });
        return;
      }
      case "toolEnd": {
        const tool = turn.tools.get(event.id);
        if (!tool) {
          return;
        }
        turn.tools.delete(event.id);
        update(tool.seq, {
          ...tool.item,
          status: event.isError ? "failed" : "completed",
          durationMs: Date.now() - tool.at,
          output: event.output.slice(0, OUTPUT_LIMIT),
        });
        return;
      }
      case "retry":
        append({ kind: "system", text: retryText(event) });
        return;
      case "skipped": {
        const count = (turn.skipped?.count ?? 0) + 1;
        const text = `Skipped ${count} ${count === 1 ? "line" : "lines"} ${adapter.name} printed that Uraeda does not read.`;
        if (turn.skipped) {
          update(turn.skipped.seq, { kind: "system", text });
          turn.skipped.count = count;
        } else {
          turn.skipped = { seq: append({ kind: "system", text }), count };
        }
        return;
      }
      case "result":
        this.#result(live, proc, turn, event, append);
        return;
    }
  }

  /**
   * Ends the turn with its result, unless a message steered into it waits to be read: the agent
   * answers it before the turn settles.
   */
  #result(live: Live, proc: Proc, turn: Running, result: Result, append: (item: Item) => number) {
    for (const denial of result.denials) {
      const target = toolTarget(denial.tool, denial.input, proc.cwd);
      append({
        kind: "denial",
        tool: denial.tool,
        ...(target === undefined ? {} : { target }),
        rule: this.adapter.allowRule(denial),
        allowed: false,
      });
    }
    if (result.costUsd !== undefined) {
      turn.cost = result.costUsd;
    }
    const first = live.messages.get(turn.first);
    if (first?.item.state === "pending") {
      this.#mark(live, first, "read");
    }
    const unread = [...live.messages.values()].some(
      (sent) => sent.turn === turn.id && sent.written && sent.item.state === "pending",
    );
    if (result.ok && !turn.stop && unread) {
      return;
    }
    // A turn that ends on its own, as one that failed, takes back what the agent did not read:
    // it would otherwise run after it, in no turn.
    if (!turn.stop) {
      for (const [id, sent] of this.#unread(live, turn)) {
        proc.agent.takeBack(id);
        this.#mark(live, sent, "taken-back");
      }
    }
    const end =
      turn.stop ??
      (result.interrupted
        ? { state: "stopped" as const }
        : result.ok
          ? { state: "done" as const }
          : {
              state: "failed" as const,
              reason:
                result.errors.join("\n") || `${this.adapter.name} ended the turn with an error.`,
            });
    this.#endTurn(live, turn.id, {
      ...end,
      ...(turn.cost === undefined ? {} : { costUsd: turn.cost }),
    });
    this.#next(live);
  }

  /** The process exited: its turn ends, and the queued turns start on a new one. */
  #exited(live: Live, proc: Proc, exit: Exit) {
    if (live.proc !== proc) {
      return;
    }
    live.proc = undefined;
    clearTimeout(live.idle);
    this.cache.releaseSession(live.id);
    const turn = live.turn;
    if (turn) {
      const stderr = exit.stderr.trimEnd().split("\n").slice(-STDERR_LINES).join("\n");
      const end =
        turn.stop ??
        (exit.missing
          ? { state: "failed" as const, reason: REFUSALS.unavailable(this.adapter.name) }
          : {
              state: "failed" as const,
              reason: stderr || `${this.adapter.name} exited with code ${exit.code}.`,
            });
      this.#endTurn(live, turn.id, {
        ...end,
        ...(turn.cost === undefined ? {} : { costUsd: turn.cost }),
      });
    }
    this.#changed(live);
    this.#next(live);
  }

  /** Marks a message read or taken back. */
  #mark(live: Live, sent: Sent, state: Message["state"]) {
    sent.item = { ...sent.item, state };
    this.cache.updateItem(sent.turn, sent.seq, sent.item);
    this.#changed(live, sent.turn);
    this.#forget(live, sent.turn);
  }
}

function retryText({ delayMs, error }: Extract<AgentEvent, { type: "retry" }>): string {
  const seconds = Math.round(delayMs / 1000);
  return error === "rate_limit"
    ? `Rate limited, retrying in ${seconds} s.`
    : `The API failed (${error}), retrying in ${seconds} s.`;
}
