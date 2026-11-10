// A feature's or a change's stages, as its page's run map draws them (spec of Run options, from the
// review's C2): the core's stages, read from its commits, put on the map's steps. Questions is
// Discovery, a change's Fix is its Build, the pull request is Review, and changes asked on it are
// Comments. The proposal and the merge are the map's two ends. Each part keeps what the timeline
// showed: its time, its files, and the current build's tasks. The joints where the workflow waits
// for the human are its gates, one of them waiting when the feature waits there now.
import type { TaskProgress } from "uraeda-binding";
import { filesByStage, type FilesFeature, type TimelineFile } from "../feature/stageFiles.ts";
import { stageLine, type StagesHistory } from "../feature/timeline.ts";
import { STEPS, type StepId } from "./runOptions.ts";

/** Where a part stands: passed, at work, or ahead. */
export type StageState = "done" | "current" | "todo";

/** What a step or an end of the map shows of the feature's history. */
export type StagePart = {
  files: ReadonlyArray<TimelineFile>;
  line?: string;
  state: StageState;
  tasks?: TaskProgress;
};

/** A joint where the workflow waits for the human: `waiting` when the feature waits there now. */
export type Gate = "gate" | "waiting";

/** The feature's history on its map. */
export type FeatureStages = {
  /** A change's gate before its merge: the review of its pull request. */
  endGate?: Gate;
  ends: { merged: StagePart; proposal: StagePart };
  /** The gates, by the index of the step after their joint. */
  gates: Partial<Record<number, Gate>>;
  isChange: boolean;
  /** Merged: every step is done, and nothing is edited any more. */
  isFinished: boolean;
  /** The steps the feature has: a change has no spec, plan, or comments of its own. */
  shown: ReadonlyArray<StepId>;
  steps: Partial<Record<StepId, StagePart>>;
};

/** The step, or the end, each core stage is drawn as. */
const PLACE: Record<string, StepId | "proposal" | "merged"> = {
  build: "build",
  fix: "build",
  merged: "merged",
  plan: "plan",
  proposal: "proposal",
  "pull-request": "review",
  questions: "discovery",
  spec: "spec",
};

/** What the map reads of a feature, beside its history. */
export type StagesFeature = FilesFeature & {
  kind: string;
  step: {
    file?: string | null;
    fileKind?: string | null;
    name: string;
    progress?: TaskProgress | null;
    waitsOn: string;
  };
};

/** The state of the stage at `index` of `history`. */
function stateAt(history: StagesHistory, index: number): StageState {
  return index < history.current ? "done" : index === history.current ? "current" : "todo";
}

/** Each stage's part, by the place the map draws it. */
function parts(feature: StagesFeature, history: StagesHistory) {
  const names = history.stages.map((stage) => stage.name);
  const files = filesByStage(feature, names);
  const placed = new Map<string, StagePart>();
  history.stages.forEach((stage, index) => {
    const line = stageLine(history, index);
    const state = stateAt(history, index);
    const isBuilding = PLACE[stage.name] === "build" && state === "current";
    placed.set(PLACE[stage.name] ?? stage.name, {
      files: files.get(stage.name) ?? [],
      state,
      ...(line === undefined ? {} : { line }),
      ...(isBuilding && feature.step.progress ? { tasks: feature.step.progress } : {}),
    });
  });
  return placed;
}

/** Whether the plan waits for the human's review: its review file exists, or it waits now. */
function hasPlanReview(feature: StagesFeature): boolean {
  return (
    feature.step.fileKind === "plan" ||
    feature.files.some((file) => file.kind === "review" && file.name.startsWith("plan"))
  );
}

/** The gates of a feature: after its questions, its spec, its plan when reviewed, its review. */
function gatesOf(feature: StagesFeature, steps: FeatureStages["steps"]) {
  const waits = feature.step.waitsOn === "human";
  const at = (kind: string) => (waits && feature.step.fileKind === kind ? "waiting" : "gate");
  const atReview = waits && steps.review?.state === "current" ? "waiting" : "gate";
  if (feature.kind === "change") {
    return { [STEPS.indexOf("build")]: at("clarifications") } as FeatureStages["gates"];
  }
  return {
    [STEPS.indexOf("plan")]: at("spec"),
    [STEPS.indexOf("spec")]: at("clarifications"),
    ...(hasPlanReview(feature) ? { [STEPS.indexOf("build")]: at("plan") } : {}),
    [STEPS.indexOf("comments")]: atReview,
  } as FeatureStages["gates"];
}

/** The feature's history on its map, from its stages and its files. */
export function featureStages(feature: StagesFeature, history: StagesHistory): FeatureStages {
  const placed = parts(feature, history);
  const todo: StagePart = { files: [], state: "todo" };
  const isChange = feature.kind === "change";
  const merged = placed.get("merged") ?? todo;
  const isFinished = merged.state !== "todo";
  const steps: FeatureStages["steps"] = {};
  for (const id of STEPS) {
    const part = placed.get(id);
    if (part) {
      steps[id] = part;
    }
  }
  // Changes asked on the pull request: the review is done, the comments at work.
  const review = steps.review;
  if (feature.step.name === "pull-request-changes" && review) {
    steps.review = { ...review, state: "done" };
    steps.comments = { files: [], state: "current" };
  } else if (!isChange) {
    steps.comments = { files: [], state: isFinished ? "done" : "todo" };
  }
  const shown: ReadonlyArray<StepId> = isChange
    ? STEPS.filter((id) => id !== "spec" && id !== "plan" && id !== "comments").filter(
        (id) => id !== "discovery" || placed.has("discovery"),
      )
    : STEPS;
  const waitsOnReview = feature.step.waitsOn === "human" && steps.review?.state === "current";
  return {
    ends: { merged, proposal: placed.get("proposal") ?? todo },
    ...(isChange ? { endGate: waitsOnReview ? ("waiting" as const) : ("gate" as const) } : {}),
    gates: gatesOf(feature, steps),
    isChange,
    isFinished,
    shown,
    steps,
  };
}

/** Whether a step's run options can still change: it has not started, and the feature is open. */
export function isOpen(stages: FeatureStages | undefined, step: StepId): boolean {
  if (stages === undefined) {
    return true;
  }
  return !stages.isFinished && (stages.steps[step]?.state ?? "todo") === "todo";
}
