// Run options, as the run map draws them (spec of Run options). The rule of the sessions' joints is
// the server's `uraeda-server/run-options`, shared with the runs it starts: here it reads the
// agents from the picker's runtimes, beside the view's own helpers.
import {
  type Agents,
  isForced as isForcedBy,
  jointCuts as jointCutsBy,
  type MapOptions,
  samePick as samePickBy,
  sessionSpans as sessionSpansBy,
  STEPS,
  type StepId,
  toMap,
  toStored,
  withCut as withCutBy,
} from "uraeda-server/run-options";
import type { Settings } from "uraeda-server/fate";
import type { IconName } from "../keys/store.ts";
import type { PickerRuntime, SessionPick } from "../SessionPicker.tsx";

export { type Depth, STEPS, type StepId } from "uraeda-server/run-options";

/** Each step's name and icon, as the feature page's steps draw them. */
export const STEP_LOOKS: Record<StepId, { icon: IconName; name: string }> = {
  build: { icon: "uraeda:step-implementation", name: "Build" },
  comments: { icon: "uraeda:comment", name: "Comments" },
  discovery: { icon: "uraeda:step-discovery", name: "Discovery" },
  plan: { icon: "uraeda:step-plan", name: "Plan" },
  review: { icon: "uraeda:step-review", name: "Review" },
  spec: { icon: "uraeda:step-spec", name: "Spec" },
};

/**
 * A reviewer: an agent on its pick, using the agent's own review when it has one, or a command.
 * `ownReview` marks, on the map, an agent with a review of its own.
 */
export type Reviewer =
  | { instructions?: string; kind: "agent"; ownReview?: boolean; pick: SessionPick }
  | { command: string; kind: "command" };

/** A feature's or the settings' run options, as the map edits them. */
export type RunOptions = Omit<MapOptions, "reviewers"> & { reviewers: ReadonlyArray<Reviewer> };

/** The efforts a meter draws, in their order: Ultra fills it, outlined. */
export const METER = ["low", "medium", "high", "xhigh", "max"] as const;

/** The agents on, from the picker's runtimes: a runtime not on runs on the first one. */
export function pickerAgents(runtimes: ReadonlyArray<PickerRuntime>): Agents {
  return {
    defaultModel: (runtime) => runtimes.find((each) => each.kind === runtime)?.defaults.model,
    runtime: (chosen) => (runtimes.find((each) => each.kind === chosen) ?? runtimes[0])?.kind,
  };
}

/** Whether two picks run on the same agent and model, defaults resolved. */
export function samePick(
  runtimes: ReadonlyArray<PickerRuntime>,
  a: SessionPick,
  b: SessionPick,
): boolean {
  return samePickBy(pickerAgents(runtimes), a, b);
}

/** Whether the joint before step `index` cuts: by the human's choice, or forced. */
export function jointCuts(
  runtimes: ReadonlyArray<PickerRuntime>,
  options: RunOptions,
  index: number,
): boolean {
  return jointCutsBy(pickerAgents(runtimes), options, index);
}

/** Whether the joint before step `index` must cut: its two steps run on different models. */
export function isForced(
  runtimes: ReadonlyArray<PickerRuntime>,
  options: RunOptions,
  index: number,
): boolean {
  return isForcedBy(pickerAgents(runtimes), options, index);
}

/** The options with the joint before `step` cut, or joined when it was cut; a forced one kept. */
export function withCut(
  runtimes: ReadonlyArray<PickerRuntime>,
  options: RunOptions,
  step: number,
): RunOptions {
  return withCutBy(pickerAgents(runtimes), options, step);
}

/** The sessions a feature runs in: each a span of steps, from `first` to `last`, by their index. */
export function sessionSpans(
  runtimes: ReadonlyArray<PickerRuntime>,
  options: RunOptions,
): Array<{ first: number; last: number }> {
  return sessionSpansBy(pickerAgents(runtimes), options);
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

/** Run options as the settings file and a feature keep them: only what they set. */
export type StoredOptions = Settings["runs"]["options"];

/** Stored options as the map edits them, a step that names no agent on `runtime`. */
export function fromStored(stored: StoredOptions, runtime: string): RunOptions {
  return toMap(stored, runtime);
}

/** What the map's `options` store over `defaults`: only what differs from them. */
export function toSaved(options: RunOptions, defaults: RunOptions): StoredOptions {
  return toStored(options, defaults);
}

/**
 * Today's behaviour as options, on the agent `runtime` and its defaults: discovery and spec share a
 * session, a clean one starts at the plan, one reviewer, reviews after each wave.
 */
export function todayOptions(runtime: string): RunOptions {
  return fromStored({ steps: [] }, runtime);
}
