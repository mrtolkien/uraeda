/**
 * The commit page's mutations: a pane's Commit, with the message the human typed, and its Discard.
 * The default branch's pane commits behind the lists' other commits; a feature's, on its branch,
 * behind its feature's, and is refused while its agent works, as a write of its files is.
 */
import type { RepoContext, Resolver } from "./context.ts";
import { refusable } from "./errors.ts";
import { priorities } from "./masked.ts";
import { writable } from "./sessions.ts";
import { featureKeys, LISTS, type Queued, queued } from "./write-queue.ts";

/** A pane of the commit page: its branch, the default branch's for the lists' pane. */
type PaneInput = { branch: string };

/**
 * The folder of the feature or change on `branch`, null on the default branch, refused while an
 * agent works on it.
 */
async function paneFolder(ctx: RepoContext, branch: string): Promise<string | null> {
  const panes = await refusable(() => ctx.binding.commitPanes(ctx.repo));
  const folder = panes.find((pane) => pane.branch === branch)?.folder ?? null;
  if (folder !== null) {
    await writable(ctx, { folder });
  }
  return folder;
}

export const commitMutations = {
  "changes.commit": {
    resolve: async ({ ctx, input, select }: Resolver<Queued<PaneInput & { message: string }>>) => {
      const { branch, message } = input;
      const folder = await paneFolder(ctx, branch);
      const keys = folder === null ? [LISTS] : featureKeys(folder);
      await queued(ctx, keys, input.write, folder === null ? {} : { folder }, () =>
        ctx.binding.commitBranch(ctx.repo, branch, message),
      );
      return priorities(ctx, await ctx.binding.readPriorities(ctx.repo), select);
    },
    type: "Priorities",
  },
  "changes.discard": {
    resolve: async ({ ctx, input, select }: Resolver<PaneInput>) => {
      const { branch } = input;
      await paneFolder(ctx, branch);
      await refusable(() => ctx.binding.discardBranch(ctx.repo, branch));
      return priorities(ctx, await ctx.binding.readPriorities(ctx.repo), select);
    },
    type: "Priorities",
  },
};
