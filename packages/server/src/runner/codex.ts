import { execFile } from "node:child_process";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  Adapter,
  AgentModel,
  AgentProcess,
  Capabilities,
  ModelList,
  OpenOptions,
} from "./adapter.ts";
import {
  type Child,
  endShortProcess,
  EventQueue,
  lines,
  MODELS_TIMEOUT_MS,
  spawnGrouped,
} from "./child.ts";
import { CodexCatalogs } from "./codex-catalog.ts";
import { CodexEvents, type CodexNotification } from "./codex-events.ts";
import { appliedProblem, codexTrust, gitMainRoot } from "./codex-permissions.ts";
import { hasRollout } from "./codex-rollouts.ts";
import { CodexRpc } from "./codex-rpc.ts";
import { CodexTurns } from "./codex-turns.ts";
import { effortName } from "./efforts.ts";
import { toolsEnv } from "./uraeda-tools.ts";
import type { AgentEvent } from "./events.ts";
import type { ExtensionPaths } from "./instructions.ts";
import {
  codexInput,
  codexInstructions,
  codexServerArgs,
  codexThreadParams,
  codexTurnParams,
} from "./codex-thread.ts";

/**
 * Codex, run through its installed `codex` command's `app-server`, its own JSON-RPC protocol over
 * stdio. Codex's formats stay here and in `codex-events.ts`: the field names follow the protocol's
 * generated types (Codex 0.163.0).
 */

/** `codex --version` gives up after this long. */
const VERSION_TIMEOUT_MS = 5000;
/** A process's start, from `initialize` to its thread started or resumed, gives up after this long. */
export const START_TIMEOUT_MS = 60_000;
/** `model/list` pages read at most, should Codex never stop giving a cursor. */
const MAX_PAGES = 50;

type Json = Record<string, unknown>;
const isJson = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const textOf = (value: unknown): string | undefined =>
  typeof value === "string" && value !== "" ? value : undefined;
const reason = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** The rows of `model/list` pages offered in a picker: each but the hidden ones. */
function shownRows(rows: unknown): Array<Json & { model: string }> {
  return (Array.isArray(rows) ? rows : []).flatMap((row) => {
    const model = isJson(row) ? (textOf(row.model) ?? textOf(row.id)) : undefined;
    return isJson(row) && model !== undefined && row.hidden !== true ? [{ ...row, model }] : [];
  });
}

/**
 * The models of Codex's `model/list` rows, every page's, and its `config/read` answer: each row
 * but the hidden ones, by its model as the ID, its display name, and its efforts. The defaults are
 * the configured model and effort, else the row marked default and its default effort.
 */
export function codexModels(rows: unknown, configRead: unknown): ModelList {
  const shown = shownRows(rows);
  const models = shown.map((row): AgentModel => {
    const efforts = Array.isArray(row.supportedReasoningEfforts)
      ? row.supportedReasoningEfforts
      : [];
    const description = textOf(row.description);
    return {
      ...(description === undefined ? {} : { description }),
      efforts: efforts.flatMap((option) => {
        const id = isJson(option) ? textOf(option.reasoningEffort) : undefined;
        return id === undefined ? [] : [{ id, name: effortName(id) }];
      }),
      id: row.model,
      name: textOf(row.displayName) ?? row.model,
    };
  });
  const config = isJson(configRead) && isJson(configRead.config) ? configRead.config : {};
  const marked = shown.find((row) => row.isDefault === true);
  const model = textOf(config.model) ?? marked?.model;
  const effort =
    textOf(config.model_reasoning_effort) ??
    textOf(shown.find((row) => row.model === model)?.defaultReasoningEffort);
  return {
    defaults: {
      ...(effort === undefined ? {} : { effort }),
      ...(model === undefined ? {} : { model }),
    },
    models,
  };
}

/** Every row of `model/list`, page after page. */
async function listRows(rpc: CodexRpc): Promise<Array<unknown>> {
  const rows: Array<unknown> = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const answer = await rpc.request("model/list", cursor === undefined ? {} : { cursor });
    const data = isJson(answer) ? answer.data : undefined;
    rows.push(...(Array.isArray(data) ? data : []));
    cursor = isJson(answer) ? textOf(answer.nextCursor) : undefined;
    if (cursor === undefined) {
      break;
    }
  }
  return rows;
}

