// What a started run's card in a job's history draws: the change it started, else its session, as
// the sidebar reads them. Decided before the card's element is made, since an element is never
// empty: the history says its own line for a run that has none.
import type { JobRunView } from "uraeda-server/fate";
import type { Feature, Row } from "../sidebar/cards.ts";

/** What the card draws: the run's change with its session's row, or a session's row alone. */
export type RunCardTarget =
  | { feature: Feature; row: Row | undefined }
  | { feature: undefined; row: Row };

/**
 * The change of the run when the workspace lists it, else its session when the sidebar's list has
 * it, else nothing: the session is gone, or its change was finished into its record.
 */
export function runCardOf(
  run: JobRunView,
  rows: ReadonlyArray<Row>,
  features: ReadonlyArray<Feature>,
): RunCardTarget | undefined {
  const row = run.session === null ? undefined : rows.find((one) => one.id === run.session);
  const feature =
    run.folder === null ? undefined : features.find((one) => one.folder === run.folder);
  if (feature !== undefined) {
    return { feature, row };
  }
  return row === undefined ? undefined : { feature: undefined, row };
}
