import { RUNTIME_REFUSALS } from "../limits.ts";
import { accountUsage, type UsageReport } from "./account-usage.ts";
import type { Account, Accounts } from "./adapter.ts";
import { refused } from "./session-state.ts";

/** How old an account's usage may be, before it is asked again. */
export const USAGE_MAX_AGE_MS = 60_000;

/** How long a pick waits for the answers of the usage it asks. */
export const PICK_WAIT_MS = 10_000;

/** A number that is no number, or none, counts as Infinity: it sorts last. */
const orLast = (value: number | undefined) =>
  value === undefined || Number.isNaN(value) ? Infinity : value;

/** Orders two numbers, never by a NaN: Infinity equals Infinity, so the order stays whole. */
const compare = (a: number, b: number) => (a === b ? 0 : a < b ? -1 : 1);

/** An account's share used of its first, shortest window: an account with no window is unused. */
const shortUsed = (account: Account) =>
  account.windows[0] === undefined ? 0 : orLast(account.windows[0].used);

/** When its first window resets, as epoch ms: never for a window not open, so it sorts last. */
const shortReset = (account: Account) => {
  const resetsAt = account.windows[0]?.resetsAt;
  return orLast(resetsAt ? Date.parse(resetsAt) : undefined);
};

/** Signed in, and no window after the first used up: Claude's week. */
const eligible = (account: Account) =>
  account.state === "ready" && account.windows.slice(1).every((window) => window.used < 1);

/**
 * The account a new session starts on: among the signed-in accounts whose longer windows are not
 * used up, the one with the most of its first window left; on a tie, the one whose first window
 * resets first; then the first one listed. An account whose usage is not known, never read or its
 * last ask not readable, comes after every other; a share or a reset that is no number counts as the last. When
 * every signed-in account is used up, the first signed-in one listed; with none signed in, none.
 */
export function pickAccount(accounts: ReadonlyArray<Account>): Account | undefined {
  const ranked = accounts
    .map((account, index) => ({ account, index }))
    .filter(({ account }) => eligible(account))
    .toSorted(
      (a, b) =>
        compare(Number(!a.account.known), Number(!b.account.known)) ||
        compare(shortUsed(a.account), shortUsed(b.account)) ||
        compare(shortReset(a.account), shortReset(b.account)) ||
        a.index - b.index,
    );
  return ranked[0]?.account ?? accounts.find((account) => account.state === "ready");
}

/** The accounts an extension's runtime lists: none when it has none, or when its `list()` throws. */
export function listed(accounts: Pick<Accounts, "list"> | undefined): ReadonlyArray<Account> {
  try {
    return accounts?.list() ?? [];
  } catch {
    return [];
  }
}

/**
 * Waits for `refresh`, however it settles, and at most `ms`, `PICK_WAIT_MS` by default: it never
 * rejects.
 */
export async function refreshedWithin(
  refresh: () => Promise<void>,
  ms: number = PICK_WAIT_MS,
): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const wait = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms);
  });
  try {
    await Promise.race([refresh().catch(() => {}), wait]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * The id of the account a new session starts on: asks the usage that is stale, waits at most
 * `PICK_WAIT_MS` for the answers, then picks on what is known: each account's freshest usage, an
 * ask's or a running process's report (`reports`), a window whose reset has passed unused. The ask
 * is `refresh`, the one the pages' go through, which announces what it changed. Throws the refusal
 * of a runtime with no signed-in account. Never settles later than the wait, even for an ask that
 * never answers.
 */
export async function accountFor(
  accounts: Pick<Accounts, "list">,
  name: string,
  reports: () => ReadonlyArray<UsageReport>,
  refresh: () => Promise<void>,
): Promise<string> {
  await refreshedWithin(refresh);
  const picked = pickAccount(accountUsage(listed(accounts), reports(), Date.now()));
  if (!picked) {
    throw refused(RUNTIME_REFUSALS.noAccount(name));
  }
  return picked.id;
}
