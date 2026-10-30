// The workspace's features as home sorts them, by their status, the server's, as the sidebar does.
import {
  byStart,
  byStatus,
  type Feature,
  inFlight,
  needsYou,
  type Row,
  startOf,
} from "../sidebar/cards.ts";

/**
 * The features in flight as home sorts them: those whose status needs the human, the most urgent
 * first; the others, in progress, the oldest started first; and those with problems that stop the
 * workflow, which neither of the others lists. `rows` are the sessions', which date their starts.
 */
export function homeFeatures(features: Array<Feature>, rows: Array<Row>) {
  const flying = features
    .filter((feature) => inFlight(feature) && feature.problems.length === 0)
    .map((feature) => ({ feature, start: startOf(feature, rows), status: feature.status }));
  return {
    agents: byStart(flying.filter((item) => !needsYou(item.status))).map((item) => item.feature),
    human: byStatus(flying.filter((item) => needsYou(item.status))).map((item) => item.feature),
    invalid: withProblems(features),
  };
}

/** The features with problems that stop the workflow, not done: home's Problems. */
export function withProblems<F extends { problems: Array<unknown>; step: { name: string } }>(
  features: Array<F>,
) {
  return features.filter((f) => f.problems.length && f.step.name !== "done");
}
