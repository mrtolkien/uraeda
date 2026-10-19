import { basename, dirname } from "node:path";
import type { Case } from "./case.ts";
import { type ListedRun, listRuns } from "./recorder.ts";
import type { Suite } from "./suite.ts";

/** Whether a run is a plain run that can serve as a baseline: finished, outside a screening. */
export const isBaseline = (run: ListedRun) =>
  basename(run.folder).includes("--plain--") &&
  !basename(dirname(run.folder)).endsWith("-screening") &&
  run.record.outcome === "finished";

/**
 * The case's plain run to compare flow runs with: a finished one on the same task and image digest,
 * with the model and effort the suite asks for, from a suite that is not a screening, whose run was
 * picked for failing.
 */
export function baselineFor(
  root: string,
  found: Case,
  suite: Pick<Suite, "effort" | "model">,
): ListedRun | undefined {
  return listRuns(root).find(
    (run) =>
      isBaseline(run) &&
      run.record.task.id === found.task &&
      run.record.task.image === found.image &&
      run.record.models.asked === suite.model &&
      run.record.effort === suite.effort,
  );
}
