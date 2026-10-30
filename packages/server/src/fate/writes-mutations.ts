// The write queue's own mutation: a refused write taken out of the record. It is apart from
// `write-queue.ts`, which the sources the mutation masks its answer with import (R42).
import type { Resolver } from "./context.ts";
import { sources } from "./sources.ts";
import { writeQueue, writeQueueDataView } from "./write-queue.ts";

/** The mutations of the write queue's record. */
export const writesMutations = {
  "writes.dismiss": {
    resolve: async ({ ctx, input, select }: Resolver<{ id: string }>) => {
      ctx.hosts.byPath(ctx.repo)?.queue.dismiss(input.id);
      return sources.masked(writeQueueDataView, ctx, writeQueue(ctx), select);
    },
    type: "WriteQueue",
  },
};
