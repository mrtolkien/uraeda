// The data view of a buffer: any Markdown file under `specs/`, whole, with the branch it is written
// on, and its source. Its ID is its path from the top level.
import { dataView } from "@nkzw/fate/server";
import type { BufferView } from "uraeda-binding";
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
