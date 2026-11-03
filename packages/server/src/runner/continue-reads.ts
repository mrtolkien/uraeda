// What the continuer's decisions read: when a limit's continue goes, from the cache's other waits,
// and the commit the feature's worktree has checked out, which sets the count back.
import { resolve } from "node:path";
import type { FeatureView } from "uraeda-binding";
import type { Binding } from "../fate/context.ts";
import type { SessionCache, SessionRow } from "./cache.ts";
import type { Limit } from "./events.ts";

export const MINUTE_MS = 60_000;
/** A limit without a reset time is tried again this long after, each try counting toward the cap. */
export const RETRY_WITHOUT_RESET_MS = 60 * MINUTE_MS;

/**
 * When a limit's continue goes: a minute after its reset, an hour from now without one, never
 * sooner than a minute from now. The runs waiting for one reset go a minute apart: it steps a
 * minute at a time while another limit's continue waits in that minute, so a later wait, as one
 * without a reset, never delays it.
 */
export function limitContinueAt(cache: SessionCache, limit: Limit): number {
  const now = Date.now();
  const reset = limit.resetsAt === undefined ? Number.NaN : Date.parse(limit.resetsAt);
  const at = Math.max(
    Number.isNaN(reset) ? now + RETRY_WITHOUT_RESET_MS : reset + MINUTE_MS,
    now + MINUTE_MS,
  );
  let time = at;
  while (cache.limitContinueWithin(time, time + MINUTE_MS)) {
    time += MINUTE_MS;
  }
  return time;
}

/**
 * The commit the feature's worktree has checked out, for its count: none for a chat, nor for a
 * feature without a worktree. Read only: the worktree is never created here, nor the repository
 * locked.
 */
export async function worktreeCommit(
  binding: Binding,
  session: SessionRow,
  read?: FeatureView,
): Promise<string | undefined> {
  if (session.folder === null) {
    return undefined;
  }
  try {
    const feature = read ?? (await binding.readFeature(session.repo, session.folder));
    if (feature.worktree === undefined) {
      return undefined;
    }
    return (await binding.checkoutCommit(resolve(session.repo, feature.worktree))) ?? undefined;
  } catch {
    return undefined;
  }
}
