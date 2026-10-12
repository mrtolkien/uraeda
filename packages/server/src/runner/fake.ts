import type { Adapter, AgentRun, StartOptions } from "./adapter.ts";
import type { AgentEvent } from "./events.ts";

/** A scripted step of a fake run: an event, or a function run in the run's `cwd`. */
export type FakeStep = AgentEvent | ((cwd: string) => void);

/** One fake process: its events are pushed, and read in order until its `exit`. */
class FakeRun implements AgentRun {
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

  interrupt() {
    this.#adapter.interrupts++;
    if (!this.#adapter.ignoreInterrupt) {
      this.push({ type: "exit", code: 130, stderr: "" });
    }
  }

  terminate() {
    this.#adapter.terminates++;
    this.push({ type: "exit", code: 143, stderr: "" });
  }
}

/**
 * An agent for tests, which runs nothing. It records each start, plays the events a test
 * scripted, and keeps a transcript for every session it starts, which a test can remove.
 */
export class FakeAdapter implements Adapter {
  starts: Array<StartOptions> = [];
  interrupts = 0;
  terminates = 0;
  /** Whether the agent is available, for `version()`. */
  installed = true;
  /** The sessions that have a transcript. */
  sessions = new Set<string>();
  /** Keeps a run going after SIGINT, as a stuck process would. */
  ignoreInterrupt = false;
  #scripts: Array<Array<FakeStep>> = [];
  #current: FakeRun | undefined;

  async version() {
    return this.installed ? "0.0.0 (fake agent)" : undefined;
  }

  hasSession(sessionId: string) {
    return this.sessions.has(sessionId);
  }

  /** Queues the next run's events. The run exits with code 0 after them, unless they exit. */
  script(steps: Array<FakeStep>) {
    this.#scripts.push(steps);
  }

  start(options: StartOptions): AgentRun {
    this.starts.push(options);
    this.sessions.add(options.sessionId);
    const run = new FakeRun(this, options.cwd);
    this.#current = run;
    const script = this.#scripts.shift();
    if (script) {
      for (const step of script) {
        run.push(step);
      }
      run.push({ type: "exit", code: 0, stderr: "" });
    }
    return run;
  }

  /** Sends an event on the current run. */
  emit(event: AgentEvent) {
    this.#current?.push(event);
  }

  /** Ends the current run. */
  finish(code = 0, stderr = "") {
    this.#current?.push({ type: "exit", code, stderr });
  }
}
