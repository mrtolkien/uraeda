import { listed, pickWithRoom, refreshedWithin } from "./account-pick.ts";
import { accountUsage } from "./account-usage.ts";
import type { SessionRow } from "./cache.ts";
import { limitContinueAt } from "./continue-reads.ts";
import type { ContinueReason, Limit } from "./events.ts";
import type { SessionContext } from "./session-state.ts";

type MoveContext = Pick<SessionContext, "cache" | "processes" | "refreshAccounts" | "runtimes">;

/** The name of the session's account, for the line of its move: none on no account. */
export function accountName(
  { runtimes }: Pick<SessionContext, "runtimes">,
  row: SessionRow,
): string | undefined {
  return row.account === null ? undefined : runtimes.get(row.agent)?.accounts?.nameOf(row.account);
}

/**
 * The continue of a turn of `session` a limit refused, decided through `decide`, with its reason
 * and its time: at once when the session moved to another account, whatever the limit; else after
 * the reset of a session's limit. None, undefined, for another limit of a session that runs on no
 * account. The move is made whether or not the run continues by itself: the human's next message
 * then runs on an account with room.
 */
export function limitContinue(
  context: MoveContext,
  session: string,
  limit: Limit,
  decide: (reason: ContinueReason, at: () => number) => Promise<void>,
): Promise<void> | undefined {
  const { cache, runtimes } = context;
  const row = cache.session(session);
  const onAccount =
    row !== undefined && row.account !== null && runtimes.get(row.agent)?.accounts !== undefined;
  if (limit.kind !== "session" && !onAccount) {
    return undefined;
  }
  return (async () => {
    const moved = await moveAccount(context, session).catch((error: unknown) => {
      process.stderr.write(`The move of session ${session} failed: ${String(error)}\n`);
      return undefined;
    });
    if (moved !== undefined) {
      await decide("account", Date.now);
    } else if (limit.kind === "session") {
      await decide("limit", () => limitContinueAt(cache, limit));
    }
  })();
}

/**
 * Moves a session a limit refused to another account of its runtime's, and returns it: the pick of
 * the listed accounts with room that hold the session's transcript, on usage asked again when
 * stale, within the pick's wait. None, and the session stays, when it runs on no account, when no
 * other account has room, or when none holds its transcript: there, it would start over. Its next
 * process opens on the new account, and resumes the conversation (see `Processes.open`).
 */
export async function moveAccount(
  context: MoveContext,
  session: string,
): Promise<string | undefined> {
  const { cache, processes, runtimes } = context;
  const row = cache.session(session);
  const adapter = row && runtimes.get(row.agent);
  const accounts = adapter?.accounts;
  if (!row || !adapter || accounts === undefined || row.account === null) {
    return undefined;
  }
  if (listed(accounts).every((account) => account.id === row.account)) {
    return undefined;
  }
  await refreshedWithin(() => context.refreshAccounts(row.agent));
  // The session may have been removed or moved while the usage was asked.
  const now = cache.session(session);
  if (!now || now.account !== row.account) {
    return undefined;
  }
  const picked = pickWithRoom(
    accountUsage(listed(accounts), processes.reports(row.agent), Date.now()).filter(
      (account) => account.id !== now.account && adapter.hasSession(now.nativeId, account.id),
    ),
  );
  if (!picked) {
    return undefined;
  }
  cache.updateSession(session, { account: picked.id });
  return picked.id;
}
