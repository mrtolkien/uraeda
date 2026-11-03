// A buffer's mutation: a Markdown file under `specs/` saved as typed on its branch, never committed,
// refused while an agent works on the feature it belongs to. It is apart from `views-buffer.ts`,
// which the sources this mutation masks its answer with import.
import type { Resolver } from "./context.ts";
import { refusable } from "./errors.ts";
import { writable } from "./sessions.ts";
import { sources } from "./sources.ts";
import { bufferDataView, sentBuffer } from "./views-buffer.ts";

/** The mutations of a buffer. */
export const bufferMutations = {
  "buffer.save": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ hash: string; path: string; text: string }>) => {
      // The core names the feature a file is written for: a finished one's record included.
      const folder = await refusable(() => ctx.binding.bufferFolder(ctx.repo, input.path));
      if (folder !== null) {
        await writable(ctx, { folder });
      }
      await refusable(() => ctx.binding.saveBuffer(ctx.repo, input.path, input.text, input.hash));
      const read = await refusable(() => ctx.binding.readBuffer(ctx.repo, input.path));
      return sources.masked(bufferDataView, ctx, sentBuffer(read), select);
    },
    type: "Buffer",
  },
};
