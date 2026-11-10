import { pickAccount, USAGE_MAX_AGE_MS } from "./account-pick.ts";
import type { Accounts } from "./adapter.ts";
import { accountUsage, type UsageReport } from "./account-usage.ts";
import type { Runtimes, AccountRecord } from "./runtimes.ts";

/**
 * The runtime's accounts for the UI, with the freshest usage of each, `isNext` on the one a new
 * session would start on now. None for a runtime with no accounts.
 */
export function accountRecords(
  runtimes: Runtimes,
  runtime: string,
  reports: ReadonlyArray<UsageReport>,
  now = Date.now(),
): Array<AccountRecord> {
  const merged = accountUsage(runtimes.get(runtime)?.accounts?.list() ?? [], reports, now);
  const next = pickAccount(merged)?.id;
  return merged.map(({ id, name, state, windows }) => ({
    id,
    isNext: id === next,
    name,
    state,
    windows: [...windows],
  }));
}

/** The accounts' stale usage asked, whatever fails: an extension's may throw at once, or reject. */
async function ask(accounts: Accounts): Promise<void> {
  try {
    await accounts.refresh(USAGE_MAX_AGE_MS);
  } catch {
    // The accounts stay as they were.
  }
}

/**
 * Asks the usage of each runtime's accounts that is stale, and tells `changed` when an answer
 * changed what the UI shows of them. A refresh that asked nothing changes nothing, so a page that
 * reads the agent's record on each announce does not loop. A runtime's ask in flight is not asked
 * again, so that an answer is announced once, however many pages read meanwhile.
 */
export class AccountRefresh {
  /** The accounts being asked: a runtime reloaded has new ones, asked at once. */
  #asking = new Set<Accounts>();
  readonly #changed: () => void;
  readonly #records: (runtime: string) => Array<AccountRecord>;
  readonly #runtimes: Runtimes;

  constructor(
    runtimes: Runtimes,
    records: (runtime: string) => Array<AccountRecord>,
    changed: () => void,
  ) {
    this.#runtimes = runtimes;
    this.#records = records;
    this.#changed = changed;
  }

  run(): void {
    for (const name of this.#runtimes.names()) {
      const accounts = this.#runtimes.get(name)?.accounts;
      if (accounts === undefined || this.#asking.has(accounts)) {
        continue;
      }
      this.#asking.add(accounts);
      const before = JSON.stringify(this.#records(name));
      void ask(accounts).then(() => {
        this.#asking.delete(accounts);
        if (JSON.stringify(this.#records(name)) !== before) {
          this.#changed();
        }
      });
    }
  }
}
