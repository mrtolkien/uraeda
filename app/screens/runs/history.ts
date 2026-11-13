// What a feature already ran, put on the run map's steps: where each step stands, from the stages
// its history reads in its commits, and which of its sessions ran each step, from their workflow
// turns, in the order they ran. A step that started is locked: its runs keep what they ran on, and
// a change of the map applies to the steps ahead (spec of Run options).
import type { HistoryView, Turn } from "../../store/protocol";
import { type Place, STEPS, type StepId } from "./options";

/** The step of the map each stage of a feature's history is: a change's fix is its build. */
const STAGE_STEPS: Readonly<Record<string, StepId>> = {
  build: "build",
  fix: "build",
  plan: "plan",
  "pull-request": "review",
  questions: "discovery",
  spec: "spec",
};

/** The step of the map a workflow turn ran, by the core's step when it started. */
const TURN_STEPS: Readonly<Record<string, StepId>> = {
  approval: "spec",
  "catch-up": "comments",
  change: "build",
  discovery: "discovery",
  "final-review": "review",
  finish: "review",
  implementation: "build",
  plan: "plan",
  "plan-revision": "plan",
  "pull-request-changes": "comments",
  push: "comments",
  spec: "spec",
  "spec-revision": "spec",
};

/** The map's step a workflow turn's step is, if any. */
export const stepOfTurn = (step: string | null): StepId | undefined =>
  step === null ? undefined : TURN_STEPS[step];

/** Where a step stands: passed, at work, or ahead. */
export type StepState = "done" | "current" | "todo";

/** Each step's state, from the feature's history and its step now. */
export function stepStates(
  history: HistoryView | null | undefined,
  now: string,
): Record<StepId, StepState> {
  const states = Object.fromEntries(STEPS.map((step) => [step, "todo"])) as Record<
    StepId,
    StepState
  >;
  if (history == null) return states;
  const merged = history.current >= history.stages.length;
  history.stages.forEach((stage, index) => {
    const step = STAGE_STEPS[stage.name];
    if (step === undefined) return;
    states[step] =
      merged || index < history.current ? "done" : index === history.current ? "current" : "todo";
  });
  // Changes asked on the pull request: its review passed, and its comments are at work.
  if (now === "pull-request-changes") {
    states.review = "done";
    states.comments = "current";
  } else if (merged) {
    states.comments = "done";
  }
  return states;
}

/** Whether a place of the map is locked: a step that started, or the joint before it. */
export function isLocked(place: Place, states: Record<StepId, StepState>): boolean {
  if (place.kind === "step") return states[place.step] !== "todo";
  if (place.kind === "joint") return states[STEPS[place.index]!] !== "todo";
  return false;
}

/** A session's run of a step: its first turn there, its last turn's end, and its last state. */
export type StepRun = {
  session: string;
  startedAt: number;
  endedAt: number | null;
  state: Turn["state"];
};

/**
 * Which sessions ran which step, from each session's turns, `sessions` in any order: each step's
 * runs in the order they started, one per session that ran it.
 */
export function runsByStep(
  sessions: ReadonlyArray<{ id: string; turns: ReadonlyArray<Turn> }>,
): Partial<Record<StepId, Array<StepRun>>> {
  const out: Partial<Record<StepId, Array<StepRun>>> = {};
  for (const session of sessions) {
    const mine = new Map<StepId, StepRun>();
    for (const turn of session.turns) {
      const step = turn.kind === "workflow" ? stepOfTurn(turn.step) : undefined;
      if (step === undefined || turn.startedAt === null) continue;
      const had = mine.get(step);
      mine.set(step, {
        endedAt: turn.endedAt,
        session: session.id,
        startedAt: Math.min(had?.startedAt ?? turn.startedAt, turn.startedAt),
        state: turn.state,
      });
    }
    for (const [step, run] of mine) (out[step] ??= []).push(run);
  }
  for (const runs of Object.values(out)) runs.sort((a, b) => a.startedAt - b.startedAt);
  return out;
}
