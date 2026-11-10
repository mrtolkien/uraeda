import { randomUUID } from "node:crypto";
import { accountFor } from "./account-pick.ts";
import type { UsageReport } from "./account-usage.ts";
import type { Adapter, OpenOptions } from "./adapter.ts";
import type { SessionRow } from "./cache.ts";
import { hasStartedTurn } from "./cache-turns.ts";
import type { AgentEvent, TokenCounts, UsageWindow } from "./events.ts";
import { sessionRuntime } from "./runtimes.ts";
import {
  type Live,
  type Proc,
  REFUSALS,
  refused,
  REPLACED,
  rowOf,
  type SessionContext,
  TERMINATE_AFTER_MS,
} from "./session-state.ts";

/** A turn failed by its process's exit keeps this many lines of its stderr. */
const STDERR_LINES = 20;

/** A new agent session's baseline: none of its tokens counted yet. */
const NO_TOKENS: TokenCounts = { cacheRead: 0, cacheWrite: 0, input: 0, output: 0 };

type Exit = Extract<AgentEvent, { type: "exit" }>;

/**
 * The sessions' processes: at most one per session, across servers, opened in the session's
 * directory, read to their exit, and closed with a bounded wait.
 */
export class Processes {
  #context: SessionContext;
  /**
   * Each runtime's windows' reports of the processes running on no account, by the runtime's name
   * and the window's ID, in report order, each with when it came: the newest open process's report
   * wins, even when usage decreased. A report without a window keeps that window's last report. A
   * runtime's windows keep the order they first came in. A process's reports go as it closes.
   */
  #limits = new Map<string, Map<Proc, { at: number; window: UsageWindow }>>();
  /**
   * The latest report of each window of each account, by the runtime's name, the account, and the
   * window's ID: kept after its process closed, and once expired, until an ask newer than it makes
   * it moot. `accountUsage` decides which of it and the ask counts.
   */
  #accounted = new Map<string, UsageReport>();
  #expiry: ReturnType<typeof setTimeout> | undefined;
  /** Each process's agent session total so far, which its next report's own work is counted from. */
  #baselines = new WeakMap<Proc, TokenCounts>();

  constructor(context: SessionContext) {
    this.#context = context;
  }

