// The messages kept while a feature's start or commits were queued, sent once they landed: each one
// is sent, or comes back to its composer. The first send refused stops them, as the next ones
// followed it; its text and theirs go in an `unsent` write of the queue, which the composer of the
// feature's session takes back, and the sessions made only for them go while they have no turn.
import type { SendInput } from "../runner/send-input.ts";
import type { RepoContext } from "./context.ts";
import { reasonOf } from "../reason.ts";

/** A message kept: the session it goes to, and whether that session was made for it. */
export type Kept = { input: SendInput; made: boolean; session: string };

/**
 * Sends `kept` in order, each taken before it is sent: a run that starts fresh goes to a new
 * session, which the next messages to the same session follow. A refusal returns the rest.
 */
export async function sendKept(ctx: RepoContext, folder: string, kept: Array<Kept>): Promise<void> {
  const followed = new Map<string, string>();
  // A message kept while these go joins them, in order.
  for (let next = kept.shift(); next !== undefined; next = kept.shift()) {
    const to = followed.get(next.session) ?? next.session;
    try {
      followed.set(next.session, (await ctx.sessions.send(ctx.repo, to, next.input)).session);
    } catch (error) {
      returnUnsent(ctx, folder, [next, ...kept.splice(0)], reasonOf(error));
      return;
    }
  }
}

/**
 * Gives `unsent` back to the composer of `folder`'s session, in an `unsent` write of the queue,
 * and removes the sessions made only for them while they have no turn.
 */
export function returnUnsent(
  ctx: RepoContext,
  folder: string,
  unsent: Array<Kept>,
  reason: string,
): void {
  const queue = ctx.hosts.byPath(ctx.repo)?.queue;
  const text = unsent.map(({ input }) => input.text).join("\n\n");
  queue?.unsent({ folder, href: "", label: `Your message to ${folder}` }, text, reason);
  if (!queue) {
    process.stderr.write(`uraeda: a message to ${folder} was not sent: ${reason}\n`);
  }
  removeMade(ctx, unsent);
}

/** Removes the sessions made for `kept`, while they have no turn. */
export function removeMade(ctx: RepoContext, kept: Array<Kept>): void {
  for (const { made, session } of kept) {
    if (made) {
      ctx.sessions.cache.removeEmptySession(session);
    }
  }
}
