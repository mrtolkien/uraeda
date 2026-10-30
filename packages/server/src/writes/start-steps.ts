// A start's steps, as its write in the queue shows them: each waiting, running, done, or refused,
// with its seconds, and the commit's with what git and the hooks print.
import type { StartStepView } from "uraeda-binding";
import type { StartStep } from "./queue.ts";
import { Throttle } from "./throttle.ts";

/** How often a running step's seconds are counted again. */
const TICK_MS = 1000;

/**
 * The steps of a start, as its mockups word them: the commit on the default branch, the branch and
 * its worktree, unknown before a typed change's start runs, and the agent.
 */
export function startSteps(defaultBranch: string, branch?: string): Array<StartStep> {
  return [
    `Commit the proposal on ${defaultBranch}, running your hooks`,
    branch === undefined
      ? "Make the branch and its worktree"
      : `Make the branch ${branch} and its worktree`,
    "Start the agent with your message",
  ].map((label) => ({ label, state: "waiting" }));
}

/** The index of each step of `startSteps`. */
export const STEP = { agent: 2, branch: 1, commit: 0 } as const;

/**
 * The steps of a start as it runs, each change given to `publish`. The core's steps move them on;
 * a step the core reports once the start settled is ignored: the call's promise is the end.
 */
export class StartProgress {
  #steps: Array<StartStep>;
  /** Publishes the steps: a line of output at most once each 100 ms, any other change at once. */
  #publish: Throttle;
  #at = -1;
  #since = 0;
  #timer?: ReturnType<typeof setInterval>;
  #settled = false;

  constructor(steps: Array<StartStep>, publish: (steps: Array<StartStep>) => void) {
    this.#steps = steps.map((step) => ({ ...step }));
    this.#publish = new Throttle(() => publish(this.#steps.map((each) => ({ ...each }))));
  }

  /** Moves on with the core's step: the commit, a line of its output, or the branch. */
  step({ line, step }: StartStepView, onOutput: (line: string) => void): void {
    if (this.#settled) {
      return;
    }
    if (step === "committing") {
      this.to(STEP.commit);
    } else if (step === "branching") {
      this.to(STEP.branch);
    } else if (step === "output" && line !== undefined) {
      const commit = this.#steps[STEP.commit];
      commit.output = commit.output === undefined ? line : `${commit.output}\n${line}`;
      onOutput(line);
      this.#publish.soon();
    }
  }

  /** Ends the running step and those before `index`, done, and runs step `index`. */
  to(index: number): void {
    if (this.#settled || index <= this.#at) {
      return;
    }
    this.#end("done");
    for (const skipped of this.#steps.slice(this.#at + 1, index)) {
      skipped.state = "done";
    }
    this.#at = index;
    this.#since = Date.now();
    this.#steps[index].state = "running";
    this.#steps[index].seconds = 0;
    clearInterval(this.#timer);
    this.#timer = setInterval(() => this.#count(), TICK_MS);
    this.#timer.unref();
    this.#changed();
  }

  /** Every step done: from now on, the core's late steps are ignored. */
  done(): void {
    this.#settle("done");
    for (const step of this.#steps) {
      step.state = "done";
    }
    this.#changed();
  }

  /** The running step refused, the first if none ran, its output the refusal's when none came. */
  refused(output: string): void {
    this.#at = Math.max(this.#at, 0);
    this.#steps[this.#at].output ??= output;
    this.#settle("refused");
    this.#changed();
  }

  #settle(state: "done" | "refused"): void {
    this.#settled = true;
    this.#end(state);
    clearInterval(this.#timer);
  }

  #end(state: "done" | "refused"): void {
    const step = this.#steps[this.#at];
    if (step !== undefined && step.state !== "done") {
      this.#count();
      step.state = state;
    }
  }

  #count(): void {
    const step = this.#steps[this.#at];
    if (step?.state === "running") {
      step.seconds = Math.round((Date.now() - this.#since) / 1000);
      this.#changed();
    }
  }

  #changed(): void {
    this.#publish.now();
  }
}
