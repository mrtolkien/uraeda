// The undo of every undoable write: each write's binding call records its change under a token,
// handed over once the write lands, and `undo.apply` writes it back, or forward for a redo.
import { randomUUID } from "node:crypto";
import type { ChangeView } from "uraeda-binding";
import type { Context, Resolver } from "./context.ts";
import { refusable } from "./errors.ts";
import { writable } from "./sessions.ts";
import { sources } from "./sources.ts";
import { undoDataView } from "./views-undo.ts";

/** The id of an undo's answer, read once, from its mutation. */
const UNDO_ID = "undo";

/**
 * Runs an undoable binding call under a new token, and takes the change it recorded there: null
 * when it recorded none. A failed or refused write throws, recording nothing.
 */
export async function undoable<T>(
  ctx: Pick<Context, "binding">,
  call: (token: string) => Promise<T>,
): Promise<{ answer: T; change: ChangeView | null }> {
  const token = randomUUID();
  const answer = await call(token);
  return { answer, change: ctx.binding.takeChange(token) };
}

/** The mutations of the undo: a change written back or forward, and whether it was committed. */
export const undoMutations = {
  // A refusal, as a file changed since, is answered as the other refused writes are: its message
  // after `conflict: ` is the text the UI shows. A file of a feature whose agent works is refused
  // before any is written, as the feature's own writes are.
  "undo.apply": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ change: ChangeView; direction: "redo" | "undo"; subject: string }>) => {
      for (const file of input.change.files) {
        await writable(ctx, { path: file.path });
      }
      const commit = await refusable(() =>
        ctx.binding.applyChange(ctx.repo, input.change, input.direction, input.subject),
      );
      const record = { commit, committed: null, id: UNDO_ID };
      return sources.masked(undoDataView, ctx, record, select);
    },
    type: "Undo",
  },
  "undo.committed": {
    resolve: async ({ ctx, input, select }: Resolver<{ change: ChangeView }>) => {
      const committed = await refusable(() => ctx.binding.committedSince(ctx.repo, input.change));
      const record = { commit: null, committed, id: UNDO_ID };
      return sources.masked(undoDataView, ctx, record, select);
    },
    type: "Undo",
  },
};
