// The checkout guard: the Git page's writes wait while an agent works in their checkout, a chat's
// in the main checkout, a feature's in its worktree, as a feature's writes do (`writable`).
import type { RepoContext } from "./context.ts";
import { callSiteError } from "./errors.ts";
import { writable } from "./sessions.ts";

/** Why the main checkout's writes are refused while a chat's agent works in it. */
export const CHAT_WORKS = "An agent works in this checkout: wait for its turn to end.";

/**
 * Whether a chat's agent works in the main checkout: a session without a feature has a turn
 * running, starting, or queued. None in a folder the core gives no main checkout for.
 */
export async function chatWorks(ctx: RepoContext): Promise<boolean> {
  try {
    await ctx.sessions.mainRoot(ctx.repo);
  } catch {
    return false;
  }
  return ctx.sessions.chatWorking(ctx.repo);
}

/**
 * Refuses a write of the Git page to the checkout of `folder`, the main checkout's for null, while
 * an agent works in it, before the write is queued.
 */
export async function checkoutWritable(ctx: RepoContext, folder: string | null): Promise<void> {
  if (folder !== null) {
    return writable(ctx, { folder });
  }
  if (await chatWorks(ctx)) {
    throw callSiteError(`refused: ${CHAT_WORKS}`);
  }
}
