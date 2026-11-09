// The rule of a run's sessions, shared by the server, which picks the session each run goes to, and
// the web UI, whose run map draws it: the workflow's six steps, each on an agent, a model, and an
// effort; the joints between two steps, where a clean session starts; the build's implementers; the
// reviewers; and where reviews happen. A step on another agent or model than the step before it
// always starts a clean session: its cut is forced. Free of Node's modules, so the UI can import it.
import type { ReviewerOptions, RunOptions, RunPick, StepOptions } from "uraeda-binding";

/** The workflow's steps, in their order. */
export const STEPS = ["discovery", "spec", "plan", "build", "review", "comments"] as const;

export type StepId = (typeof STEPS)[number];

/** Where reviews happen: after each wave and on the branch, or on the branch only. */
export type Depth = "waves" | "branch";

/** What a step or a role runs on: a model or an effort left out is the agent's own default. */
export type StepPick = { effort?: string; model?: string; runtime: string };

/** A reviewer: an agent on its pick, through the agent's own review, or a command. */
export type Reviewer =
  | { instructions?: string; kind: "agent"; pick: StepPick }
  | { command: string; kind: "command" };

/** A feature's or the settings' run options, as the run map edits them. */
export type MapOptions = {
  /** The joints, by the index of the step after them, where the human starts a clean session. */
  cuts: ReadonlyArray<number>;
  depth: Depth;
  implementers: StepPick;
  reviewers: ReadonlyArray<Reviewer>;
  steps: Record<StepId, StepPick>;
};

/**
 * How a pick's defaults resolve: the runtime a pick runs on, the one chosen when it is on, else the
 * first runtime on; and the model a runtime runs when none is picked.
 */
export type Agents = {
  defaultModel(runtime: string): string | undefined;
  runtime(chosen?: string): string | undefined;
};

/** Whether two picks run on the same agent and model, defaults resolved. */
export function samePick(agents: Agents, a: StepPick, b: StepPick): boolean {
  const runtime = agents.runtime(a.runtime);
  if (runtime !== agents.runtime(b.runtime)) {
    return false;
  }
  const model = (pick: StepPick) =>
    pick.model ?? (runtime === undefined ? undefined : agents.defaultModel(runtime));
  return model(a) === model(b);
}

/** Whether the joint before step `index` must cut: its two steps run on different models. */
export function isForced(agents: Agents, options: MapOptions, index: number): boolean {
  const before = options.steps[STEPS[index - 1]!];
  const after = options.steps[STEPS[index]!];
  return !samePick(agents, before, after);
}

/** Whether the joint before step `index` cuts: by the human's choice, or forced. */
export function jointCuts(agents: Agents, options: MapOptions, index: number): boolean {
  return options.cuts.includes(index) || isForced(agents, options, index);
}

/** The sessions a feature runs in: each a span of steps, from `first` to `last`, by their index. */
export function sessionSpans(
  agents: Agents,
  options: MapOptions,
): Array<{ first: number; last: number }> {
  const spans = [{ first: 0, last: 0 }];
  for (let index = 1; index < STEPS.length; index++) {
    if (jointCuts(agents, options, index)) {
      spans.push({ first: index, last: index });
    } else {
      spans.at(-1)!.last = index;
    }
  }
  return spans;
}

/**
 * Whether a run of `to` goes to the session that ran `from`: both steps in one span, `from` not
 * after `to`, so a step's own runs share its session.
 */
export function stepSession(agents: Agents, options: MapOptions, from: StepId, to: StepId) {
  const first = STEPS.indexOf(from);
  const last = STEPS.indexOf(to);
  if (first > last) {
    return false;
  }
  for (let index = first + 1; index <= last; index++) {
    if (jointCuts(agents, options, index)) {
      return false;
    }
  }
  return true;
}

/**
 * The options with the joint before `step` cut, or joined when it was cut. A forced joint keeps
 * its options unchanged: it cuts whatever the human chooses, and a choice there would be stored
 * where no one sees it.
 */
export function withCut<Options extends MapOptions>(
  agents: Agents,
  value: Options,
  step: number,
): Options {
  if (isForced(agents, value, step)) {
    return value;
  }
  const cuts = value.cuts.includes(step)
    ? value.cuts.filter((each) => each !== step)
    : [...value.cuts, step];
  return { ...value, cuts };
}

/** A stored pick on `fallback` when it names no agent. */
function pickOf(stored: RunPick | undefined, fallback: string): StepPick {
  return {
    ...(stored?.effort === undefined ? {} : { effort: stored.effort }),
    ...(stored?.model === undefined ? {} : { model: stored.model }),
    runtime: stored?.agent ?? fallback,
  };
}

/** A stored reviewer as the map holds it: a table without `command` is an agent's. */
function reviewerOf(stored: ReviewerOptions, fallback: string): Reviewer {
  if (stored.command !== undefined) {
    return { command: stored.command, kind: "command" };
  }
  return {
    ...(stored.instructions === undefined ? {} : { instructions: stored.instructions }),
    kind: "agent",
    pick: pickOf(stored, fallback),
  };
}

/** The reviewer when none is set: the review step's agent, on its own model and effort. */
function defaultReviewer(steps: Record<StepId, StepPick>): Reviewer {
  return { kind: "agent", pick: { runtime: steps.review.runtime } };
}

