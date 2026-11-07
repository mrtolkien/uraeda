// The data view of an undo's answer: read once, from `undo.apply` or `undo.committed`.
import { dataView } from "@nkzw/fate/server";
import type { ChangedFileView } from "uraeda-binding";

/**
 * The change an undoable write recorded, as its answer carries it beside its record, `change`:
 * what `undo.apply` takes to undo or redo it. Null on every other answer and read.
 */
export type ChangeRecord = {
  commit: string | null;
  files: Array<{ [Key in keyof ChangedFileView]: ChangedFileView[Key] }>;
};

/**
 * An undo's or a redo's answer: `commit`, the checkout's `HEAD` once `undo.apply` wrote the change
 * back, and `committed`, whether a commit touched the change's files since, from `undo.committed`.
 * Each mutation sets its own field, the other null.
 */
export type UndoRecord = { commit: string | null; committed: boolean | null; id: string };

export const undoDataView = dataView<UndoRecord>("Undo")({
  commit: true,
  committed: true,
  id: true,
});
