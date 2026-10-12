import { randomUUID } from "node:crypto";
import type { Binding } from "../fate/context.ts";
import type { Adapter, AgentRun } from "./adapter.ts";
import type { RunCache } from "./cache.ts";
import type { AgentEvent, Denial, RunEvent, RunState } from "./events.ts";
import { allowRule, runMessage, toolTarget, type TriggerDetail } from "./message.ts";

/** SIGTERM follows SIGINT after this long, when the process still runs. */
export const TERMINATE_AFTER_MS = 10_000;
/** A run without an event for this long is stopped, and fails. */
export const WATCHDOG_MS = 30 * 60_000;
/** A tool's output is cut to this many characters. */
export const OUTPUT_LIMIT = 4_000;
/** A failed run without a result keeps this many lines of stderr. */
const STDERR_LINES = 20;

export const REFUSALS = {
  busy: "An agent is already working on this feature.",
  human: "Nothing for the agent: the feature waits on you.",
  unavailable: "Claude Code is not available on this machine.",
  /** A commit on a feature while its run goes on. */
  working: "An agent is working on this feature. Stop it first, or wait for it.",
};

/** What changed: the runner's availability, or a run, with its state. */
export type RunnerChange =
  | { runner: true }
  | { repo: string; folder: string; run: number; state: RunState };

export type RunnerOptions = {
  adapter: Adapter;
  cache: RunCache;
  binding: Binding;
  /** The plugin folder that holds the Uraeda skill. */
  pluginDir: string;
  /** Called on every change; the server throttles its live updates. */
  onChange: (change: RunnerChange) => void;
};

/** A run going on in this process. */
type Live = {
  id: number;
  repo: string;
  folder: string;
  process: AgentRun;
  /** How the run ends once it was stopped: by Stop, the server, the watchdog, or its plugin. */
  stop?: { state: RunState; reason?: string };
  result?: Extract<AgentEvent, { type: "result" }>;
  /** The `seq` and start time of each tool call still running. */
  tools: Map<string, { seq: number; event: Extract<RunEvent, { kind: "tool" }>; at: number }>;
  skipped: { seq: number; count: number } | undefined;
  watchdog?: ReturnType<typeof setTimeout>;
  terminate?: ReturnType<typeof setTimeout>;
  ended: Promise<void>;
};

const refused = (text: string) => new Error(`refused: ${text}`);
const key = (repo: string, folder: string) => `${repo}\0${folder}`;

/**
 * Runs agents on features: at most one run per feature, each in the feature's worktree, on the
 * feature's one session. Runs and their logs go to the cache, and every change to `onChange`.
 */
export class Runner {
  #options: RunnerOptions;
  #status: { available: boolean; version: string | null } = { available: false, version: null };
  /** The features whose run is starting or going on, by repository and folder. */
  #busy = new Set<string>();
  #live = new Map<number, Live>();

  constructor(options: RunnerOptions) {
    this.#options = options;
  }

  /** The cache the runner writes its runs to, which the server reads them from. */
  get cache(): RunCache {
    return this.#options.cache;
  }