/** The rows of `model/list` and the answer of `config/read`, read together. */
async function listAndConfig(rpc: CodexRpc): Promise<{ config: unknown; rows: Array<unknown> }> {
  const [rows, config] = await Promise.all([
    listRows(rpc),
    rpc.request("config/read", { includeLayers: false }),
  ]);
  return { config, rows };
}

/** A `codex app-server`, its channel, and its lines read as they come, once it started. */
type AppServer = {
  /** Closes its stdin. */
  endInput(): void;
  rpc: CodexRpc;
  /** Signals its process group. */
  signal(name: NodeJS.Signals): void;
  /** The process, once it started. */
  spawned: Promise<Child>;
  started: Promise<unknown>;
};

/**
 * Starts `codex app-server` in `cwd`, in a process group of its own, and introduces the client:
 * `initialize`, asking for the experimental API, then `initialized`. Each notification goes to
 * `heard`, and `ended` runs once its output closed, with the exit event. It runs with `args`,
 * `app-server` by default, once they are known, and `env` added to its environment: what is
 * written or signalled before waits for its start.
 */
function appServer(
  command: string,
  cwd: string,
  heard: (notification: CodexNotification) => void,
  ended: (exit: Extract<AgentEvent, { type: "exit" }>) => void,
  {
    args = ["app-server"],
    env,
  }: { args?: Array<string> | Promise<Array<string>>; env?: Record<string, string> } = {},
): AppServer {
  let child: Child | undefined;
  const waiting: Array<(child: Child) => void> = [];
  const once = (act: (child: Child) => void) => (child ? act(child) : waiting.push(act));
  const rpc = new CodexRpc((value) => once((running) => running.write(value)));
  const spawned = (async () => {
    child = spawnGrouped(command, await args, cwd, env);
    for (const act of waiting.splice(0)) {
      act(child);
    }
    return child;
  })();
  void (async () => {
    const { child: output, exited } = await spawned;
    try {
      for await (const line of lines(output.stdout)) {
        const notification = rpc.read(line);
        if (notification !== undefined) {
          heard(notification);
        }
      }
    } catch {
      // A process that failed to start has no output.
    }
    const exit = await exited;
    rpc.end(exit.missing ? `Codex is not available: ${exit.stderr}` : "Codex exited");
    ended(exit);
  })();
  const started = rpc
    .request("initialize", {
      capabilities: { experimentalApi: true, requestAttestation: false },
      clientInfo: { name: "uraeda", title: "Uraeda", version: "1" },
    })
    .then(() => rpc.notify("initialized"));
  // A failure shows where the start is awaited.
  started.catch(() => {});
  return {
    endInput: () => once((running) => running.child.stdin.end()),
    rpc,
    signal: (name) => once((running) => running.signal(name)),
    spawned,
    started,
  };
}

export type CodexAdapterOptions = {
  /**
   * The folder of Codex's model catalog without its sub-agents, which workflow sessions and
   * sub-sessions run on, `<data folder>/codex-catalog`: never in Codex's home. Without it, they run
   * on Codex's own catalog.
   */
  catalogDir?: string;
  /** Codex's home folder, where it keeps its threads: `$CODEX_HOME`, else `~/.codex`. */
  codexHome?: string;
  /** The command to run, `codex` from the `PATH` by default. */
  command?: string;
  /**
   * Where sessions write extensions and read their documentation: the server always gives it;
   * scripts running Codex outside the server, without extensions, do not.
   */
  extensions?: ExtensionPaths;
  /** The plugin folder that holds the Uraeda skill, `layout().plugin` in the server. */
  pluginDir: string;
  /** How long a process's start may take, `START_TIMEOUT_MS` by default: tests shorten it. */
  startTimeoutMs?: number;
};

