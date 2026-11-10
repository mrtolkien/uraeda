import type { Account, AccountWindow } from "./adapter.ts";
import type { UsageWindow } from "./events.ts";

/** A running process's latest report of one window, with its account and when it came. */
export type UsageReport = { account: string | null; at: number; window: UsageWindow };

/** A window as last read, and when: an ask's window counts from its account's `askedAt`. */
type Read = { ask: boolean; at: number; window: AccountWindow };

/** A window whose reset is at or before `now` is open again, and reads as unused. */
function unexpired(window: AccountWindow, now: number): AccountWindow {
  return window.resetsAt !== null && Date.parse(window.resetsAt) <= now
    ? { ...window, resetsAt: null, used: 0 }
    : window;
}

/**
 * The accounts with the freshest usage of each window: an ask's, or a report's of an open process
 * running on the account. An ask that came at the very time of a report wins. An account keeps its
 * windows in the order of its ask, the five hours first, then the week; a window the ask never
 * gave comes after, in the order of the reports. A window whose reset has passed reads as unused,
 * never as its last share used. `askedAt` is the freshest of the ask's time and its reports', so
 * that an account whose usage is known from a report ranks as known; none of its reports leaves
 * the account as it was, but for its expired windows.
 */
export function accountUsage(
  accounts: ReadonlyArray<Account>,
  reports: ReadonlyArray<UsageReport>,
  now: number,
): Array<Account> {
  return accounts.map((account) => {
    const own = reports
      .filter((report) => report.account === account.id)
      .toSorted((a, b) => a.at - b.at);
    const reads = new Map<string, Read>(
      account.windows.map((window) => [
        window.id,
        { ask: true, at: account.askedAt ?? -Infinity, window },
      ]),
    );
    for (const { at, window } of own) {
      const read = reads.get(window.id);
      if (read === undefined || !read.ask || at > read.at) {
        reads.set(window.id, { ask: false, at, window });
      }
    }
    return {
      ...account,
      askedAt:
        own.length === 0 ? account.askedAt : Math.max(account.askedAt ?? -Infinity, own.at(-1)!.at),
      known: account.known || own.length > 0,
      windows: [...reads.values()].map((read) => unexpired(read.window, now)),
    };
  });
}
