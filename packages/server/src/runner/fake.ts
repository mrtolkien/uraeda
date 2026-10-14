import type { Adapter, AgentProcess, Capabilities, OpenOptions, Outgoing } from "./adapter.ts";
import { allowRule } from "./claude-events.ts";
import type { AgentEvent, Denial } from "./events.ts";

/** A scripted step of a fake turn: an event, or a function run in the process's `cwd`. */
export type FakeStep = AgentEvent | ((cwd: string) => void);

type Signal = Parameters<AgentProcess["kill"]>[0];

/** The exit code of a shell process ended by each signal. */
const EXIT_CODES: Record<Signal, number> = { SIGINT: 130, SIGKILL: 137, SIGTERM: 143 };

/** One fake process: its events are pushed, and read in order until its `exit`. */
class FakeProcess implements AgentProcess {
  #steps: Array<FakeStep> = [];
  #wake: (() => void) | undefined;
  #exited = false;
  #adapter: FakeAdapter;
  #cwd: string;

  constructor(adapter: FakeAdapter, cwd: string) {
    this.#adapter = adapter;
    this.#cwd = cwd;
  }

  get exited() {
    return this.#exited;
  }

  push(step: FakeStep) {
    if (this.#exited) {
      return;
    }
    if (typeof step !== "function" && step.type === "exit") {
      this.#exited = true;
    }
    this.#steps.push(step);
    this.#wake?.();
  }

  events: AsyncIterable<AgentEvent> = {
    [Symbol.asyncIterator]: () => ({
      next: async (): Promise<IteratorResult<AgentEvent>> => {
        for (;;) {
          const step = this.#steps.shift();
          if (step === undefined) {
            if (this.#exited) {
              return { done: true, value: undefined };
            }
            await new Promise<void>((resolve) => (this.#wake = resolve));
            this.#wake = undefined;
            continue;
          }
          if (typeof step === "function") {
            step(this.#cwd);
            continue;
          }
          return { done: false, value: step };
        }
      },
    }),
  };

  /** Records the message, and plays the next scripted turn: read, its steps, then its result. */
  send(message: Outgoing) {
    this.#adapter.sent.push(message);
    const script = this.#adapter.nextScript();
    if (script === undefined || this.#exited) {
      return;
    }
    this.push({ id: message.id, type: "accepted" });
    for (const step of script) {
      this.push(step);
    }
    const ends = script.some(
      (step) => typeof step !== "function" && (step.type === "result" || step.type === "exit"),
    );
    if (!ends) {
      this.push({ denials: [], errors: [], interrupted: false, ok: true, type: "result" });
    }
  }

  takeBack(id: string) {
    this.#adapter.takenBack.push(id);
  }

  /** Drops the steps not read yet, and ends the turn as interrupted, unless it is stuck. */
  interrupt() {
    this.#adapter.interrupts++;
    if (this.#adapter.ignoreInterrupt || this.#exited) {
      return;
    }
    this.#steps = [];
    this.push({ denials: [], errors: [], interrupted: true, ok: false, type: "result" });
  }

  /** Ends it, unless it ignores its stdin's end. */
  close() {
    this.#adapter.closes++;
    if (this.#adapter.ignoreClose) {
      return;
    }
    this.push({ code: 0, stderr: "", type: "exit" });
  }

  /** SIGKILL ends it; SIGTERM too, unless it ignores it; SIGINT too, unless it is stuck. */
  kill(signal: Signal) {
    this.#adapter.kills.push(signal);
    if (signal === "SIGINT" && this.#adapter.ignoreInterrupt) {
      return;
    }
    if (signal === "SIGTERM" && this.#adapter.ignoreTerm) {
      return;
    }
    this.push({ code: EXIT_CODES[signal], stderr: "", type: "exit" });
  }
}

/**
 * An agent for tests, which runs nothing. It records each open and each message, plays the turns a
 * test scripted as messages are sent, and keeps a transcript for every session it opens, which a
 * test can remove.
 */
export class FakeAdapter implements Adapter {
  kind = "fake";
  /** The name the refusals use, as Claude Code's. */
  name = "Claude Code";
  /** What the fake declares, which a test may change. */
  capabilities: Capabilities = {
    approvals: false,
    queue: true,
    steer: true,
    subagents: true,
    takeBack: true,
  };
  opens: Array<OpenOptions> = [];
  sent: Array<Outgoing> = [];
  /** The message IDs taken back. The fake gives no `cancelled` event: a test emits it. */
  takenBack: Array<string> = [];
  interrupts = 0;
  closes = 0;
  kills: Array<Signal> = [];
  /** Whether the agent is available, for `version()`. */
  installed = true;
  /** The sessions that have a transcript. */
  sessions = new Set<string>();
  /** Keeps a turn going after the interrupt and SIGINT, as a stuck process would. */
  ignoreInterrupt = false;
  /** Keeps a process running after its close, as one that ignores its stdin's end would. */
  ignoreClose = false;
  /** Keeps a process running after SIGTERM: only SIGKILL ends it. */
  ignoreTerm = false;
  /** Whether a process says `init` as it opens, with its own session ID; else a test emits it. */
  autoInit = true;
  #scripts: Array<Array<FakeStep>> = [];
  #current: FakeProcess | undefined;

  async version() {
    return this.installed ? "0.0.0 (fake agent)" : undefined;
  }

  hasSession(nativeId: string) {
    return this.sessions.has(nativeId);
  }

  allowRule(denial: Denial): string | undefined {
    return allowRule(denial);
  }

  /**
   * Queues a turn's events, played when a message is sent: an `accepted` for the message, the
   * steps, then a successful `result` unless they end the turn themselves.
   */
  script(steps: Array<FakeStep>) {
    this.#scripts.push(steps);
  }

  /** The next scripted turn, for the current process. */
  nextScript(): Array<FakeStep> | undefined {
    return this.#scripts.shift();
  }

  open(options: OpenOptions): AgentProcess {
    this.opens.push(options);
    this.sessions.add(options.nativeId);
    const agent = new FakeProcess(this, options.cwd);
    this.#current = agent;
    if (this.autoInit) {
      agent.push({
        pluginErrors: [],
        plugins: ["uraeda"],
        sessionId: options.nativeId,
        type: "init",
      });
    }
    return agent;
  }

  /** Sends an event on the current process. */
  emit(event: AgentEvent) {
    this.#current?.push(event);
  }

  /** Ends the current process. */
  exit(code = 0, stderr = "") {
    this.#current?.push({ code, stderr, type: "exit" });
  }
}
