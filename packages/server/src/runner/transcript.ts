import { activityLabel, WORKING, waitingLabel, working } from "./activity.ts";
import type { AgentEvent, BackgroundTask, Item } from "./events.ts";
import { toolTarget } from "./message.ts";
import {
  commandCount,
  type Live,
  OUTPUT_LIMIT,
  type Proc,
  rowOf,
  type Running,
  type SessionContext,
  type Tool,
} from "./session-state.ts";

/** The plugin the skill loads as, which every process must report loaded. */
const PLUGIN = "uraeda";

type Result = Extract<AgentEvent, { type: "result" }>;

/** The events that show the agent working, which reopen its ended turn. */
const RESUMES = new Set<AgentEvent["type"]>([
  "activity",
  "textDelta",
  "text",
  "toolStart",
  "toolEnd",
  "retry",
]);

/**
 * The sessions' events, recorded as their turns' items in the cache: texts as they stream, tool
 * calls, retries, skipped lines, blocked actions, and the messages the agent read or took back. A
 * result ends its turn once no background sub-agent runs, and an `init` without the skill fails it.
 * Output after the turn ended, when the agent goes on by itself, reopens it.
 */
export class Transcript {
  #context: SessionContext;

  constructor(context: SessionContext) {
    this.#context = context;
  }