/** Codex, one `codex app-server` per open session. */
export class CodexAdapter implements Adapter {
  readonly icon = "uraeda:harness-openai";
  readonly kind = "codex";
  readonly name = "Codex";
  readonly capabilities: Capabilities = {
    approvals: false,
    images: true,
    queue: true,
    steer: true,
    subagents: false,
    takeBack: true,
  };
  #catalogs: CodexCatalogs | undefined;
  #command: string;
  #codexHome: string;
  #extensions: ExtensionPaths | undefined;
  #pluginDir: string;
  #startTimeoutMs: number;

  constructor({
    catalogDir,
    codexHome = process.env.CODEX_HOME ?? join(homedir(), ".codex"),
    command = "codex",
    extensions,
    pluginDir,
    startTimeoutMs = START_TIMEOUT_MS,
  }: CodexAdapterOptions) {
    this.#catalogs = catalogDir === undefined ? undefined : new CodexCatalogs(command, catalogDir);
    this.#codexHome = codexHome;
    this.#command = command;
    this.#extensions = extensions;
    this.#pluginDir = pluginDir;
    this.#startTimeoutMs = startTimeoutMs;
  }

  version(): Promise<string | undefined> {
    return new Promise((resolve) => {
      execFile(
        this.#command,
        ["--version"],
        { encoding: "utf8", timeout: VERSION_TIMEOUT_MS },
        (error, stdout) => {
          const first = stdout.split("\n")[0]?.trim();
          resolve(error || !first ? undefined : first);
        },
      );
    });
  }

  /** Whether the thread's file is in Codex's home, unread. */
  hasSession(nativeId: string): boolean {
    return hasRollout(this.#codexHome, nativeId);
  }

  /** Codex asks its own reviewer, never the human: no rule to add. */
  allowRule(): string | undefined {
    return undefined;
  }

  /**
   * The models listed for the account, through a short app-server, closed once it answered
   * `model/list`, every page, and `config/read`: rejected when it fails to within 10 seconds. Its
   * process group then gets SIGTERM, and SIGKILL when it still runs 5 seconds after.
   */
  async models(): Promise<ModelList> {
    const server = appServer(
      this.#command,
      homedir(),
      () => {},
      () => {},
    );
    const timer = setTimeout(() => {
      server.rpc.end(`Codex did not list its models within ${MODELS_TIMEOUT_MS / 1000} seconds`);
    }, MODELS_TIMEOUT_MS);
    try {
      await server.started;
      const { config, rows } = await listAndConfig(server.rpc);
      return codexModels(rows, config);
    } finally {
      clearTimeout(timer);
      void server.spawned.then(endShortProcess);
    }
  }

  /**
   * The catalog without sub-agents a workflow session or a sub-session runs on, written afresh as
   * it opens: none for a chat, or without a catalog folder, or when it could not be written.
   */
  async #catalog(options: OpenOptions): Promise<string | undefined> {
    if (options.tools === undefined) {
      return undefined;
    }
    if (this.#catalogs === undefined) {
      process.stderr.write("Codex's sub-agents stay on in this session: no catalog folder\n");
      return undefined;
    }
    const catalog = await this.#catalogs.write(options.cwd);
    return "path" in catalog ? catalog.path : undefined;
  }