  /** Whether the agent worked at the last check, and its version. */
  status(): { available: boolean; version: string | null } {
    return { ...this.#status };
  }

  /** Asks the agent for its version, and reports a change of availability. */
  async check(): Promise<void> {
    const version = (await this.#options.adapter.version()) ?? null;
    const status = { available: version !== null, version };
    if (status.available === this.#status.available && status.version === this.#status.version) {
      return;
    }
    this.#status = status;
    this.#options.onChange({ runner: true });
  }

  /** The folders of the repository with a run going on. */
  running(repo: string): Array<string> {
    return [...this.#live.values()].filter((run) => run.repo === repo).map((run) => run.folder);
  }

  /** Resolves once the run has ended, at once when it is not going on. */
  async settled(runId: number): Promise<void> {
    await this.#live.get(runId)?.ended;
  }

  /**
   * Starts a run on the feature's next step, and returns its ID. Refuses, with `refused: <text>`,
   * a feature with a run going on, a step that does not wait on an agent, and a missing agent.
   */
  async start(repo: string, folder: string, detail: TriggerDetail): Promise<number> {
    const busy = key(repo, folder);
    if (this.#busy.has(busy)) {
      throw refused(REFUSALS.busy);
    }
    if (!this.#status.available) {
      throw refused(REFUSALS.unavailable);
    }
    // Taken before the first await, so a second click in a row is refused.
    this.#busy.add(busy);
    try {
      return await this.#start(repo, folder, detail);
    } catch (error) {
      this.#busy.delete(busy);
      throw error;
    }
  }

  async #start(repo: string, folder: string, detail: TriggerDetail) {
    const { binding, cache, adapter, pluginDir } = this.#options;
    // "Allow and continue" allows its one rule, for this run only.
    const allowed = detail.trigger === "allow" ? detail.rule : undefined;
    const next = await binding.nextStep(repo, folder);
    const { step } = next;
    if (step.waitsOn !== "agent" || !step.reference) {
      throw refused(REFUSALS.human);
    }
    const cwd = await binding.workDir(repo, folder);
    const { kind } = await binding.readFeature(repo, folder);

    const previous = cache.session(next.mainRoot, folder);
    const resume = previous !== undefined && adapter.hasSession(previous);
    const sessionId = resume ? previous : randomUUID();
    if (!resume) {
      cache.saveSession(next.mainRoot, folder, sessionId);
    }
    const id = cache.startRun({
      repo: next.mainRoot,
      folder,
      sessionId,
      newSession: !resume,
      trigger: detail.trigger,
      step: step.name,
      allowed: allowed ?? null,
      startedAt: new Date().toISOString(),
    });
    if (previous !== undefined && !resume) {
      cache.appendEvent(id, {
        kind: "system",
        text: "Started a new session: the previous one is gone.",
      });
    }

    const process = adapter.start({
      cwd,
      message: runMessage({
        folder,
        branch: next.branch ?? "",
        bug: kind === "bug",
        step: step.name,
        reference: step.reference,
        detail,
      }),
      sessionId,
      resume,
      pluginDir,
      ...(allowed === undefined ? {} : { allowed }),
    });
    const live: Live = {
      id,
      repo,
      folder,
      process,
      tools: new Map(),
      skipped: undefined,
      ended: Promise.resolve(),
    };
    this.#live.set(id, live);
    this.#watch(live);
    live.ended = this.#consume(live);
    this.#changed(live, "running");
    return id;
  }

  /** Starts a run of the same feature that allows the blocked action of event `seq`. */
  async allow(repo: string, runId: number, seq: number): Promise<number> {
    const { cache } = this.#options;
    const row = cache.run(runId);
    const [event] = row ? cache.events(runId, seq, 1) : [];
    if (!row || event?.seq !== seq || event.kind !== "denial") {
      throw refused(`no blocked action ${seq} in run ${runId}`);
    }
    return this.start(repo, row.folder, { trigger: "allow", rule: event.rule });
  }

  /** Stops a run going on: SIGINT, then SIGTERM 10 seconds later. A run that ended is left. */
  stop(runId: number): void {
    const live = this.#live.get(runId);
    if (live) {
      this.#halt(live, { state: "stopped" });
    }
  }

  /** Stops the run, which then ends as `end` says. */
  #halt(live: Live, end: { state: RunState; reason?: string }) {
    if (live.stop) {
      return;
    }
    live.stop = end;
    live.process.interrupt();
    live.terminate = setTimeout(() => live.process.terminate(), TERMINATE_AFTER_MS);
  }

  /** Stops every run, as the server stops, and waits for them to end. */
  async stopAll(): Promise<void> {
    const runs = [...this.#live.values()];
    for (const live of runs) {
      this.#halt(live, { state: "stopped", reason: "Stopped: the server stopped." });
    }
    await Promise.all(runs.map((live) => live.ended));
  }

  /** Clears the runner's timers. */
  close(): void {
    for (const live of this.#live.values()) {
      clearTimeout(live.watchdog);
      clearTimeout(live.terminate);
    }
  }

  /** Restarts the run's watchdog. */
  #watch(live: Live) {
    clearTimeout(live.watchdog);
    live.watchdog = setTimeout(
      () => this.#halt(live, { state: "failed", reason: "No activity for 30 minutes." }),
      WATCHDOG_MS,
    );
  }

  #changed(live: Live, state: RunState) {
    this.#options.onChange({ repo: live.repo, folder: live.folder, run: live.id, state });
  }

