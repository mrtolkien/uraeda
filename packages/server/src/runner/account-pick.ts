import type { Account } from "./adapter.ts";

/** How old an account's usage may be, before it is asked again. */
export const USAGE_MAX_AGE_MS = 60_000;

/** How long a pick waits for the answers of the usage it asks. */
export const PICK_WAIT_MS = 10_000;

/** An account's share used of its first, shortest window: an account with no window is unused. */
const shortUsed = (account: Account) => account.windows[0]?.used ?? 0;

/** When its first window resets, as epoch ms: never for a window not open, so it sorts last. */
const shortReset = (account: Account) => {
  const resetsAt = account.windows[0]?.resetsAt;
  return resetsAt ? Date.parse(resetsAt) : Infinity;
};

/** Signed in, and no window after the first used up: Claude's week. */
const eligible = (account: Account) =>
  account.state === "ready" && account.windows.slice(1).every((window) => window.used < 1);

/**
 * The account a new session starts on: among the signed-in accounts whose longer windows are not
 * used up, the one with the most of its first window left; on a tie, the one whose first window
 * resets first; then the first one listed. An account whose usage was never read comes after every
 * other. When every signed-in account is used up, the first signed-in one listed; with none signed
 * in, none.
 */
export function pickAccount(accounts: ReadonlyArray<Account>): Account | undefined {
  const ranked = accounts
    .map((account, index) => ({ account, index }))
    .filter(({ account }) => eligible(account))
    .toSorted(
      (a, b) =>
        Number(a.account.askedAt === null) - Number(b.account.askedAt === null) ||
        shortUsed(a.account) - shortUsed(b.account) ||
        shortReset(a.account) - shortReset(b.account) ||
        a.index - b.index,
    );
  return ranked[0]?.account ?? accounts.find((account) => account.state === "ready");
}
