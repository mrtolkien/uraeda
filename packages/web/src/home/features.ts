// The workspace's features as home sorts them, and the state of a feature an agent works on.
import type { useWorkspace } from "../data.ts";
import { stepLabel } from "../labels.ts";

/** The workspace's features, as home reads them. */
export type Feature = NonNullable<ReturnType<typeof useWorkspace>>["features"][number];

/**
 * A feature an agent works on: whether its agent runs now, its step's label, and the line under
 * its title, the step and the task while it runs, the task alone otherwise.
 */
export function agentState(feature: Feature, running: Array<string>) {
  const working = running.includes(feature.folder);
  const step = stepLabel(feature.step.name);
  const line = working ? [step, feature.step.task].filter(Boolean).join(" · ") : feature.step.task;
  return { line, step, working };
}

/**
 * The features as home sorts them: waiting on the human, on an agent, with problems in their files,
 * and merged, latest first.
 */
export function homeFeatures<
  F extends {
    folder: string;
    problems: Array<unknown>;
    step: Pick<Feature["step"], "name" | "waitsOn">;
  },
>(features: Array<F>) {
  return {
    agents: features.filter(
      (f) => f.step.waitsOn === "agent" && f.step.name !== "none" && !f.problems.length,
    ),
    // Latest first: a folder's name starts with its date.
    done: features
      .filter((f) => f.step.name === "done")
      .sort((a, b) => b.folder.localeCompare(a.folder)),
    human: features.filter((f) => f.step.waitsOn === "human" && !f.problems.length),
    invalid: features.filter((f) => f.problems.length && f.step.name !== "done"),
  };
}
