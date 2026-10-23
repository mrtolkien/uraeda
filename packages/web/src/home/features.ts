// The workspace's features as home sorts them.
import type { Feature } from "../sidebar/cards.ts";

/** What home reads of a feature to sort it. */
type Sorted = { problems: Array<unknown>; step: Pick<Feature["step"], "name" | "waitsOn"> };

/**
 * The features as home sorts them: waiting on the human, on an agent, and with problems that stop
 * the workflow, which neither of the others lists.
 */
export function homeFeatures<F extends Sorted>(features: Array<F>) {
  return {
    agents: features.filter(
      (f) => f.step.waitsOn === "agent" && f.step.name !== "none" && !f.problems.length,
    ),
    human: features.filter((f) => f.step.waitsOn === "human" && !f.problems.length),
    invalid: features.filter((f) => f.problems.length && f.step.name !== "done"),
  };
}
