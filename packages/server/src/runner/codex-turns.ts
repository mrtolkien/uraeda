/**
 * The turns of one Codex thread, as its process runs them: a message starts a turn when none runs,
 * joins the running one through `turn/steer`, or waits in the runtime's own queue for the next one,
 * where it can be taken back. Codex's `turn/start` and `turn/steer` taking a message is the agent
 * reading it, `accepted`.
 */
import type { Outgoing } from "./adapter.ts";
import type { CodexRpc } from "./codex-rpc.ts";
import type { AgentEvent } from "./events.ts";

/** What the turns need of their process. */
export type TurnsDeps = {
  /** Ends the process's stdin: the app-server exits. */
  endInput: () => void;
  /** The input items of a message, as `turn/start` and `turn/steer` take them. */
  input: (message: Outgoing) => unknown;
  push: (event: AgentEvent) => void;
  rpc: CodexRpc;
  /** The thread and its default effort, once started; undefined when it failed to. */
  thread: Promise<{ defaultEffort?: string; id: string } | undefined>;
  /** The parameters of the `turn/start` of `message`, on `effort` when set. */
  turnParams: (message: Outgoing, thread: string, effort: string | undefined) => unknown;
};

type Json = Record<string, unknown>;
const isJson = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const reason = (error: unknown) => (error instanceof Error ? error.message : String(error));

export class CodexTurns {
  readonly #deps: TurnsDeps;
  /** Whether a turn runs, from its `turn/start` until its end. */
  #running = false;
  /** Whether the last turn ended well: after one that did not, the runner takes back the rest. */
  #lastOk = true;
  /** The running turn's ID, once `turn/start` answered. */
  #turnId: string | undefined;
  /** Counts the turns started, so a late answer of an ended turn changes nothing. */
  #started = 0;
  #thread: { defaultEffort?: string; id: string } | undefined;
  /** The messages waiting for the next turn, or for the running one's ID to steer. */
  readonly #queue: Array<Outgoing> = [];
  /** The messages whose `turn/steer` is unanswered, and those of them taken back meanwhile. */
  readonly #steering = new Set<string>();
  readonly #takenBack = new Set<string>();
  /** An interrupt asked before the running turn's ID was known. */
  #stop = false;
  #closing = false;
  /** The effort of the next turns: undefined for the agent's default. */
  #effort: string | undefined;
  /** Whether a turn was given an effort, which Codex keeps for the turns after it. */
  #overridden = false;

  constructor(deps: TurnsDeps, effort: string | undefined) {
    this.#deps = deps;
    this.#effort = effort;
    void deps.thread.then((thread) => (this.#thread = thread));
  }

  send(message: Outgoing) {
    if (!this.#running) {
      void this.#start(message);
    } else if (message.when === "steer" && this.#turnId !== undefined) {
      this.#steer(message, this.#turnId);
    } else {
      this.#queue.push(message);
    }
  }

  /** Removes a message waiting in the queue, or one being steered should Codex refuse it. */
  takeBack(id: string) {
    const index = this.#queue.findIndex((message) => message.id === id);
    if (index !== -1) {
      this.#queue.splice(index, 1);
      this.#deps.push({ id, type: "cancelled" });
    } else if (this.#steering.has(id)) {
      this.#takenBack.add(id);
    }
  }

  interrupt() {
    if (!this.#running) {
      return;
    }
    if (this.#turnId === undefined || this.#thread === undefined) {
      this.#stop = true;
      return;
    }
    this.#deps.rpc
      .request("turn/interrupt", { threadId: this.#thread.id, turnId: this.#turnId })
      .catch(() => {});
  }

  /** Ends the process once no turn runs. */
  close() {
    this.#closing = true;
    if (!this.#running) {
      this.#deps.endInput();
    }
  }

  /** From the next turn on: Codex takes a turn's effort for the turns after it too. */
  setEffort(effort: string | undefined) {
    this.#effort = effort;
  }

  /**
   * The running turn ended, as its `turn/completed` or a refused `turn/start` says: a turn that
   * ended well starts the next message waiting, and a closing process ends.
   */
  ended(ok: boolean) {
    this.#running = false;
    this.#lastOk = ok;
    this.#turnId = undefined;
    this.#stop = false;
    if (this.#closing) {
      this.#deps.endInput();
      return;
    }
    // After a failed or stopped turn, the runner takes back what is left.
    const next = ok ? this.#queue.shift() : undefined;
    if (next !== undefined) {
      void this.#start(next);
    }
  }

  /** The effort to give a turn: the agent's default again once another was given. */
  #turnEffort(): string | undefined {
    if (this.#effort !== undefined) {
      this.#overridden = true;
      return this.#effort;
    }
    return this.#overridden ? this.#thread?.defaultEffort : undefined;
  }

  async #start(message: Outgoing) {
    this.#running = true;
    this.#lastOk = true;
    this.#turnId = undefined;
    const started = ++this.#started;
    const thread = await this.#deps.thread;
    if (thread === undefined) {
      // The process reported why it cannot run, and closes: now, when closed meanwhile.
      this.#running = false;
      if (this.#closing) {
        this.#deps.endInput();
      }
      return;
    }
    const params = this.#deps.turnParams(message, thread.id, this.#turnEffort());
    this.#deps.rpc.request("turn/start", params).then(
      (answer) => {
        if (started !== this.#started) {
          return;
        }
        // Codex took the message, even when its turn already completed before this answer.
        this.#deps.push({ id: message.id, type: "accepted" });
        if (!this.#running) {
          return;
        }
        const turn = isJson(answer) && isJson(answer.turn) ? answer.turn : {};
        this.#turnId = typeof turn.id === "string" ? turn.id : undefined;
        if (this.#stop) {
          this.#stop = false;
          this.interrupt();
          return;
        }
        // The messages that came meanwhile join it.
        for (const waiting of this.#queue.splice(0)) {
          this.send(waiting);
        }
      },
      (error) => {
        if (started !== this.#started) {
          return;
        }
        this.#deps.push({
          denials: [],
          errors: [`Codex did not start the turn: ${reason(error)}`],
          interrupted: false,
          ok: false,
          type: "result",
        });
        this.ended(false);
      },
    );
  }

  /**
   * Joins the running turn: refused, as when the turn ended meanwhile, the message waits for the
   * next turn, or starts it, unless it was taken back. After a turn that did not end well, or while
   * closing, it only waits: the runner takes it back, as it does what that turn left (R19).
   */
  #steer(message: Outgoing, turnId: string) {
    const { id } = message;
    this.#steering.add(id);
    const threadId = this.#thread!.id;
    const input = this.#deps.input(message);
    this.#deps.rpc.request("turn/steer", { expectedTurnId: turnId, input, threadId }).then(
      () => {
        this.#steering.delete(id);
        this.#takenBack.delete(id);
        this.#deps.push({ id, type: "accepted" });
      },
      () => {
        this.#steering.delete(id);
        if (this.#takenBack.delete(id)) {
          this.#deps.push({ id, type: "cancelled" });
        } else if (this.#running || !this.#lastOk || this.#closing) {
          this.#queue.push(message);
        } else {
          void this.#start(message);
        }
      },
    );
  }
}
