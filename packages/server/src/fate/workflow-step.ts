// The step a feature's workflow message reads, and the messages read, which a change of the feature
// sends again: its step moves when its queued commits land, not only when its branch changes.
import type { NextView } from "uraeda-binding";
import type { RepoContext } from "./context.ts";
import { featureKeys } from "./write-queue.ts";

/** The ids of the workflow messages read, by repository and folder. */
const read = new Map<string, Set<string>>();

const keyOf = (repo: string, folder: string) => `${repo}\0${folder}`;

/** Remembers that the workflow message `id` of `folder` was read, to send it again as it changes. */
export function readMessage(repo: string, folder: string, id: string): void {
  const key = keyOf(repo, folder);
  const ids = read.get(key) ?? new Set();
  read.set(key, ids.add(id));
}

/** The ids of the workflow messages of `folder` read so far. */
export function readMessages(repo: string, folder: string): Array<string> {
  return [...(read.get(keyOf(repo, folder)) ?? [])];
}

/**
 * The step the workflow message of `folder` reads: while its commits are still queued, the step
 * they will give, which the core expects from its files on disk; otherwise the branch's,
 * read from its latest commit. Undefined when the core reads none.
 */
export function messageStep(ctx: RepoContext, folder: string): Promise<NextView | undefined> {
  const queue = ctx.hosts.byPath(ctx.repo)?.queue;
  const step =
    queue?.waits(featureKeys(folder)) === true
      ? ctx.binding.expectedStep(ctx.repo, folder)
      : ctx.binding.nextStep(ctx.repo, folder);
  return step.catch(() => undefined);
}
