// The sub-sessions of a workflow run: every sub-agent of a run is a session Uraeda starts, on the
// agent, model, and effort its role is set to (the run options decision), and `run_agent`, the tool
// a workflow session starts its implementers with, each in its task's worktree.
import { randomUUID } from "node:crypto";
import { realpath } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import type { McpTool } from "../mcp/endpoint.ts";
import { reasonOf } from "../reason.ts";
import type { SessionRow, TurnRow } from "./cache.ts";
import type { Trigger } from "./events.ts";
import { working } from "./live-sessions.ts";
import type { Picked } from "./picks.ts";
import { implementerPick } from "./run-session.ts";
import { messageItem } from "./send-input.ts";
import { stopRun } from "./session-edits.ts";
import { type SessionContext, TAKEN_BACK } from "./session-state.ts";

/** A sub-session's role in its parent's run. */
export type Role = "implementer" | "reviewer";

/** The sub-session to start: its task, or what it reviews, its worktree, its message, its pick. */
export type SubSessionStart = { about: string; cwd: string; message: string; pick: Picked };

/** The input `run_agent` takes: the task, the implementer's prompt, and the task's worktree. */
type RunAgentInput = { prompt: string; task: string; worktree: string };

/**
 * The sessions Uraeda starts for its workflow runs' sub-agents. A sub-session is a session of its
 * parent's feature, with its `parent` and `role`, titled by its task: it never becomes its feature's
 * latest session, works beside its feature's other sessions, and stops with its parent.
 */
export class SubSessions {
  #context: SessionContext;
  /** How many tool calls of each parent wait for their sub-session, by the parent. */
  #calls = new Map<string, number>();

  constructor(context: SessionContext) {
    this.#context = context;
  }

  /** The sub-sessions the session's runs started, the first started first. */
  ofParent(parent: string): Array<SessionRow> {
    return this.#context.cache.subSessionsOf(parent);
  }

  /**
   * Starts a sub-session of `parent`'s feature, as `role`, titled `about`, working in `cwd`, on
   * `pick`, sends it `message` as a workflow turn of its parent's step, and resolves with its last
   * message once the turn ends. A turn that does not end done rejects, with why. A second start of
   * the same parent, role, and `about` starts no session: it resolves with the first one's answer,
   * waiting while it works, after a restart too; once that one stopped or failed without a continue
   * to wait for, it sends `message` as a new turn of the same sub-session. `signal` gives the wait
   * up, the sub-session left working.
   */
  start(parent: string, role: Role, start: SubSessionStart, signal?: AbortSignal): Promise<string> {
    return this.#counted(parent, () => this.#start(parent, role, start, signal));
  }

