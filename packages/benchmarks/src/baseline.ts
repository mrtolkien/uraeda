import { basename, dirname } from "node:path";
import type { Case } from "./case.ts";
import { type ListedRun, listRuns } from "./recorder.ts";

/**
 * The case's plain run to compare flow runs with: one on the same task and image digest, from a
 * suite that is not a screening, whose run was picked for failing.
 */
export function baselineFor(root: string, found: Case): ListedRun | undefined {
  return listRuns(root).find(
    (run) =>
      basename(run.folder).includes("--plain--") &&
      !basename(dirname(run.folder)).endsWith("-screening") &&
      run.record.task.id === found.task &&
      run.record.task.image === found.image,
  );
}