  /**
   * The runtime's windows, each the freshest unexpired report of it from an open process running
   * on no account, across repositories: the account of a process is in `reports`.
   */
  usage(runtime: string): Array<UsageWindow> {
    const now = Date.now();
    return [...this.#limits].flatMap(([key, reports]) => {
      const fresh = key.startsWith(`${runtime}\0`)
        ? [...reports]
            .filter(
              ([proc, { window }]) => proc.account === null && Date.parse(window.resetsAt) > now,
            )
            .at(-1)
        : undefined;
      return fresh ? [fresh[1].window] : [];
    });
  }

  /**
   * The latest report of each window of each account of the runtime, with when it came, from
   * processes open or closed, expired or not: `accountUsage` merges them with the asks, and
   * normalizes the expired. A report that is not newer than its account's ask, or of an account no
   * longer listed, is moot, and dropped here.
   */
  reports(runtime: string): Array<UsageReport> {
    const listed = this.#context.runtimes.get(runtime)?.accounts?.list() ?? [];
    const prefix = `${runtime}\0`;
    const kept: Array<UsageReport> = [];
    for (const [key, report] of this.#accounted) {
      if (!key.startsWith(prefix)) {
        continue;
      }
      const account = listed.find(({ id }) => id === report.account);
      if (account === undefined || report.at <= (account.askedAt ?? -Infinity)) {
        this.#accounted.delete(key);
      } else {
        kept.push(report);
      }
    }
    return kept;
  }

  /** Drops the process's reports of every window: whether it had any. */
  #dropLimits(proc: Proc): boolean {
    return [...this.#limits.values()].map((reports) => reports.delete(proc)).includes(true);
  }

  /**
   * Keeps a report's windows as the newest: a process of an account's, as the account's latest
   * report of the window; any other's, as its own, each in report order.
   */
  #report(proc: Proc, event: Extract<AgentEvent, { type: "usage" }>) {
    const at = Date.now();
    for (const window of event.windows) {
      if (proc.account !== null) {
        this.#accounted.set(`${proc.kind}\0${proc.account}\0${window.id}`, {
          account: proc.account,
          at,
          window,
        });
        continue;
      }
      const key = `${proc.kind}\0${window.id}`;
      const reports = this.#limits.get(key) ?? new Map<Proc, { at: number; window: UsageWindow }>();
      this.#limits.set(key, reports);
      reports.delete(proc);
      reports.set(proc, { at, window });
    }
    this.#usageChanged();
  }

  /**
   * Drops the expired reports of no account, and publishes expiry even when no process prints
   * another event. An account's reports stay, expired: their expiry is read in the merge.
   */
  #usageChanged() {
    clearTimeout(this.#expiry);
    const now = Date.now();
    const resets: Array<number> = [];
    for (const reports of this.#limits.values()) {
      for (const [proc, { window }] of reports) {
        const reset = Date.parse(window.resetsAt);
        if (reset <= now) {
          reports.delete(proc);
        } else {
          resets.push(reset);
        }
      }
    }
    const next = Math.min(...resets);
    this.#expiry = Number.isFinite(next)
      ? setTimeout(() => this.#usageChanged(), Math.min(next - Date.now(), 2_147_483_647))
      : undefined;
    this.#expiry?.unref();
    this.#context.agentChanged();
  }

  /**
   * The session's open process, opened when it has none, or when it is closing: then once it
   * exited. A transcript that is gone starts a new agent session: `line` says so, in the session
   * that ran before. `allowed` reopens the process with the rules. The directory is the session's
   * folder as it is now: a session moved to a change opens in the change's worktree. It runs on the
   * session's model and effort: an effort changed since the process opened is given to it, or, for
   * a runtime that cannot change it, reopens it (R3). Called as a turn starts, never during one.
   */
  async open(
    live: Live,
    { allowed }: { allowed?: ReadonlyArray<string> } = {},
  ): Promise<{ line?: string; proc: Proc }> {
    const { binding, cache, runtimes } = this.#context;
    // A turn taken back while the process opened left its line to the next one.
    const held = live.proc?.line;
    if (live.proc && !live.proc.closing && allowed === undefined && this.#effortSet(live)) {
      delete live.proc.line;
      return { proc: live.proc, ...(held === undefined ? {} : { line: held }) };
    }
    if (live.proc) {
      this.close(live.proc);
      await live.proc.done;
    }
    // Another server may share the cache: one process per session, across servers.
    if (!cache.claimSession(live.id)) {
      throw refused(REFUSALS.working);
    }
    let token: string | undefined;
    try {
      const row = rowOf(cache, live);
      // A sub-session works in its task's worktree.
      const cwd =
        row.worktree ??
        (live.folder === null ? live.repo : await binding.workDir(live.repo, live.folder));
      // The session's own runtime, never another: one unregistered or turned off since leaves it
      // read-only.
      const adapter = sessionRuntime(runtimes, row);
      const ran = hasStartedTurn(cache.db, live.id);
      // A session picks its account until a turn of it starts, and keeps the account from then on,
      // listed or not: one that ran with none ran before accounts, or with none listed, and stays
      // on the server's own login. A first turn that never started, taken back or failed to open,
      // fixed nothing: the pick is made again, on the usage of that moment.
      const account = ran ? row.account : await this.#pick(row, adapter);
      const resume = adapter.hasSession(row.nativeId, account ?? undefined);
      // A session that ran before has lost its transcript: Claude Code deletes old ones. A line
      // held from a replacement the process opened on is carried, resuming that new session.
      const replaced = !resume && ran;
      const line = replaced ? REPLACED : held;
      const nativeId = replaced ? randomUUID() : row.nativeId;
      if (replaced) {
        cache.updateSession(live.id, { nativeId });
      }
      const tools = this.#tools(row);
      token = typeof tools === "object" ? tools.token : undefined;
      const agent = adapter.open({
        cwd,
        nativeId,
        resume,
        ...(account === null ? {} : { account }),
        skills: runtimes.skills(live.repo),
        ...(tools === undefined ? {} : { tools }),
        ...(allowed === undefined ? {} : { allowed }),
        ...(row.model === null ? {} : { model: row.model }),
        ...(row.effort === null ? {} : { effort: row.effort }),
      });
      const proc: Proc = {
        account,
        adopts: !resume,
        agent,
        background: new Map(),
        closing: false,
        cwd,
        done: Promise.resolve(),
        effort: row.effort,
        kind: row.agent,
        runtime: adapter,
        terminate: [],
        ...(token === undefined ? {} : { token }),
      };
      live.proc = proc;
      // A resumed agent session reports its earlier turns' tokens again.
      this.#baselines.set(proc, resume ? cache.agentSessionTokens(live.id) : NO_TOKENS);
      proc.done = this.#consume(live, proc);
      return { proc, ...(line === undefined ? {} : { line }) };
    } catch (error) {
      if (token !== undefined) {
        this.#context.mcp?.tokens.revoke(token);
      }
      cache.releaseSession(live.id);
      throw error;
    }
  }

  /**
   * The account a session with no started turn opens on, stored before its process opens: the pick
   * of its runtime's listed accounts. When the runtime lists none, none: a last pick stored while
   * it did, which no turn ever started on, is cleared, and the session runs on the agent's own
   * login (R3).
   */
  async #pick(row: SessionRow, adapter: Adapter): Promise<string | null> {
    if (!adapter.accounts?.list().length) {
      if (row.account !== null) {
        this.#context.cache.updateSession(row.id, { account: null });
      }
      return null;
    }
    const account = await accountFor(
      adapter.accounts,
      adapter.name,
      () => this.reports(row.agent),
      () => this.#context.refreshAccounts(row.agent),
    );
    this.#context.cache.updateSession(row.id, { account });
    return account;
  }

  /**
   * Uraeda's tools for the session's new process: a workflow session's, of a change or a feature,
   * gets the MCP endpoint with a token of its own, which revokes its earlier process's; a
   * sub-session gets `"none"`, neither its agent's own sub-agents nor Uraeda's; a chat keeps its
   * agent's own. None while the server gives no tools.
   */
  #tools(row: SessionRow): OpenOptions["tools"] {
    const { mcp } = this.#context;
    if (row.parent !== null) {
      return "none";
    }
    if (row.folder === null || mcp === undefined) {
      return undefined;
    }
    return { token: mcp.tokens.issue(row.id), url: `${mcp.address.url}/mcp` };
  }

  /**
   * Whether the session's open process runs on its effort: one changed since is given to it, when
   * its runtime can change it. Else it is to be reopened.
   */
  #effortSet(live: Live): boolean {
    const proc = live.proc!;
    const { effort } = rowOf(this.#context.cache, live);
    if (effort === proc.effort) {
      return true;
    }
    if (!proc.agent.setEffort) {
      return false;
    }
    proc.agent.setEffort(effort ?? undefined);
    proc.effort = effort;
    return true;
  }

  /** Starts the process's new agent session, after `/clear`: its next total counts whole. */
  cleared(proc: Proc) {
    if (this.#baselines.has(proc)) {
      this.#baselines.set(proc, NO_TOKENS);
    }
  }

  /**
   * Adds the work of the process's agent session since its last report to the turn running on it.
   * Without one, the next report counts it.
   */
  tokens(live: Live, proc: Proc, total: TokenCounts) {
    const turn = live.turn?.id;
    const baseline = this.#baselines.get(proc);
    if (turn === undefined || baseline === undefined) {
      return;
    }
    // An agent session's total never decreases: a lower one is a new agent session's, should its
    // `init` have been missed.
    const started = (Object.keys(total) as Array<keyof TokenCounts>).some(
      (field) => total[field] < baseline[field],
    );
    const own = (field: keyof TokenCounts) => total[field] - (started ? 0 : baseline[field]);
    this.#context.cache.addTurnTokens(turn, {
      cacheRead: own("cacheRead"),
      cacheWrite: own("cacheWrite"),
      input: own("input"),
      output: own("output"),
    });
    this.#baselines.set(proc, total);
  }

  /**
   * Closes the process once its turn is over: it exits, and is reopened by the next message. One
   * that is still running 10 seconds later gets SIGTERM, and SIGKILL 10 seconds after that, so that
   * no send, nor the server's stop, waits on it forever.
   */
  close(proc: Proc) {
    if (!proc.closing) {
      proc.closing = true;
      if (this.#dropLimits(proc)) {
        this.#usageChanged();
      }
      proc.agent.close();
      proc.terminate.push(
        setTimeout(() => proc.agent.kill("SIGTERM"), TERMINATE_AFTER_MS),
        setTimeout(() => proc.agent.kill("SIGKILL"), 2 * TERMINATE_AFTER_MS),
      );
    }
  }

  /** Reads the process's events into the cache, until it exits. */
  async #consume(live: Live, proc: Proc): Promise<void> {
    for await (const event of proc.agent.events) {
      try {
        if (event.type === "exit") {
          this.#exited(live, proc, event);
          return;
        }
        if (event.type === "usage") {
          if (!proc.closing) {
            this.#report(proc, event);
          }
          continue;
        }
        this.#context.transcript.record(live, proc, event);
      } catch (error) {
        // A cache write that fails does not stop the session.
        process.stderr.write(
          `The session manager could not record an event of ${live.id}: ${String(error)}\n`,
        );
      }
    }
    this.#exited(live, proc, { code: null, stderr: "", type: "exit" });
  }

  /** The process exited: its turn ends, and the queued turns start on a new one. */
  #exited(live: Live, proc: Proc, exit: Exit) {
    const { cache, turns } = this.#context;
    const adapter = proc.runtime;
    if (this.#dropLimits(proc)) {
      this.#usageChanged();
    }
    proc.terminate.forEach(clearTimeout);
    if (proc.token !== undefined) {
      this.#context.mcp?.tokens.revoke(proc.token);
    }
    if (live.proc !== proc) {
      return;
    }
    live.proc = undefined;
    clearTimeout(live.idle);
    cache.releaseSession(live.id);
    const turn = live.turn;
    if (turn) {
      const stderr = exit.stderr.trimEnd().split("\n").slice(-STDERR_LINES).join("\n");
      const end =
        turn.stop ??
        (exit.missing
          ? { reason: REFUSALS.unavailable(adapter.name), state: "failed" as const }
          : {
              reason: stderr || `${adapter.name} exited with code ${exit.code}.`,
              state: "failed" as const,
            });
      turns.end(live, turn.id, end);
    }
    this.#context.changed(live);
    turns.next(live);
    this.#context.live.prune(live);
  }
}
