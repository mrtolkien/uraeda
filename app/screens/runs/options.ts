// What the run map reads and changes: run options as the server keeps them (`RunOptions`, only
// what is set), read over what they fall back to, and drawn as each step's agent, model, and
// effort. The map changes only the options it is given, and says only what the human picked: a
// model or an effort left to the agent's default is sent as `""`, which the server stores as that
// default where a fallback would set another (ruling R301). Which agent, model, and effort a value
// left unset runs on is shown from the Agent record, as the server picks it: the step's agent,
// else the default agent (`runs.default_agent`), else the first agent on.
import type {
  ReviewerOptions,
  RunOptions,
  RunPick,
  RuntimeRecord,
  StepOptions,
} from "../../store/protocol";
import type { IconName } from "../../ui/controls";

/** The workflow's steps, in their order. */
export const STEPS = ["discovery", "spec", "plan", "build", "review", "comments"] as const;

export type StepId = (typeof STEPS)[number];

/** Each step's name and icon, as the map's tiles draw them. */
export const STEP_LOOKS: Record<StepId, { icon: IconName; name: string }> = {
  build: { icon: "wrench", name: "Build" },
  comments: { icon: "message-square", name: "Comments" },
  discovery: { icon: "compass", name: "Discovery" },
  plan: { icon: "list-checks", name: "Plan" },
  review: { icon: "scan-eye", name: "Review" },
  spec: { icon: "file-text", name: "Spec" },
};

/** What a step, the implementers, or a reviewer runs on, as picked: unset fields follow. */
export type Pick = { agent?: string | null; model?: string | null; effort?: string | null };

/** The agents the map offers, and the one a pick that names none runs on. */
export type Agents = {
  /** The agents on, in the record's order. */
  on: ReadonlyArray<RuntimeRecord>;
  /** The default agent: the setting's when it is on, else the first one on. */
  fallback: RuntimeRecord | undefined;
  /** Whether `fallback` is the setting's, or the first one on. */
  fallbackIsSet: boolean;
};

/** The agents of the Agent record, with the setting `runs.default_agent`. */
export function agentsOf(runtimes: ReadonlyArray<RuntimeRecord>, setting: string | null): Agents {
  const on = runtimes.filter((one) => one.isOn);
  const set = on.find((one) => one.id === setting);
  return { fallback: set ?? on[0], fallbackIsSet: set !== undefined, on };
}

/** No options: everything follows. */
export const NONE: RunOptions = {
  implementers: null,
  reviewDepth: null,
  reviewers: null,
  steps: [],
};

/** `own` read over `over`, a field at a time; another agent than `over`'s drops `over`'s model and effort. */
export function mergePick(own: Pick | undefined | null, over: Pick | undefined | null): Pick {
  if (own?.agent != null && over?.agent != null && own.agent !== over.agent) {
    return { agent: own.agent, effort: own.effort ?? null, model: own.model ?? null };
  }
  return {
    agent: own?.agent ?? over?.agent ?? null,
    effort: own?.effort ?? over?.effort ?? null,
    model: own?.model ?? over?.model ?? null,
  };
}

const stepOf = (options: RunOptions | null | undefined, step: StepId) =>
  options?.steps.find((one) => one.step === step);

/** A step's pick, `own` over `over`. */
export const stepPick = (own: RunOptions, over: RunOptions | null, step: StepId): Pick =>
  mergePick(stepOf(own, step), stepOf(over, step));

/** What a pick runs on, its defaults resolved, in words: "Claude Code", "Opus 5.5", "High". */
export type Resolved = {
  agent: RuntimeRecord | undefined;
  /** The model's id, `undefined` when the agent names none. */
  model: string | undefined;
  modelName: string;
  effort: string | undefined;
  effortName: string | undefined;
  /** Whether the agent is the default agent, as no agent was picked. */
  defaultAgent: boolean;
};

export function resolve(pick: Pick, agents: Agents): Resolved {
  const named = pick.agent == null ? undefined : agents.on.find((one) => one.id === pick.agent);
  const agent = named ?? agents.fallback;
  const list = agent?.models;
  const model = pick.model || list?.defaults.model || undefined;
  const known = list?.models.find((one) => one.id === model);
  const takesEffort = known === undefined || known.efforts.length > 0;
  const effort = takesEffort ? pick.effort || list?.defaults.effort || undefined : undefined;
  return {
    agent,
    defaultAgent: named === undefined,
    effort,
    effortName: known?.efforts.find((one) => one.id === effort)?.name ?? effort,
    model,
    modelName: known?.name ?? model ?? "Its own model",
  };
}

/** A pick in one line: "Claude Code · Opus 5.5 · High". */
export function pickWords(resolved: Resolved): string {
  const agent = resolved.agent?.name ?? "No agent is on";
  return [agent, resolved.modelName, ...(resolved.effortName ? [resolved.effortName] : [])].join(
    " · ",
  );
}

/** Whether two picks run on one agent and one model: a step after another then shares its session. */
export function samePick(a: Resolved, b: Resolved): boolean {
  return a.agent?.id === b.agent?.id && a.model === b.model;
}

/** Whether the step at `index` starts a new session as asked: the plan does unless told. */
export function asksNew(own: RunOptions, over: RunOptions | null, index: number): boolean {
  const step = STEPS[index]!;
  return stepOf(own, step)?.newSession ?? stepOf(over, step)?.newSession ?? step === "plan";
}