/**
 * Stored options as the map edits them, a step naming no agent on `fallbackRuntime`: the plan's
 * `new_session` is `true` when unset, the implementers by default on the build's agent, on that
 * agent's defaults, and no reviewers one agent reviewer on the review step's agent and that agent's
 * defaults.
 */
export function toMap(options: RunOptions, fallbackRuntime: string): MapOptions {
  const stored = (step: StepId) => options.steps.find((each) => each.step === step);
  const steps = Object.fromEntries(
    STEPS.map((step) => [step, pickOf(stored(step), fallbackRuntime)]),
  ) as Record<StepId, StepPick>;
  const cuts = STEPS.flatMap((step, index) =>
    index > 0 && (stored(step)?.newSession ?? step === "plan") ? [index] : [],
  );
  const reviewers = options.reviewers?.length
    ? options.reviewers.map((each) => reviewerOf(each, steps.review.runtime))
    : [defaultReviewer(steps)];
  return {
    cuts,
    depth: options.reviewDepth === "branch" ? "branch" : "waves",
    implementers: pickOf(options.implementers, steps.build.runtime),
    reviewers,
    steps,
  };
}

/**
 * The fields of `pick` that differ from `fallback`'s, as a stored pick: its agent named whenever
 * it differs or a model or an effort is stored, as a stored model never goes without its agent.
 */
function storedPick(pick: StepPick, fallback: StepPick): RunPick {
  const differs = (key: keyof StepPick) => pick[key] !== undefined && pick[key] !== fallback[key];
  const tuned = differs("model") || differs("effort");
  return {
    ...(pick.runtime === fallback.runtime && !tuned ? {} : { agent: pick.runtime }),
    ...(differs("model") ? { model: pick.model } : {}),
    ...(differs("effort") ? { effort: pick.effort } : {}),
  };
}

/** A reviewer as stored, its agent named. */
function storedReviewer(reviewer: Reviewer): ReviewerOptions {
  if (reviewer.kind === "command") {
    return { command: reviewer.command };
  }
  const { effort, model, runtime } = reviewer.pick;
  return {
    agent: runtime,
    ...(model === undefined ? {} : { model }),
    ...(effort === undefined ? {} : { effort }),
    ...(reviewer.instructions === undefined ? {} : { instructions: reviewer.instructions }),
  };
}

/** The steps of `map` that differ from `defaults`, as stored. */
function storedSteps(map: MapOptions, defaults: MapOptions): Array<StepOptions> {
  return STEPS.flatMap((step, index) => {
    const cut = map.cuts.includes(index);
    const newSession =
      index > 0 && cut !== defaults.cuts.includes(index) ? { newSession: cut } : {};
    const options = { ...storedPick(map.steps[step], defaults.steps[step]), ...newSession };
    return Object.keys(options).length === 0 ? [] : [{ step, ...options }];
  });
}

/** Whether the implementers follow the build: on its agent, on that agent's defaults. */
function followBuild(options: MapOptions): boolean {
  const { effort, model, runtime } = options.implementers;
  return runtime === options.steps.build.runtime && model === undefined && effort === undefined;
}

/**
 * The implementers to store over `defaults`: none while both follow their build, and, while only
 * the defaults follow theirs, what differs from following the map's own build.
 */
function storedImplementers(map: MapOptions, defaults: MapOptions): RunPick {
  if (!followBuild(defaults)) {
    return storedPick(map.implementers, defaults.implementers);
  }
  return followBuild(map) ? {} : storedPick(map.implementers, { runtime: map.steps.build.runtime });
}

/** Whether two reviewers are the same, field by field. */
function sameReviewer(a: Reviewer, b: Reviewer): boolean {
  if (a.kind === "command" || b.kind === "command") {
    return a.kind === "command" && b.kind === "command" && a.command === b.command;
  }
  return (
    a.instructions === b.instructions &&
    a.pick.runtime === b.pick.runtime &&
    a.pick.model === b.pick.model &&
    a.pick.effort === b.pick.effort
  );
}

/** Whether two lists hold the same reviewers, in the same order. */
function sameReviewers(a: ReadonlyArray<Reviewer>, b: ReadonlyArray<Reviewer>): boolean {
  return a.length === b.length && a.every((reviewer, index) => sameReviewer(reviewer, b[index]!));
}

/** Whether the reviewers are the one agent reviewer on the review step's agent, as when unset. */
function onReviewStep(options: MapOptions): boolean {
  return sameReviewers(options.reviewers, [defaultReviewer(options.steps)]);
}

/**
 * The options of `map` to store over `defaults`: only the fields that differ, and the whole list of
 * reviewers when it differs. A value the map leaves to the agent's default, where `defaults` set
 * one, cannot be stored: the stored options only add values over the defaults. Reviewers left to
 * follow the review step stay unset.
 */
export function toStored(map: MapOptions, defaults: MapOptions): RunOptions {
  const implementers = storedImplementers(map, defaults);
  const keepsReviewers =
    (onReviewStep(map) && onReviewStep(defaults)) ||
    sameReviewers(map.reviewers, defaults.reviewers);
  return {
    steps: storedSteps(map, defaults),
    ...(Object.keys(implementers).length === 0 ? {} : { implementers }),
    ...(keepsReviewers ? {} : { reviewers: map.reviewers.map(storedReviewer) }),
    ...(map.depth === defaults.depth ? {} : { reviewDepth: map.depth }),
  };
}
