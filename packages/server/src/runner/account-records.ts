import { pickAccount, PICK_WAIT_MS, USAGE_MAX_AGE_MS } from "./account-pick.ts";
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

/** What a refresh may change: the records, and the problems an extension's accounts give. */
function shown(records: Array<AccountRecord>, accounts: Accounts): string {
  let problems: ReadonlyArray<string> = [];
  try {
    problems = accounts.problems();
  } catch {
    // An extension's accounts that fail to say have no problem to show.
  }
  return JSON.stringify([records, problems]);
}

/**
 * Asks the usage of each runtime's accounts that is stale, as the pages and the pick do, and tells
 * what an answer changed: the agent's record, and the `onAccounts` listeners of the runtimes, which
 * the Extensions host is one of. A refresh that asked nothing changes nothing, so a page that reads
 * the agent's record on each announce does not loop. A runtime's ask in flight is shared, so that an
 * answer is announced once, however many read meanwhile; one that has not settled within
 * `PICK_WAIT_MS` stops blocking its runtime, and still announces its answer if it comes.
 */
export class AccountRefresh {
  #asking = new Map<Accounts, Promise<void>>();
  /** Fires at the earliest reset of an account's window, which the records then read as open. */
  #reset: ReturnType<typeof setTimeout> | undefined;
  readonly #announce: () => void;
  readonly #records: (runtime: string) => Array<AccountRecord>;
  readonly #runtimes: Runtimes;

  constructor(
    runtimes: Runtimes,
    records: (runtime: string) => Array<AccountRecord>,
    announce: () => void,
  ) {
    this.#runtimes = runtimes;
    this.#records = records;
    this.#announce = announce;
  }

  /** Announces the agent's record, and arms the next reset of an account's window. */
  announce(): void {
    this.#announce();
    this.arm();
  }

  /**
   * Arms the one timer at the earliest future reset among the accounts' windows, which announces
   * the records when it fires, and arms the next. Called at each announce and each read, so that a
   * change of the windows moves it. The records read a window past its reset as open, whatever
   * announced it.
   */
  arm(): void {
    clearTimeout(this.#reset);
    const now = Date.now();
    const next = Math.min(
      ...this.#runtimes
        .names()
        .flatMap((name) => this.#records(name))
        .flatMap(({ windows }) => windows.map(({ resetsAt }) => Date.parse(resetsAt ?? "")))
        .filter((reset) => reset > now),
    );
    this.#reset = Number.isFinite(next)
      ? setTimeout(() => this.announce(), Math.min(next - now, 2_147_483_647))
      : undefined;
    this.#reset?.unref();
  }

  /** Stops the timer, as the server stops. */
  close(): void {
    clearTimeout(this.#reset);
  }

  /** Asks each runtime's accounts that are stale: see `refresh`. */
  run(): void {
    this.arm();
    this.#runtimes.names().forEach((name) => void this.refresh(name));
  }

  /**
   * Asks the usage of the runtime's accounts when it is stale, and announces what the answer changed.
   * The ask in flight is shared. Settles when the accounts answered, or after `PICK_WAIT_MS`.
   */
  refresh(name: string): Promise<void> {
    const accounts = this.#runtimes.get(name)?.accounts;
    if (accounts === undefined) {
      return Promise.resolve();
    }
    const asking = this.#asking.get(accounts);
    if (asking !== undefined) {
      return asking;
    }
    const before = shown(this.#records(name), accounts);
    const answered = ask(accounts).then(() => {
      if (shown(this.#records(name), accounts) !== before) {
        this.announce();
        this.#runtimes.accountsChanged();
      }
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<void>((resolve) => {
      timer = setTimeout(resolve, PICK_WAIT_MS);
    });
    timer?.unref();
    const settled = Promise.race([answered, late]).finally(() => {
      clearTimeout(timer);
      if (this.#asking.get(accounts) === settled) {
        this.#asking.delete(accounts);
      }
    });
    this.#asking.set(accounts, settled);
    return settled;
  }
}
