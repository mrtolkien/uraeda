// The Commit page's record: every branch's pane with changes, kept up to date by the server's live
// updates, and read again with the counts after a write (`rereadChanges`).
import { useLiveView, useRequest } from "react-fate";
import { COMMIT_PANES_ID, useRefreshOnShow } from "../data.ts";
import { CommitPanesView } from "../views.ts";

/** The Commit page's panes, a branch's each with what its commit holds and its message. */
export function useCommitPanes() {
  const request = { commitPanes: { id: COMMIT_PANES_ID, view: CommitPanesView } };
  const { commitPanes } = useRequest(request);
  useRefreshOnShow(request);
  return useLiveView(CommitPanesView, commitPanes);
}