  async #start(
    parent: string,
    role: Role,
    { about, cwd, message, pick }: SubSessionStart,
    signal?: AbortSignal,
  ): Promise<string> {
    const { cache } = this.#context;
    // One transaction: two starts of the same task make one session.
    const row = cache.atomically(() => {
      const found = this.#find(parent, role, about);
      if (found) {
        return found;
      }
      const from = cache.session(parent);
      if (!from || from.folder === null) {
        throw new Error(`no session ${parent} of a feature`);
      }
      return cache.createSession({
        ...pick,
        folder: from.folder,
        nativeId: randomUUID(),
        parent,
        repo: from.repo,
        role,
        title: about,
        worktree: cwd,
      });
    });
    return this.#run(row, message, signal);
  }

  /** The sub-session of `parent` as `role` for `about`, when a start made it. */
  #find(parent: string, role: Role, about: string): SessionRow | undefined {
    return this.ofParent(parent).find((one) => one.role === role && one.title === about);
  }

  /** Starts a turn of the sub-session when it runs again, and answers once it no longer works. */
  async #run(row: SessionRow, message: string, signal?: AbortSignal): Promise<string> {
    await this.#begin(row, message);
    await this.#idle(row.id, signal);
    return this.#answer(row);
  }

  /**
   * Whether `parent` waits for its sub-sessions: one of its calls waits for its answer, or one
   * works or waits to continue. Its turn's watchdog waits meanwhile.
   */
  busy(parent: string): boolean {
    return (this.#calls.get(parent) ?? 0) > 0 || subSessionsWork(this.#context, parent);
  }

  /** Runs `call`, a tool call of `parent`, counted while it waits. */
  async #counted<T>(parent: string, call: () => Promise<T>): Promise<T> {
    this.#calls.set(parent, (this.#calls.get(parent) ?? 0) + 1);
    try {
      return await call();
    } finally {
      const left = (this.#calls.get(parent) ?? 1) - 1;
      if (left === 0) {
        this.#calls.delete(parent);
      } else {
        this.#calls.set(parent, left);
      }
    }
  }

  /** Stops the parent's sub-sessions that work or wait to continue: their calls answer an error. */
  stopAll(parent: string): void {
    for (const row of this.ofParent(parent)) {
      stopRun(this.#context, this.#context.live.of(row));
    }
  }

  /**
   * Runs `run_agent` for the workflow session `parent`: an implementer of the task in its worktree,
   * on the feature's implementers' pick. A worktree that is not one of the repository's, or is its
   * main checkout, or a change's or a feature's, is refused. A task asked again goes to its
   * sub-session, before the worktree and the pick are read.
   */
  runAgent(parent: string, input: unknown, signal?: AbortSignal): Promise<string> {
    return this.#counted(parent, () => this.#runAgent(parent, input, signal));
  }

  async #runAgent(parent: string, input: unknown, signal?: AbortSignal): Promise<string> {
    const { prompt, task, worktree } = runAgentInput(input);
    const row = this.#context.cache.session(parent);
    if (!row || row.folder === null || row.parent !== null) {
      throw new Error("Only a workflow session of a feature starts implementers.");
    }
    try {
      // The same task again answers its sub-session, wherever the call says it works.
      const found = this.#find(parent, "implementer", task);
      if (found) {
        return await this.#run(found, prompt, signal);
      }
      const cwd = await this.#worktree(row.repo, worktree);
      const pick = implementerPick(this.#context, row.repo, row.folder);
      return await this.start(
        parent,
        "implementer",
        { about: task, cwd, message: prompt, pick },
        signal,
      );
    } catch (error) {
      throw new Error(reasonOf(error), { cause: error });
    }
  }

  /**
   * The worktree `given` names, by its real path: refused unless it is the absolute path of a
   * linked worktree of the repository whose main checkout is `root`, there now, as `git worktree
   * list` gives them, and not the worktree of a change or a feature, which has its branch: the
   * parent's own, or another's. A relative path would be read from the server's own directory.
   */
  async #worktree(root: string, given: string): Promise<string> {
    const refuse = (why: string) =>
      new Error(`${given} ${why}: give the path of the task's worktree, from git worktree list.`);
    if (!isAbsolute(given)) {
      throw refuse("is not an absolute path");
    }
    const real = await realpath(given).catch(() => undefined);
    if (real === undefined) {
      throw refuse("is not a worktree of this repository");
    }
    if (real === (await realpath(root))) {
      throw refuse("is the main checkout, not a worktree of a task");
    }
    const { worktrees } = await this.#context.binding.gitPage(root);
    const listed = await Promise.all(
      worktrees
        .filter((worktree) => worktree.state !== "missing")
        .map(async (worktree) => ({
          folder: worktree.folder,
          real: await realpath(resolve(root, worktree.path)).catch(() => undefined),
        })),
    );
    const found = listed.find((worktree) => worktree.real === real);
    if (found === undefined) {
      throw refuse("is not a worktree of this repository");
    }
    if (found.folder !== undefined) {
      throw refuse(`is the worktree of ${found.folder}, not of a task`);
    }
    return real;
  }

  /**
   * Starts a turn of the sub-session, its first, or a new one once its latest stopped or failed
   * without a continue to wait for: its process opens in its worktree, and the turn takes its
   * parent's step and trigger. Nothing while it works or waits to continue, or once it ended done:
   * the call answers that turn's end. A first turn that cannot start removes the sub-session, which
   * has nothing to show: a call waiting for it then answers that it did not start.
   */
  async #begin(row: SessionRow, text: string): Promise<void> {
    const { cache, processes, turns } = this.#context;
    const live = this.#context.live.of(row);
    await this.#context.live.serial(live, async () => {
      if (!cache.session(row.id)) {
        throw new Error(
          `The ${row.role ?? "sub-agent"} of ${row.title ?? "its task"} did not start.`,
        );
      }
      if (working(live) || !runsAgain(latestTurn(cache.turns(row.id)))) {
        return;
      }
      const id = randomUUID();
      const item = messageItem(id, "workflow", text);
      const message = { id, images: [], text, when: "queue" as const };
      live.starting = true;
      try {
        const { line } = await processes.open(live);
        turns.begin(live, {
          allowed: null,
          item,
          kind: "workflow",
          message,
          ...parentTurn(this.#context, row.parent as string),
          ...(line === undefined ? {} : { line }),
        });
      } catch (error) {
        // A sub-session that never started a turn goes: the task asked again starts a new one.
        cache.removeEmptySession(row.id);
        throw error;
      } finally {
        live.starting = false;
      }
    });
  }

  /**
   * Resolves once the session no longer works: its turn, and the turns queued after it, ended, and
   * the continue of the last one decided.
   */
  async #idle(session: string, signal?: AbortSignal): Promise<void> {
    const given = new Promise<never>((_, reject) => {
      const stop = () => reject(new Error("The call was cancelled."));
      if (signal?.aborted) {
        stop();
      }
      signal?.addEventListener("abort", stop, { once: true });
    });
    given.catch(() => {});
    const { cache, turns } = this.#context;
    for (;;) {
      // A turn's end settles once its continue is decided.
      const last = cache.turns(session).at(-1)?.id;
      await Promise.race([last === undefined ? undefined : turns.settled(last), given]);
      const live = this.#context.live.get(session);
      if (!live || !working(live)) {
        return;
      }
      const turn = live.turn?.id ?? live.queue[0]?.id;
      await Promise.race([turn === undefined ? live.lock : turns.settled(turn), given]);
    }
  }

  /** The sub-session's answer: the last text of its latest turn, or why that turn did not end done. */
  #answer(row: SessionRow): string {
    const { cache } = this.#context;
    const turn = latestTurn(cache.turns(row.id));
    const name = `The ${row.role ?? "sub-agent"} of ${row.title ?? "its task"}`;
    if (!turn) {
      throw new Error(`${name} did not start.`);
    }
    if (turn.state !== "done") {
      throw new Error(`${name} ${turn.state}${turn.reason === null ? "." : `: ${turn.reason}`}`);
    }
    return cache.itemsOf(turn.id, "text").at(-1)?.text ?? "";
  }
}

