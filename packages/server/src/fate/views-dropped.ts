// The data view of a drop's result: read once, from its mutation.
import { dataView } from "@nkzw/fate/server";

/**
 * A change or a feature dropped, by its folder: its branch, which stays, the worktree left with
 * why, and whether its entry's removal from **Now** was committed.
 */
export type DroppedRecord = {
  branch: string;
  committed: boolean;
  id: string;
  worktreeLeft: string | null;
};

export const droppedDataView = dataView<DroppedRecord>("Dropped")({
  branch: true,
  committed: true,
  id: true,
  worktreeLeft: true,
});
