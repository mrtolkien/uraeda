// A buffer's mutation: a Markdown file under `specs/` saved as typed on its branch, never committed,
// refused while an agent works on the feature it belongs to. It is apart from `views-buffer.ts`,
// which the sources this mutation masks its answer with import.
import type { RepoContext, Resolver } from "./context.ts";
import { refusable } from "./errors.ts";
import { writable } from "./sessions.ts";
import { sources } from "./sources.ts";
import { INBOX_ID, PRIORITIES_ID } from "./views.ts";
import { bufferDataView, sentBuffer } from "./views-buffer.ts";
import { GIT_ID } from "./views-git.ts";

let sent = 0;

/**
 * Sends the records a save adds a change to: the Git page and its sidebar count, and the count of
 * changes the priorities and the inbox carry. The core's watcher sends them for the lists and the
 * features only, not for a decision or the constitution saved on the default branch.
 */
function publishSaved(ctx: RepoContext) {
  const live = ctx.hosts.byPath(ctx.repo)?.live;
  const records = [
    ["GitPage", GIT_ID],
    ["GitSummary", GIT_ID],
    ["Priorities", PRIORITIES_ID],
    ["Inbox", INBOX_ID],
  ] as const;
  for (const [type, id] of records) {
    live?.update(type, id, { eventId: `saved:${type}:${Date.now()}:${sent++}` });
  }
}

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
      publishSaved(ctx);
      const read = await refusable(() => ctx.binding.readBuffer(ctx.repo, input.path));
      return sources.masked(bufferDataView, ctx, sentBuffer(read), select);
    },
    type: "Buffer",
  },
};
