// The messages sent to a feature while its commits are still in the write queue: kept in memory,
// sent once they land, in order, exactly once, and dropped if one is refused, their text kept in the
// refused write for the composer. The agent never starts on a file written but not committed yet.
import { ofDropped } from "../runner/session-state.ts";
import { REFUSALS } from "../runner/sessions.ts";
import { checkSend, type SendInput } from "../runner/send-input.ts";
import type { WriteQueue } from "../writes/queue.ts";
import type { RepoContext } from "./context.ts";
import { reasonOf } from "./errors.ts";
import { featureKeys } from "./write-queue.ts";

/** A message kept: the session it goes to, and whether that session was made for it. */
type Kept = { input: SendInput; made: boolean; session: string };

/** The messages kept, by queue and folder, in the order they were sent. */
const waiting = new WeakMap<WriteQueue, Map<string, Array<Kept>>>();

/** Where a message goes: a session, or a feature, in its latest session or a new one. */
type To = { folder?: string; newSession?: boolean; session?: string };

/** The session a message kept for `folder` goes to, and whether it was made for it. */
async function sessionFor(
  ctx: RepoContext,
  folder: string,
  to: To,
): Promise<{ made: boolean; session: string }> {
  if (to.session !== undefined) {
    // A dropped change's or feature's session takes no message, as sending refuses it.
    const row = ctx.sessions.cache.session(to.session);
    if (row && ofDropped(row)) {
      throw new Error(`refused: ${REFUSALS.dropped}`);
    }
    return { made: false, session: to.session };
  }
  if (to.newSession === true) {
    return { made: true, session: (await ctx.sessions.newSession(ctx.repo, folder)).id };
  }
  const root = await ctx.sessions.mainRoot(ctx.repo);
  const made = ctx.sessions.cache.folderSessions(root, folder).length === 0;
  return { made, session: (await ctx.sessions.featureSession(ctx.repo, folder)).id };
}

/**
 * Keeps a message sent to a feature, or to one of its sessions, while the feature's commits are
 * still queued, checked as sending it would be: the session it goes to once they land, or undefined
 * when none of its commits is queued, and it goes at once.
 */
export async function keptForCommits(
  ctx: RepoContext,
  to: To,
  input: SendInput,
): Promise<string | undefined> {
  const queue = ctx.hosts.byPath(ctx.repo)?.queue;
  if (!queue) {
    return undefined;
  }
  const root = await ctx.sessions.mainRoot(ctx.repo);
  const { adapter, cache } = ctx.sessions;
  const row = to.session === undefined ? undefined : cache.session(to.session);
  const folder = to.session === undefined ? to.folder : row?.repo === root ? row.folder : null;
  const folders = waiting.get(queue) ?? new Map<string, Array<Kept>>();
  waiting.set(queue, folders);
  if (!folder || (!folders.has(folder) && !queue.waits(featureKeys(folder)))) {
    return undefined;
  }
  // A feature moving, or dropped, takes no message, as sending refuses it.
  if (ctx.sessions.moving(root, folder)) {
    throw new Error(`refused: ${REFUSALS.agentWorking}`);
  }
  if (!ctx.sessions.status().available) {
    throw new Error(`refused: ${REFUSALS.unavailable(adapter.name)}`);
  }
  checkSend(input, adapter.capabilities);
  const { made, session } = await sessionFor(ctx, folder, to);
  const kept = folders.get(folder);
  if (kept) {
    kept.push({ input, made, session });
  } else {
    folders.set(folder, [{ input, made, session }]);
    void sendOnceLanded(ctx, queue, folder, folders);
  }
  return session;
}

/**
 * Waits for the queued commits of `folder`, those queued meanwhile too, then sends its kept
 * messages in order, each taken before it is sent: a run that starts fresh goes to a new session,
 * which the next messages to the same session follow. A refused commit drops them, its write
 * keeping their text, and the sessions made for them go while they have no turn.
 */
async function sendOnceLanded(
  ctx: RepoContext,
  queue: WriteQueue,
  folder: string,
  folders: Map<string, Array<Kept>>,
): Promise<void> {
  const keys = featureKeys(folder);
  let refused: string | undefined;
  while (refused === undefined && queue.waits(keys)) {
    refused = await queue.settled(keys);
  }
  const kept = folders.get(folder) ?? [];
  if (refused !== undefined) {
    folders.delete(folder);
    queue.update(refused, { queued: kept.map(({ input }) => input.text).join("\n\n") });
    for (const each of kept) {
      if (each.made) {
        ctx.sessions.cache.removeEmptySession(each.session);
      }
    }
    return;
  }
  const followed = new Map<string, string>();
  try {
    // A message sent while these go joins them, in order.
    for (let next = kept.shift(); next !== undefined; next = kept.shift()) {
      const to = followed.get(next.session) ?? next.session;
      followed.set(next.session, (await ctx.sessions.send(ctx.repo, to, next.input)).session);
    }
  } catch (error) {
    process.stderr.write(
      `uraeda: ${folder}'s commits landed, but a message was not sent: ${reasonOf(error)}\n`,
    );
  } finally {
    folders.delete(folder);
  }
}
