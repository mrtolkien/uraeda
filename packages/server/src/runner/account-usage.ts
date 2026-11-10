import type { Account, AccountWindow } from "./adapter.ts";
import type { UsageWindow } from "./events.ts";

/** A running process's latest report of one window, with its account and when it came. */
export type UsageReport = { account: string | null; at: number; window: UsageWindow };

/** A window whose reset is at or before `now` is open again, and reads as unused. */
function unexpired(window: AccountWindow, now: number): AccountWindow {
  return window.resetsAt !== null && Date.parse(window.resetsAt) <= now
    ? { ...window, resetsAt: null, used: 0 }
    : window;
}

/**
 * The accounts with the freshest usage of each window the ask gave: the ask's, which counts from
 * its account's `askedAt` even after a failed ask, or the latest report of an open or closed
 * process that ran on the account, at its `at`. An ask that came at the very time of a report wins.
 * A report only updates a window the ask gave: it never adds one, so the first window is always the
 * shortest, and an account whose ask never read windows stays as it is, unknown, its reports set
 * aside. The account is `known` when its ask's usage is, or when a report of its first window is
 * fresher than its windows. A window whose reset has passed reads as unused, never as its last
 * share used: the expiry is applied here, so that an expired report still counts as read.
 */
export function accountUsage(
  accounts: ReadonlyArray<Account>,
  reports: ReadonlyArray<UsageReport>,
  now: number,
): Array<Account> {
  return accounts.map((account) => {
    const read = account.askedAt ?? -Infinity;
    const newer = reports
      .filter((report) => report.account === account.id && report.at > read)
      .toSorted((a, b) => a.at - b.at);
    const windows = account.windows.map((window) =>
      unexpired(newer.findLast((report) => report.window.id === window.id)?.window ?? window, now),
    );
    const first = account.windows[0]?.id;
    return {
      ...account,
      known: account.known || newer.some((report) => report.window.id === first),
      windows,
    };
  });
}
