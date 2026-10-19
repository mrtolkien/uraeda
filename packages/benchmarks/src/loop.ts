import type { Adapter } from "uraeda-server/runner/adapter";
import type { Denial } from "uraeda-server/runner/events";
import { retryMessage, runMessage } from "uraeda-server/runner/message";
import { DATASET_HOSTS, upstreamHosts } from "./config-dir.ts";
import { isPushed, type NextJson, nextStep } from "./next.ts";
import type { Blocked, Outcome, Step } from "./record.ts";
import { isInvalidRun, runSession, type SessionResult, stepOf } from "./session.ts";

/** What the human's turn is about. */
export type HumanTurn = {
  branch: string;
  /** The waiting file's name in the feature's folder. */
  file: string | null;
  /** The feature's folder, `specs/<feature>`: the only place the human's commits may touch. */
  folder: string;
  repo: string;
  step: string;
};
/** What the human did: the commit it made, and what it did at the gate. */
export type HumanResult = { commit?: string; gate: string; session: SessionResult };

export type LoopOptions = {
  adapter: Adapter;
  /** What the loop asks: who is up, and whether the branch is pushed. Real by default. */
  deps?: {
    isPushed?: (repo: string, branch: string) => Promise<boolean>;
    next?: (repo: string, feature: string) => Promise<NextJson>;
  };
  feature: string;
  human: (turn: HumanTurn) => Promise<HumanResult>;
  maxSteps: number;
  /** The model asked for: any session naming another fails the run. */
  model: string;
  now?: () => number;
  repo: string;
  /** The task's upstream repository, whose fetched addresses flag the run. */
  upstream: string;
};

export type LoopResult = {
  blocked: Array<Blocked>;
  flags: Array<"leak-suspected">;
  models: Array<string>;
  outcome: Outcome;
  reason?: string;
  sessions: Array<{ nativeId: string; role: Step["role"] }>;
  steps: Array<Step>;
  urls: Array<string>;
};

/**
 * Whether an address is one a run must not read: the task's upstream repository, on any of its
 * hosts, or the benchmark's own, which holds each task's hidden tests and reference solution.
 */
export function isUpstream(address: string, upstream: string): boolean {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return false;
  }
  const path = new URL(upstream).pathname.replace(/\.git$/, "").toLowerCase();
  const lower = url.pathname.toLowerCase();
  const inRepository =
    lower === path ||
    lower.startsWith(`${path}/`) ||
    lower.startsWith(`${path}.git`) ||
    lower.includes(`/repos${path}`) ||
    lower.includes(`${path}/`);
  const inDataset = DATASET_HOSTS.includes(url.hostname) && /\/(scaleapi|scaleai)\//.test(lower);
  return (upstreamHosts(upstream).includes(url.hostname) && inRepository) || inDataset;
}

/** A reason that ends the run, with the outcome it ends as. */
type Stop = [Outcome, string];

/** The command a blocked action ran, when it ran one. */
const commandOf = (denial: Denial) =>
  typeof denial.input.command === "string" ? { target: denial.input.command } : {};

/** One run of the loop: its record so far, and the rules that end it. */
class Loop {
  readonly result: LoopResult = {
    blocked: [],
    flags: [],
    models: [],
    outcome: "stalled",
    sessions: [],
    steps: [],
    urls: [],
  };
  #options: LoopOptions;
  #seenBlocks = new Set<string>();

  constructor(options: LoopOptions) {
    this.#options = options;
  }

  get full() {
    return this.result.steps.length >= this.#options.maxSteps;
  }