  /** Reads the run's events into the cache, until its process exits. */
  async #consume(live: Live): Promise<void> {
    for await (const event of live.process.events) {
      this.#watch(live);
      try {
        if (event.type === "exit") {
          this.#end(live, event);
          return;
        }
        this.#record(live, event);
      } catch (error) {
        // A cache write that fails does not stop the run.
        console.error(`The runner could not record an event of run ${live.id}: ${String(error)}`);
      }
      this.#changed(live, "running");
    }
    this.#end(live, { type: "exit", code: null, stderr: "" });
  }

  #record(live: Live, event: Exclude<AgentEvent, { type: "exit" }>) {
    const { cache } = this.#options;
    switch (event.type) {
      case "init":
        if (event.pluginErrors.length > 0) {
          this.#halt(live, {
            state: "failed",
            reason: `The Uraeda skill did not load: ${event.pluginErrors.join("; ")}`,
          });
        }
        return;
      case "text":
        cache.appendEvent(live.id, { kind: "text", text: event.text });
        return;
      case "toolStart": {
        const target = toolTarget(event.name, event.input);
        const tool = {
          kind: "tool" as const,
          id: event.id,
          name: event.name,
          ...(target === undefined ? {} : { target }),
          status: "running" as const,
        };
        const seq = cache.appendEvent(live.id, tool);
        live.tools.set(event.id, { seq, event: tool, at: Date.now() });
        return;
      }
      case "toolEnd": {
        const tool = live.tools.get(event.id);
        if (!tool) {
          return;
        }
        live.tools.delete(event.id);
        cache.updateEvent(live.id, tool.seq, {
          ...tool.event,
          status: event.isError ? "error" : "complete",
          durationMs: Date.now() - tool.at,
          output: event.output.slice(0, OUTPUT_LIMIT),
        });
        return;
      }
      case "retry":
        cache.appendEvent(live.id, { kind: "system", text: retryText(event) });
        return;
      case "result":
        live.result = event;
        for (const denial of event.denials) {
          cache.appendEvent(live.id, denialEvent(denial));
        }
        return;
      case "skipped": {
        const count = (live.skipped?.count ?? 0) + 1;
        const text = `Skipped ${count} ${count === 1 ? "line" : "lines"} Claude Code printed that the runner does not read.`;
        if (live.skipped) {
          cache.updateEvent(live.id, live.skipped.seq, { kind: "system", text });
          live.skipped.count = count;
        } else {
          live.skipped = { seq: cache.appendEvent(live.id, { kind: "system", text }), count };
        }
        return;
      }
    }
  }

  /** Ends the run, with the state its events and its exit give. */
  #end(live: Live, exit: Extract<AgentEvent, { type: "exit" }>) {
    if (!this.#live.has(live.id)) {
      return;
    }
    clearTimeout(live.watchdog);
    clearTimeout(live.terminate);
    this.#live.delete(live.id);
    this.#busy.delete(key(live.repo, live.folder));
    const end = outcome(live, exit);
    try {
      this.#options.cache.endRun(live.id, {
        ...end,
        ...(live.result?.costUsd === undefined ? {} : { costUsd: live.result.costUsd }),
      });
    } catch (error) {
      console.error(`The runner could not record the end of run ${live.id}: ${String(error)}`);
    }
    this.#changed(live, end.state);
  }
}

/** How a run ended: stopped, failed with its reason, or done. */
function outcome(
  live: Live,
  exit: Extract<AgentEvent, { type: "exit" }>,
): { state: RunState; reason?: string } {
  if (live.stop) {
    return live.stop;
  }
  if (exit.missing) {
    return { state: "failed", reason: REFUSALS.unavailable };
  }
  if (live.result?.ok) {
    return { state: "done" };
  }
  if (live.result && live.result.errors.length > 0) {
    return { state: "failed", reason: live.result.errors.join("\n") };
  }
  const stderr = exit.stderr.trimEnd().split("\n").slice(-STDERR_LINES).join("\n");
  return { state: "failed", reason: stderr || `Claude Code exited with code ${exit.code}.` };
}

function retryText({ delayMs, error }: Extract<AgentEvent, { type: "retry" }>): string {
  const seconds = Math.round(delayMs / 1000);
  return error === "rate_limit"
    ? `Rate limited, retrying in ${seconds} s.`
    : `The API failed (${error}), retrying in ${seconds} s.`;
}

function denialEvent(denial: Denial): RunEvent {
  const target = toolTarget(denial.tool, denial.input);
  return {
    kind: "denial",
    tool: denial.tool,
    ...(target === undefined ? {} : { target }),
    rule: allowRule(denial),
  };
}