/**
 * Whether a sub-session of `parent` works, or waits to continue: the parent's own continue waits
 * for them, or it would call its tools again before they answered.
 */
export function subSessionsWork(context: SessionContext, parent: string): boolean {
  const { cache, live } = context;
  const subs = cache.subSessionsOf(parent);
  if (subs.length === 0) {
    return false;
  }
  const waiting = new Set(cache.pendingContinues().map((turn) => turn.sessionId));
  return subs.some((sub) => {
    const held = live.get(sub.id);
    return waiting.has(sub.id) || (held !== undefined && working(held));
  });
}

/** The latest turn, skipping those taken back, which never ran. */
const latestTurn = (turns: Array<TurnRow>) =>
  turns.findLast((turn) => !(turn.state === "stopped" && turn.reason === TAKEN_BACK));

/**
 * Whether a call starts a turn of a sub-session whose latest turn is `last`: its first, or once its
 * latest stopped or failed without a continue to wait for.
 */
const runsAgain = (last: TurnRow | undefined) =>
  last === undefined ||
  ((last.state === "stopped" || last.state === "failed") && last.continueAt === null);

/** The step and trigger of the parent's turn: its running one, else its latest workflow turn. */
function parentTurn(
  context: SessionContext,
  parent: string,
): { step: string | null; trigger: Trigger | null } {
  const running = context.live.get(parent)?.turn?.id;
  const turn =
    (running === undefined ? undefined : context.cache.turn(running)) ??
    context.cache.turns(parent).findLast((one) => one.kind === "workflow");
  return { step: turn?.step ?? null, trigger: turn?.trigger ?? null };
}

/** The input of `run_agent`, each field a text that is not blank: else refused, saying which. */
function runAgentInput(input: unknown): RunAgentInput {
  const fields = (typeof input === "object" && input !== null ? input : {}) as Record<
    string,
    unknown
  >;
  const text = (name: keyof RunAgentInput) => {
    const value = fields[name];
    if (typeof value !== "string" || value.trim() === "") {
      throw new Error(`run_agent needs \`${name}\`, a text.`);
    }
    return value.trim();
  };
  return { prompt: text("prompt"), task: text("task"), worktree: text("worktree") };
}

/**
 * The `run_agent` tool of Uraeda's MCP endpoint: a workflow session runs one task in a sub-session,
 * `SubSessions.runAgent`.
 */
export function runAgentTool(subSessions: SubSessions): McpTool {
  return {
    call: (session, input, signal) => subSessions.runAgent(session, input, signal),
    description:
      "Runs one task of the plan as an implementer: a new agent session in the task's worktree, " +
      "on the implementers' agent, model, and effort, given `prompt` as its only context. Answers " +
      "with the implementer's last message once it ends. Call it once per task, several at once " +
      "for a wave's tasks. The same `task` again answers the first call's result, without " +
      "starting another session.",
    inputSchema: {
      properties: {
        prompt: {
          description:
            "Everything the implementer needs: the task, its files, and how to check it.",
          type: "string",
        },
        task: { description: "The task's name, as the plan gives it: `Task 4`.", type: "string" },
        worktree: {
          description:
            "The absolute path of the task's worktree, one of the repository's linked worktrees.",
          type: "string",
        },
      },
      required: ["task", "prompt", "worktree"],
      type: "object",
    },
    name: "run_agent",
  };
}
