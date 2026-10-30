// The write queue in fate: the record `WriteQueue`, a repository's git writes still landing or
// refused, read by every tab, and `queued`, which runs a committing mutation's core call through
// its repository's queue.
import { dataView } from "@nkzw/fate/server";
import type { NewWrite, QueuedWrite, WriteInput } from "../writes/queue.ts";
import { type Context, inRepository, type RepoContext } from "./context.ts";
import { refusable } from "./errors.ts";
import { fileSource } from "./source.ts";

/** The id of each repository's one `WriteQueue` record. */
export const WRITE_QUEUE_ID = "write-queue";

/** A committing mutation's input: `write` names it in the write queue, from the web UI. */
export type Queued<Input> = Input & { write?: WriteInput };

export type WriteQueueRecord = { id: string; writes: Array<QueuedWrite> };

export const writeQueueDataView = dataView<WriteQueueRecord>("WriteQueue")({
  id: true,
  writes: true,
});

/** The record of the repository's queue: empty when no host serves it. */
export function writeQueue(ctx: RepoContext): WriteQueueRecord {
  return { id: WRITE_QUEUE_ID, writes: ctx.hosts.byPath(ctx.repo)?.queue.writes() ?? [] };
}

export const writeQueueSource = fileSource<Context, WriteQueueRecord>(writeQueueDataView, {
  byIds: async (ctx, ids) => (ids.includes(WRITE_QUEUE_ID) ? [writeQueue(inRepository(ctx))] : []),
});

/**
 * Runs `call`, a committing binding call, through the repository's write queue, its refusals as
 * `refusable` turns them: in its turn, after the queued commits of `keys`, the commits it defers
 * queued behind it, named by `write`, or by their subjects, `at` naming the feature and file it
 * concerns. It answers once the files are written; `onQueued` is given whether its commits all
 * land.
 */
export async function queued<T>(
  ctx: RepoContext,
  keys: Array<string>,
  write: WriteInput | undefined,
  at: Omit<NewWrite, keyof WriteInput>,
  call: () => Promise<T>,
  onQueued?: (landed: Promise<boolean>) => void,
): Promise<T> {
  const queue = ctx.hosts.byPath(ctx.repo)?.queue;
  const refused = () => refusable(call);
  if (queue) {
    return queue.commit(keys, { ...at, ...write }, refused, onQueued);
  }
  // Without a host, nothing defers the commit: the call commits within it.
  const answer = await refused();
  onQueued?.(Promise.resolve(true));
  return answer;
}

/**
 * Runs `call`, a core call that commits within it, as a write of the repository's queue, after the
 * writes queued before it, in the committing calls' turn, the calls of `keys` waiting for it: its
 * commit never runs while another lands. It answers once it landed; a refusal is the call's, and
 * leaves the record. Without a host, at once.
 */
export async function landed<T>(
  ctx: RepoContext,
  keys: Array<string>,
  write: NewWrite,
  call: () => Promise<T>,
): Promise<T> {
  const queue = ctx.hosts.byPath(ctx.repo)?.queue;
  if (!queue) {
    return refusable(call);
  }
  const added = queue.add(write, () => queue.inTurn(call), keys);
  try {
    return (await refusable(() => added.landed)) as T;
  } catch (error) {
    queue.dismiss(added.id);
    throw error;
  }
}

/** Runs a committing call of the default branch's lists through the write queue, as `queued`. */
export const listCommit = <T>(
  ctx: RepoContext,
  write: WriteInput | undefined,
  call: () => Promise<T>,
) => queued(ctx, [LISTS], write, {}, call);

/** The start of a feature's key. */
const FEATURE = "feature:";

/** The keys of a feature's files, whose commits wait for each other. */
export const featureKeys = (folder: string) => [`${FEATURE}${folder}`];

/** The folders of the features whose files `keys` name. */
export const keyFolders = (keys: Array<string>) =>
  keys.flatMap((key) => (key.startsWith(FEATURE) ? [key.slice(FEATURE.length)] : []));

/**
 * The key of the default branch's lists, the inbox, the priorities, their rounds, and the
 * proposal files: their commits take each other's files along.
 */
export const LISTS = "lists";
