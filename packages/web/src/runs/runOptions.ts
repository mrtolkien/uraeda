// Run options, as the run map draws them (spec of Run options): the workflow's six steps, each on
// an agent, a model, and an effort; the joints between two steps, where a clean session starts; the
// build's implementers; the reviewers, each an agent or a command; and where reviews happen. A step
// on another agent or model than the step before it always starts a clean session: its cut is forced.
import type { IconName } from "../keys/store.ts";
import type { PickerRuntime, SessionPick } from "../SessionPicker.tsx";

/** The workflow's steps, in their order. */
export const STEPS = ["discovery", "spec", "plan", "build", "review", "comments"] as const;

export type StepId = (typeof STEPS)[number];

/** Each step's name and icon, as the feature page's steps draw them. */
export const STEP_LOOKS: Record<StepId, { icon: IconName; name: string }> = {
  build: { icon: "uraeda:step-implementation", name: "Build" },
  comments: { icon: "uraeda:comment", name: "Comments" },
  discovery: { icon: "uraeda:step-discovery", name: "Discovery" },
  plan: { icon: "uraeda:step-plan", name: "Plan" },
  review: { icon: "uraeda:step-review", name: "Review" },
  spec: { icon: "uraeda:step-spec", name: "Spec" },
};

/** A reviewer: an agent on its pick, using the agent's own review when it has one, or a command. */
export type Reviewer =
  | { kind: "agent"; ownReview?: boolean; pick: SessionPick }
  | { command: string; kind: "command" };

/** Where reviews happen: after each wave and on the branch, or on the branch only. */
export type Depth = "waves" | "branch";

/** A feature's or the settings' run options. */
export type RunOptions = {
  /** The joints, by the index of the step after them, where the human starts a clean session. */
  cuts: ReadonlyArray<number>;
  depth: Depth;
  implementers: SessionPick;
  reviewers: ReadonlyArray<Reviewer>;
  steps: Record<StepId, SessionPick>;
};

/** The efforts a meter draws, in their order: Ultra fills it, outlined. */
export const METER = ["low", "medium", "high", "xhigh", "max"] as const;

/** Whether two picks run on the same agent and model, defaults resolved. */
export function samePick(
  runtimes: ReadonlyArray<PickerRuntime>,
  a: SessionPick,
  b: SessionPick,
): boolean {
  return a.runtime === b.runtime && resolved(runtimes, a).model === resolved(runtimes, b).model;
}

/** Whether the joint before step `index` cuts: by the human's choice, or forced. */
export function jointCuts(
  runtimes: ReadonlyArray<PickerRuntime>,
  options: RunOptions,
  index: number,
) {
  return options.cuts.includes(index) || isForced(runtimes, options, index);
}

/** Whether the joint before step `index` must cut: its two steps run on different models. */
export function isForced(
  runtimes: ReadonlyArray<PickerRuntime>,
  options: RunOptions,
  index: number,
): boolean {
  const before = options.steps[STEPS[index - 1]!];
  const after = options.steps[STEPS[index]!];
  return !samePick(runtimes, before, after);
}

/** The sessions a feature runs in: each a span of steps, from `first` to `last`, by their index. */
export function sessionSpans(
  runtimes: ReadonlyArray<PickerRuntime>,
  options: RunOptions,
): Array<{ first: number; last: number }> {
  const spans = [{ first: 0, last: 0 }];
  for (let index = 1; index < STEPS.length; index++) {
    if (jointCuts(runtimes, options, index)) {
      spans.push({ first: index, last: index });
    } else {
      spans.at(-1)!.last = index;
    }
  }
  return spans;
}

/** The runtime a pick names, else the first one. */
export function runtimeOf(
  runtimes: ReadonlyArray<PickerRuntime>,
  pick: SessionPick,
): PickerRuntime | undefined {
  return runtimes.find((each) => each.kind === pick.runtime) ?? runtimes[0];
}

/** What a pick runs on, its defaults resolved: the model's name and the effort's ID. */
export function resolved(
  runtimes: ReadonlyArray<PickerRuntime>,
  pick: SessionPick,
): { effort?: string; model?: string; modelName?: string } {
  const runtime = runtimeOf(runtimes, pick);
  const model = pick.model ?? runtime?.defaults.model;
  const named = runtime?.models.find((each) => each.id === model);
  const effort =
    named && named.efforts.length === 0 ? undefined : (pick.effort ?? runtime?.defaults.effort);
  return {
    ...(model === undefined ? {} : { model }),
    ...(named === undefined ? {} : { modelName: named.name }),
    ...(effort === undefined ? {} : { effort }),
  };
}

/** Whether a pick differs from the default's, field by field. */
export function changes(pick: SessionPick, fallback: SessionPick) {
  const agent = pick.runtime !== fallback.runtime;
  return {
    agent,
    effort: agent || pick.effort !== fallback.effort,
    model: agent || pick.model !== fallback.model,
  };
}

/** An effort's name for people, from the runtime's lists: "xhigh" is "Extra high". */
function effortName(runtimes: ReadonlyArray<PickerRuntime>, id: string): string {
  for (const runtime of runtimes) {
    for (const model of runtime.models) {
      const effort = model.efforts.find((each) => each.id === id);
      if (effort) {
        return effort.name;
      }
    }
  }
  return id;
}

/**
 * What differs from the defaults, in a few words: "defaults", or each step changed, "Spec on Opus ·
 * High", then a cut moved or reviewers changed.
 */
export function differences(
  runtimes: ReadonlyArray<PickerRuntime>,
  options: RunOptions,
  defaults: RunOptions,
  steps: ReadonlyArray<StepId> = STEPS,
): string {
  const parts: Array<string> = [];
  for (const step of steps) {
    const pick = options.steps[step];
    const changed = changes(pick, defaults.steps[step]);
    if (changed.model || changed.effort) {
      const run = resolved(runtimes, pick);
      const effort = run.effort === undefined ? [] : [effortName(runtimes, run.effort)];
      parts.push(
        `${STEP_LOOKS[step].name} on ${[run.modelName ?? "Default", ...effort].join(" · ")}`,
      );
    }
  }
  const cuts = (each: RunOptions) => [...each.cuts].sort().join();
  if (steps.length > 1 && cuts(options) !== cuts(defaults)) {
    parts.push("sessions moved");
  }
  if (options.reviewers.length !== defaults.reviewers.length) {
    parts.push(`${options.reviewers.length} reviewers`);
  }
  return parts.length === 0 ? "defaults" : parts.join(", ");
}

/** The options with the joint before `step` cut, or joined when it was cut. */
export function withCut(value: RunOptions, step: number): RunOptions {
  const cuts = value.cuts.includes(step)
    ? value.cuts.filter((each) => each !== step)
    : [...value.cuts, step];
  return { ...value, cuts };
}

/**
 * Today's behaviour as options, on the agent `runtime` and its defaults: discovery and spec share a
 * session, a clean one starts at the plan, one reviewer, reviews after each wave.
 */
export function todayOptions(runtime: string): RunOptions {
  const pick: SessionPick = { runtime };
  return {
    cuts: [STEPS.indexOf("plan")],
    depth: "waves",
    implementers: pick,
    reviewers: [{ kind: "agent", pick }],
    steps: {
      build: pick,
      comments: pick,
      discovery: pick,
      plan: pick,
      review: pick,
      spec: pick,
    },
  };
}
