// The data view of Continue all's answer: read once, from its mutation.
import { dataView } from "@nkzw/fate/server";

/** A run Continue all could not continue: its feature's folder, its name, and why. */
export type RefusedRun = { folder: string; name: string; reason: string };

/** Continue all's answer: the runs it could not continue, which stay as they were. */
export type ContinuedAllRecord = { id: string; refused: Array<RefusedRun> };

export const continuedAllDataView = dataView<ContinuedAllRecord>("ContinuedAll")({
  id: true,
  refused: true,
});