  /** Records an event of the session's process, other than its exit. */
  // oxlint-disable-next-line max-lines-per-function -- over the limit before the code quality decision: each event kind's handling in a method of its own
  record(live: Live, proc: Proc, event: Exclude<AgentEvent, { type: "exit" }>) {
    const { adapter, cache, changed, turns } = this.#context;
    const turn = live.turn ?? (RESUMES.has(event.type) ? turns.resume(live, proc) : undefined);
    if (turn && !turn.stop) {
      turns.watch(live, turn);
    }
    switch (event.type) {
      case "init": {
        // `/clear` starts a new agent session in the same process.
        if (event.sessionId !== "" && event.sessionId !== rowOf(cache, live).nativeId) {
          cache.updateSession(live.id, { nativeId: event.sessionId });
          changed(live);
        }
        // The skill loads as the `uraeda` plugin: a process without it must not run.
        if (event.pluginErrors.length > 0 || !event.plugins.includes(PLUGIN)) {
          const why =
            event.pluginErrors.length > 0
              ? event.pluginErrors.join("; ")
              : `the plugins loaded were ${event.plugins.join(", ") || "none"}`;
          if (turn) {
            turns.halt(live, turn, {
              reason: `The Uraeda skill did not load: ${why}`,
              state: "failed",
            });
          }
          this.#context.processes.close(proc);
        }
        return;
      }
      case "background": {
        this.#background(live, proc, turn, event.tasks);
        return;
      }
      case "tokens":
        this.#context.processes.tokens(live, proc, event.total);
        return;
      case "accepted":
      case "cancelled": {
        const sent = live.messages.get(event.id);
        if (sent && sent.item.state === "pending") {
          turns.mark(live, sent, event.type === "accepted" ? "read" : "taken-back");
        }
        return;
      }
    }
    if (!turn) {
      return;
    }
    const append = (item: Item) => {
      const seq = cache.appendItem(turn.id, item);
      changed(live, turn.id);
      return seq;
    };
    const update = (seq: number, item: Item) => {
      cache.updateItem(turn.id, seq, item);
      changed(live, turn.id);
    };
    // The main agent's output says what it does now, as its sub-agents' does not.
    if (event.type !== "result" && event.type !== "skipped" && event.type !== "retry") {
      const parent =
        event.type === "toolStart"
          ? event.parent
          : event.type === "toolEnd"
            ? turn.tools.get(event.id)?.item.parent
            : undefined;
      if (parent === undefined) {
        turn.replied = undefined;
        this.#activity(
          live,
          turn,
          event.type === "activity" ? activityLabel(event.activity) : WORKING,
          event.type === "textDelta",
        );
      }
    }
    switch (event.type) {
      case "activity":
        return;
      case "textDelta":
        if (turn.text) {
          turn.text.text += event.text;
          update(turn.text.seq, { kind: "text", streaming: true, text: turn.text.text });
        } else {
          const item = { kind: "text" as const, streaming: true, text: event.text };
          turn.text = { seq: append(item), text: event.text };
        }
        return;
      case "text":
        if (turn.text) {
          update(turn.text.seq, { kind: "text", streaming: false, text: event.text });
          turn.text = undefined;
        } else {
          append({ kind: "text", streaming: false, text: event.text });
        }
        return;
      case "toolStart": {
        const item: Tool = {
          id: event.id,
          kind: "tool",
          name: event.name,
          toolKind: event.kind,
          ...(event.target === undefined ? {} : { target: event.target }),
          status: "in_progress",
          ...(event.parent === undefined ? {} : { parent: event.parent }),
          ...(event.subagent === undefined ? {} : { subagent: event.subagent }),
        };
        turn.tools.set(event.id, { at: Date.now(), item, seq: append(item) });
        return;
      }
      case "toolEnd": {
        const tool = turn.tools.get(event.id);
        if (tool && proc.background.has(event.id) && !event.isError) {
          tool.ended = event;
        } else {
          this.#endTool(live, turn, event.id, event);
        }
        return;
      }
      case "retry":
        append({ kind: "system", text: retryText(event) });
        return;
      case "skipped": {
        const count = (turn.skipped?.count ?? 0) + 1;
        const text = `Skipped ${count} ${count === 1 ? "line" : "lines"} ${adapter.name} printed that Uraeda does not read.`;
        if (turn.skipped) {
          update(turn.skipped.seq, { kind: "system", text });
          turn.skipped.count = count;
        } else {
          turn.skipped = { count, seq: append({ kind: "system", text }) };
        }
        return;
      }
      case "result":
        this.#result(live, proc, turn, event, append);
        return;
    }
  }

  /**
   * Sets what the turn does now, reported when it changed. Since when restarts with it, and with
   * each piece of text, which `quiet` leaves to the text's own change to report.
   */
  #activity(live: Live, turn: Running, label: string, quiet = false) {
    if (label === turn.activity.label && !quiet) {
      return;
    }
    turn.activity = working(label);
    if (!quiet) {
      this.#context.changed(live, turn.id);
    }
  }

  /** Records a tool call's end, with its result. */
  #endTool(live: Live, turn: Running, id: string, end: { isError: boolean; output: string }) {
    const { cache, changed } = this.#context;
    const tool = turn.tools.get(id);
    if (!tool) {
      return;
    }
    turn.tools.delete(id);
    cache.updateItem(turn.id, tool.seq, {
      ...tool.item,
      durationMs: Date.now() - tool.at,
      output: end.output.slice(0, OUTPUT_LIMIT),
      status: end.isError ? "failed" : "completed",
    });
    changed(live, turn.id);
  }

  /**
   * The background tasks still running: a task's tool call ends once it reports back, not when it
   * starts. The commands' count is published as it changes; once none runs, a process with no turn
   * starts its idle timer.
   */
  #background(live: Live, proc: Proc, turn: Running | undefined, tasks: Array<BackgroundTask>) {
    const before = commandCount(proc.background);
    const done = [...proc.background.keys()].filter((id) => !tasks.some((t) => t.tool === id));
    proc.background = new Map(tasks.map((task) => [task.tool, task.kind]));
    for (const id of done) {
      const tool = turn?.tools.get(id);
      if (turn && tool?.ended) {
        this.#endTool(live, turn, id, tool.ended);
      }
    }
    if (turn?.replied) {
      this.#activity(live, turn, tasks.length > 0 ? waitingLabel(proc.background) : WORKING);
    }
    if (commandCount(proc.background) !== before) {
      this.#context.changed(live);
    }
    if (!live.turn && proc.background.size === 0) {
      this.#context.turns.next(live);
    }
  }

  /**
   * Ends the turn with its result, unless a message steered into it waits to be read, or a
   * background sub-agent still runs: the agent answers them before the turn settles.
   */
  #result(live: Live, proc: Proc, turn: Running, result: Result, append: (item: Item) => number) {
    const { adapter, turns } = this.#context;
    for (const denial of result.denials) {
      const target = toolTarget(denial.tool, denial.input, proc.cwd);
      const rule = adapter.allowRule(denial);
      append({
        kind: "denial",
        tool: denial.tool,
        ...(target === undefined ? {} : { target }),
        ...(rule === undefined ? {} : { rule }),
        allowed: false,
      });
    }
    const first = live.messages.get(turn.first);
    if (first?.item.state === "pending") {
      turns.mark(live, first, "read");
    }
    const unread = [...live.messages.values()].some(
      (sent) => sent.turn === turn.id && sent.written && sent.item.state === "pending",
    );
    if (result.ok && !turn.stop && (unread || proc.background.size > 0)) {
      if (!unread) {
        turn.replied = true;
        this.#activity(live, turn, waitingLabel(proc.background));
      }
      return;
    }
    // A turn that ends on its own, as one that failed, takes back what the agent did not read:
    // it would otherwise run after it, in no turn.
    if (!turn.stop) {
      for (const [id, sent] of turns.unread(live, turn)) {
        proc.agent.takeBack(id);
        turns.mark(live, sent, "taken-back");
      }
    }
    const end =
      turn.stop ??
      (result.interrupted
        ? { state: "stopped" as const }
        : result.ok
          ? { state: "done" as const }
          : {
              reason: result.errors.join("\n") || `${adapter.name} ended the turn with an error.`,
              state: "failed" as const,
            });
    turns.end(live, turn.id, end);
    turns.next(live);
  }
}

function retryText({ delayMs, error }: Extract<AgentEvent, { type: "retry" }>): string {
  const seconds = Math.round(delayMs / 1000);
  return error === "rate_limit"
    ? `Rate limited, retrying in ${seconds} s.`
    : `The API failed (${error}), retrying in ${seconds} s.`;
}
