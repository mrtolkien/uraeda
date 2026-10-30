// The step a feature's workflow message reads, and the messages read, which a change of the feature
// sends again: its step moves when its commits are queued, land, or are refused, not only when its
// branch changes.
import type { NextView } from "uraeda-binding";
import type { RepoContext } from "./context.ts";

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
 * The step the workflow message of `folder` reads: the branch's, which the core reads from its
 * latest commit with the commits still queued on top. Undefined when the core reads none.
 */
export function messageStep(ctx: RepoContext, folder: string): Promise<NextView | undefined> {
  return ctx.binding.nextStep(ctx.repo, folder).catch(() => undefined);
}
