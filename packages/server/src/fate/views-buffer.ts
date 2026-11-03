// The data view of a buffer: any Markdown file under `specs/`, whole, with the branch it is written
// on, and its source. Its ID is its path from the top level. And the data view of the Commit page's
// panes, which a buffer's saves add to: one record, every branch's pane with changes, the default
// branch's first, each with what its commit holds and its suggested message.
import { dataView } from "@nkzw/fate/server";
import type { BranchPane, BufferView } from "uraeda-binding";
import { type Context, inRepository } from "./context.ts";
import { fileSource } from "./source.ts";
import type { Record_ } from "./views.ts";

export type BufferRecord = Record_<BufferView> & { id: string };

/** A buffer as it is sent, by its path. */
export const sentBuffer = (view: BufferView): BufferRecord => ({ ...view, id: view.path });

export const bufferDataView = dataView<BufferRecord>("Buffer")({
  branch: true,
  hash: true,
  id: true,
  path: true,
  text: true,
});

/** The buffers by path, leaving out the paths that are no Markdown file of `specs/`. */
export const bufferSource = fileSource<Context, BufferRecord>(bufferDataView, {
  byIds: async (ctx, ids) => {
    const { binding, repo } = inRepository(ctx);
    const read = await Promise.allSettled(ids.map((id) => binding.readBuffer(repo, id)));
    return read.flatMap((result) =>
      result.status === "fulfilled" ? [sentBuffer(result.value)] : [],
    );
  },
});

/** The id of the one `CommitPanes` record. */
export const COMMIT_PANES_ID = "commit";

/** A pane as it is sent: its folder null on the default branch. */
export type CommitPane = Omit<BranchPane, "folder"> & { folder: string | null };

export type CommitPanesRecord = { id: string; panes: Array<CommitPane> };

/** The panes as they are sent. */
export const sentPanes = (panes: Array<BranchPane>): CommitPanesRecord => ({
  id: COMMIT_PANES_ID,
  panes: panes.map((pane) => ({ ...pane, folder: pane.folder ?? null })),
});

export const commitPanesDataView = dataView<CommitPanesRecord>("CommitPanes")({
  id: true,
  panes: true,
});

export const commitPanesSource = fileSource<Context, CommitPanesRecord>(commitPanesDataView, {
  byIds: async (ctx, ids) => {
    if (!ids.includes(COMMIT_PANES_ID)) {
      return [];
    }
    const { binding, repo } = inRepository(ctx);
    return [sentPanes(await binding.commitPanes(repo))];
  },
});