  /** The skill folders Codex reads besides its own: Uraeda's, then the extensions'. */
  #skillRoots(options: OpenOptions): Array<string> {
    return [join(this.#pluginDir, "skills"), ...options.skills];
  }

  open(options: OpenOptions): AgentProcess {
    const folder = this.#extensions?.folder;
    if (folder !== undefined) {
      mkdirSync(folder, { recursive: true });
    }
    const events = new EventQueue();
    const names = new Map<string, string>();
    const reader = new CodexEvents(options.cwd, (model) => names.get(model) ?? model);
    const push = (event: AgentEvent) => events.push(event);
    const server = appServer(
      this.#command,
      options.cwd,
      (notification) => {
        for (const event of reader.read(notification)) {
          // The thread's start gives its `init`, once its permissions are checked: Codex's own
          // `thread/started` can come before.
          if (event.type === "init") {
            continue;
          }
          push(event);
          if (event.type === "result") {
            turns.ended(event.ok);
          }
        }
      },
      (exit) => {
        events.push(exit);
        events.end();
      },
      {
        args: this.#catalog(options).then((catalog) => codexServerArgs(options.tools, catalog)),
        env: toolsEnv(options.tools),
      },
    );
    let closing = false;
    const thread = this.#bounded(server, this.#begin(server, options, names)).then(
      ({ defaultEffort, id, model, reasoningEffort }) => {
        // The thread's ID and what it runs on reach the transcript at its start, even when Codex
        // does not report them, as on resume.
        reader
          .read({ method: "thread/started", params: { thread: { id, model, reasoningEffort } } })
          .forEach(push);
        return { id, ...(defaultEffort === undefined ? {} : { defaultEffort }) };
      },
      (error) => {
        if (!closing) {
          push({
            problem: `Codex did not start the session: ${reason(error)}`,
            sessionId: "",
            type: "init",
          });
        }
        return undefined;
      },
    );
    const turns = new CodexTurns(
      {
        endInput: server.endInput,
        input: codexInput,
        push,
        rpc: server.rpc,
        thread,
        turnParams: (message, threadId, effort) =>
          codexTurnParams({ ...message, threadId, ...(effort ? { effort } : {}) }),
      },
      options.effort,
      options.resume,
    );
    return {
      close: () => {
        closing = true;
        turns.close();
      },
      events,
      interrupt: () => turns.interrupt(),
      kill: server.signal,
      send: (message) => turns.send(message),
      // From its next turn on: the runner calls it between turns only (R3).
      setEffort: (effort) => turns.setEffort(effort),
      takeBack: (id) => turns.takeBack(id),
    };
  }

  /**
   * `start`, rejected once it took longer than the start may take, the process then killed: a
   * Codex that never answers fails the turn instead of holding it.
   */
  #bounded<T>(server: AppServer, start: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const late = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Codex did not answer within ${this.#startTimeoutMs / 1000} seconds`));
        server.signal("SIGKILL");
      }, this.#startTimeoutMs);
    });
    return Promise.race([start, late]).finally(() => clearTimeout(timer));
  }

  /**
   * Introduces the client, gives the skill folders, reads the model names for what the thread
   * runs on and the agent's default effort, then starts or resumes the thread: its ID.
   */
  async #begin(
    { rpc, started }: AppServer,
    options: OpenOptions,
    names: Map<string, string>,
  ): Promise<{ defaultEffort?: string; id: string; model?: string; reasoningEffort?: string }> {
    await started;
    await rpc.request("skills/extraRoots/set", { extraRoots: this.#skillRoots(options) });
    // Without the names, what it runs on shows by IDs.
    const listed = await listAndConfig(rpc).catch(() => undefined);
    const config =
      isJson(listed?.config) && isJson(listed.config.config) ? listed.config.config : {};
    // The session's model's defaults, the configured effort first.
    const model = options.model === undefined ? {} : { model: options.model };
    const list = listed && codexModels(listed.rows, { config: { ...config, ...model } });
    for (const { id, name } of list?.models ?? []) {
      names.set(id, name);
    }
    // Unread settings give no trust: Codex then decides it, and may write it.
    const trust = listed && codexTrust(options.cwd, gitMainRoot(options.cwd), config.projects);
    const method = options.resume ? "thread/resume" : "thread/start";
    const answer = await rpc.request(
      method,
      codexThreadParams(options, codexInstructions(this.#extensions), trust),
    );
    const id = isJson(answer) && isJson(answer.thread) ? textOf(answer.thread.id) : undefined;
    if (id === undefined) {
      throw new Error(`${method} gave no thread`);
    }
    // Codex's settings could still widen what it was asked for: it runs only as asked (R23).
    const problem = appliedProblem(answer);
    if (problem !== undefined) {
      throw new Error(problem);
    }
    const defaultEffort = list?.defaults.effort;
    // What the thread runs on, from the answer: Codex sends no settings update on resume.
    const ran = isJson(answer) ? answer : {};
    const ranModel = textOf(ran.model);
    const reasoningEffort = textOf(ran.reasoningEffort);
    return {
      id,
      ...(defaultEffort === undefined ? {} : { defaultEffort }),
      ...(ranModel === undefined ? {} : { model: ranModel }),
      ...(reasoningEffort === undefined ? {} : { reasoningEffort }),
    };
  }
}