/** The joint before step `index`: whether a new session starts there, and whether it must. */
export function joint(
  own: RunOptions,
  over: RunOptions | null,
  agents: Agents,
  index: number,
): { cuts: boolean; forced: boolean } {
  const before = resolve(stepPick(own, over, STEPS[index - 1]!), agents);
  const after = resolve(stepPick(own, over, STEPS[index]!), agents);
  const forced = !samePick(before, after);
  return { cuts: forced || asksNew(own, over, index), forced };
}

/** `own` with step `step` changed by `patch`: a field set to `undefined` is taken out. */
export function withStep(own: RunOptions, step: StepId, patch: Partial<StepOptions>): RunOptions {
  const had = stepOf(own, step) ?? { step };
  const next = { ...had, ...patch, step } as StepOptions;
  const empty = (["agent", "model", "effort", "newSession"] as const).every(
    (field) => next[field] == null,
  );
  const steps = STEPS.flatMap((one) =>
    one === step ? (empty ? [] : [next]) : own.steps.filter((held) => held.step === one),
  );
  return { ...own, steps };
}

/** The implementers' pick: their own, else the build's agent on that agent's defaults. */
export function implementersPick(own: RunOptions, over: RunOptions | null): Pick {
  const set = mergePick(own.implementers, over?.implementers);
  return set.agent == null && set.model == null && set.effort == null
    ? { agent: stepPick(own, over, "build").agent ?? null }
    : set;
}

/** The reviewers in force: `own`'s, else `over`'s, else one agent reviewer on the review's agent. */
export function reviewersOf(own: RunOptions, over: RunOptions | null): Array<ReviewerOptions> {
  if (own.reviewers?.length) return own.reviewers;
  if (over?.reviewers?.length) return over.reviewers;
  return [reviewer(stepPick(own, over, "review").agent ?? null)];
}

/** A reviewer on `agent`, on its defaults. */
export const reviewer = (agent: string | null): ReviewerOptions => ({
  agent,
  command: null,
  effort: null,
  instructions: null,
  model: null,
});

/** Where reviews happen: after each wave and on the branch, or on the branch only. */
export const depthOf = (own: RunOptions, over: RunOptions | null): "waves" | "branch" =>
  (own.reviewDepth ?? over?.reviewDepth) === "branch" ? "branch" : "waves";

/** Whether `own` sets anything a reset at `place` would take out. */
export function isSet(own: RunOptions, place: Place): boolean {
  switch (place.kind) {
    case "step": {
      const held = stepOf(own, place.step);
      return held?.agent != null || held?.model != null || held?.effort != null;
    }
    case "joint":
      return stepOf(own, STEPS[place.index]!)?.newSession != null;
    case "implementers":
      return own.implementers != null;
    case "reviewer":
      return own.reviewers != null && own.reviewers.length > 0;
    case "depth":
      return own.reviewDepth != null;
    default:
      return false;
  }
}

/** `own` with what is set at `place` taken out: it follows its fallback again. */
export function reset(own: RunOptions, place: Place): RunOptions {
  switch (place.kind) {
    case "step":
      return withStep(own, place.step, { agent: undefined, effort: undefined, model: undefined });
    case "joint":
      return withStep(own, STEPS[place.index]!, { newSession: undefined });
    case "implementers":
      return { ...own, implementers: null };
    case "reviewer":
      return { ...own, reviewers: null };
    case "depth":
      return { ...own, reviewDepth: null };
    default:
      return own;
  }
}

/** A place of the map: a step's tile, the joint before step `index`, or a role under the track. */
export type Place =
  | { kind: "step"; step: StepId }
  | { kind: "joint"; index: number }
  | { kind: "implementers" }
  | { kind: "reviewer"; index: number }
  | { kind: "add" }
  | { kind: "depth" };

/** A place's key in the cursor. */
export function placeKey(place: Place): string {
  switch (place.kind) {
    case "step":
      return `step-${place.step}`;
    case "joint":
      return `joint-${place.index}`;
    case "reviewer":
      return `reviewer-${place.index}`;
    default:
      return place.kind;
  }
}

/** The pick a place holds, `own` over `over`: none for a joint, the add, or the depth. */
export function pickAt(own: RunOptions, over: RunOptions | null, place: Place): Pick | undefined {
  switch (place.kind) {
    case "step":
      return stepPick(own, over, place.step);
    case "implementers":
      return implementersPick(own, over);
    case "reviewer": {
      const held = reviewersOf(own, over)[place.index];
      return held === undefined || held.command != null ? undefined : held;
    }
    default:
      return undefined;
  }
}

/** `own` with the pick at `place` set to `pick`, a whole pick: the agent always named. */
export function withPick(
  own: RunOptions,
  over: RunOptions | null,
  place: Place,
  pick: RunPick,
): RunOptions {
  switch (place.kind) {
    case "step":
      return withStep(own, place.step, pick);
    case "implementers":
      return { ...own, implementers: pick };
    case "reviewer":
      return {
        ...own,
        // A new list: the stored one is the record's, never changed in place.
        // oxlint-disable-next-line no-map-spread
        reviewers: reviewersOf(own, over).map((held, index) =>
          index === place.index ? { ...held, ...pick } : held,
        ),
      };
    default:
      return own;
  }
}

/** `own` with a new session asked, or not, before step `index`. */
export const withNewSession = (own: RunOptions, index: number, cuts: boolean): RunOptions =>
  withStep(own, STEPS[index]!, { newSession: cuts });