  /** Records a session's step, addresses, models, and the leak flag. */
  keep(role: Step["role"], step: string, session: SessionResult, gate = "") {
    const { result } = this;
    result.steps.push(stepOf(role, step, session, gate));
    result.sessions.push({ nativeId: session.nativeId, role });
    result.urls.push(...session.urls);
    for (const model of session.models) {
      if (!result.models.includes(model)) {
        result.models.push(model);
      }
    }
    if (result.urls.some((url) => isUpstream(url, this.#options.upstream))) {
      result.flags = ["leak-suspected"];
    }
  }

  end(outcome: Outcome, reason?: string): LoopResult {
    this.result.outcome = outcome;
    if (reason !== undefined) {
      this.result.reason = reason;
    }
    return this.result;
  }

  /** Why a session ends the run, or undefined when it goes on. */
  check(session: SessionResult): Stop | undefined {
    if (session.usageLimit) {
      return ["usage-limit", "the usage limit was reached"];
    }
    const other = session.models.find((model) => model !== this.#options.model);
    if (other !== undefined) {
      return ["failed", `a session was answered by ${other}, not ${this.#options.model}`];
    }
    if (!session.ok) {
      return ["failed", session.errors.join("; ") || session.exit?.stderr || "the session failed"];
    }
    return undefined;
  }

  /** The human's turn at a gate. */
  async humanTurn(view: NextJson, branch: string): Promise<Stop | undefined> {
    const { step } = view;
    try {
      const turn = await this.#options.human({
        branch,
        file: step.file,
        folder: `specs/${view.feature}`,
        repo: this.#options.repo,
        step: step.name,
      });
      this.keep("human", step.name, turn.session, turn.gate);
      const stop = this.check(turn.session);
      if (stop === undefined && turn.commit === undefined) {
        return ["failed", `the human made no commit at ${step.name}`];
      }
      return stop;
    } catch (error) {
      if (isInvalidRun(error)) {
        if (error.session) {
          this.keep("human", step.name, error.session, "invalid");
        }
        return ["invalid", error.message];
      }
      throw error;
    }
  }

  /** The agent's session, and a retry of each action `auto` mode blocked. */
  async agentTurn(view: NextJson, branch: string): Promise<Stop | undefined> {
    const { step } = view;
    const message = runMessage({
      branch,
      feature: { kind: "feature", path: `specs/${view.feature}` },
      ...(step["plan-review"] === null ? {} : { planReview: step["plan-review"] }),
      reference: step.reference ?? "",
      step: step.name,
    });
    const { adapter, now, repo } = this.#options;
    const session = await runSession({ adapter, cwd: repo, message, ...(now ? { now } : {}) });
    this.keep("agent", step.name, session);
    const stop = this.check(session);
    if (stop) {
      return stop;
    }
    for (const denial of session.denials) {
      const retried = await this.#allow(denial, session.nativeId, step.name);
      if (retried) {
        return retried;
      }
    }
    return undefined;
  }

  /**
   * Allows a blocked action once, with the adapter's narrow rule, or only records it when no rule
   * allows it alone: the same action blocked again fails the run.
   */
  async #allow(denial: Denial, nativeId: string, step: string): Promise<Stop | undefined> {
    const { adapter, now, repo } = this.#options;
    const key = `${denial.tool} ${JSON.stringify(denial.input)}`;
    if (this.#seenBlocks.has(key)) {
      return ["failed", `auto mode blocked ${denial.tool} again: ${key}`];
    }
    this.#seenBlocks.add(key);
    const rule = adapter.allowRule(denial);
    this.result.blocked.push({ rule: rule ?? "none", tool: denial.tool, ...commandOf(denial) });
    if (rule === undefined) {
      // No narrow rule allows it alone, so it stays blocked: the agent goes on without it.
      return undefined;
    }
    const retry = await runSession({
      adapter,
      allowed: rule,
      cwd: repo,
      message: retryMessage({ tool: denial.tool, ...commandOf(denial) }),
      nativeId,
      resume: true,
      ...(now ? { now } : {}),
    });
    this.keep("agent", step, retry);
    return this.check(retry);
  }
}

/**
 * Runs the sessions in the order `ura next --json` says: the agent where it waits on the agent, the
 * simulated human where it waits on the human, each in a fresh session. It ends when the branch is
 * pushed after the implementation, a session fails or names the wrong model, the usage limit is
 * reached, or `maxSteps` sessions have run.
 */
export async function runLoop(options: LoopOptions): Promise<LoopResult> {
  const next = options.deps?.next ?? nextStep;
  const pushed = options.deps?.isPushed ?? isPushed;
  const loop = new Loop(options);
  try {
    while (!loop.full) {
      const view = await next(options.repo, options.feature);
      const { branch, step } = view;
      if (step.implemented && branch !== null && (await pushed(options.repo, branch))) {
        return loop.end("finished");
      }
      if (branch === null || step["waits-on"] === "nobody") {
        return loop.end("failed", `${options.feature} waits on nobody at ${step.name}`);
      }
      const stop =
        step["waits-on"] === "human"
          ? await loop.humanTurn(view, branch)
          : await loop.agentTurn(view, branch);
      if (stop) {
        return loop.end(...stop);
      }
    }
  } catch (error) {
    // Whatever broke, the steps so far are kept, and the record says why the run ended.
    return loop.end("failed", error instanceof Error ? error.message : String(error));
  }
  return loop.end("stalled", `${options.maxSteps} sessions ran without the branch being pushed`);
}
