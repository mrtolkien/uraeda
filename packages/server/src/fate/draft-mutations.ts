// The New page's proposal, drafted in one request: its line in the priorities, its file, and the
// text typed under its heading, in place of the browser's read, insert, expand, read, and save.
import type { Resolver } from "./context.ts";
import { refusable } from "./errors.ts";
import { proposalFile } from "./masked.ts";

export const draftMutations = {
  "proposals.draft": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ body: string; section: string; title: string }>) =>
      proposalFile(
        ctx,
        await refusable(() =>
          ctx.binding.draftProposal(ctx.repo, input.section, input.title, input.body),
        ),
        select,
      ),
    type: "ProposalFile",
  },
};
