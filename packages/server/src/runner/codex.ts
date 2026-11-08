import { execFile } from "node:child_process";
import { mkdirSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  Adapter,
  AgentModel,
  AgentProcess,
  Capabilities,
  ModelList,
  OpenOptions,
  Outgoing,
} from "./adapter.ts";
import {
  type Child,
  endShortProcess,
  EventQueue,
  lines,
  MODELS_TIMEOUT_MS,
  spawnGrouped,
} from "./child.ts";
import { CodexEvents, type CodexNotification } from "./codex-events.ts";
import { appliedProblem, codexTrust, gitMainRoot } from "./codex-permissions.ts";
import { CodexRpc } from "./codex-rpc.ts";
import { CodexTurns } from "./codex-turns.ts";
import { effortName } from "./efforts.ts";
import type { AgentEvent } from "./events.ts";
import { type ExtensionPaths, webUiInstructions } from "./instructions.ts";

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

/**
 * The sandbox's section of the instructions: what Codex cannot do without escalating, so it asks
 * its reviewer instead of failing, or working around the sandbox. The extensions folder is not
 * writable: Uraeda runs what it holds, so each write there is reviewed first (R22).
 */
function sandboxSection(extensions: string | undefined): string {
  const folder =
    extensions === undefined
      ? ""
      : ` Writing in \`${extensions}\`, your extensions folder, needs escalated permissions too, from its first try.`;
  return `
# Sandbox

Your commands run in a sandbox: you write in the working directory only, git's own folder is read-only, and the network is off. So run every git command that writes, as \`git add\`, \`git commit\`, \`git mv\`, and \`git worktree add\`, and every command that uses the network, as \`git push\` and \`gh\`, with escalated permissions from its first try (\`sandbox_permissions: "require_escalated"\`, with a one-line justification): a reviewer approves each before it runs, and you are allowed to ask.${folder} Never work around the sandbox, and never stop at a git command the sandbox refused: run it again with escalated permissions.
`;
}

/** The developer instructions of every thread: the web UI's, then the sandbox's. */
export function codexInstructions(extensions?: ExtensionPaths): string {
  return `${webUiInstructions(extensions)}${sandboxSection(extensions?.folder)}`;
}

/**
 * The parameters of a session's `thread/start`, or `thread/resume` when resuming: the model when
 * picked, the session's directory, and Codex's permissions, its `workspace-write` sandbox, its
 * approvals on request, reviewed by its automatic reviewer. The one configuration override is the
 * trust of the session's directory, when known, the level Codex would apply itself: without it,
 * Codex writes it to the user's settings (R24). Never another, which could widen the permissions.
 */
export function codexThreadParams(options: OpenOptions, instructions: string, trust?: string) {
  return {
    approvalPolicy: "on-request",
    approvalsReviewer: "auto_review",
    ...(trust === undefined
      ? {}
      : { config: { projects: { [options.cwd]: { trust_level: trust } } } }),
    cwd: options.cwd,
    developerInstructions: instructions,
    sandbox: "workspace-write",
    ...(options.model === undefined ? {} : { model: options.model }),
    // A resumed thread's turns stay unread: the transcript has them.
    ...(options.resume ? { excludeTurns: true, threadId: options.nativeId } : {}),
  };
}

/** A message's input items: its text, then its images by their paths. */
export function codexInput({ images, text }: Pick<Outgoing, "images" | "text">) {
  return [
    ...(text === "" ? [] : [{ text, text_elements: [], type: "text" }]),
    ...images.map(({ path }) => ({ path, type: "localImage" })),
  ];
}

/** A turn to start: its thread, its message, and the effort when set. */
export type CodexTurn = Pick<Outgoing, "images" | "text"> & { effort?: string; threadId: string };

/**
 * The parameters of a `turn/start`: the message, the effort when set, and the sandbox's policy,
 * which writes only the session's directory, the network off: no other writable root (R22).
 */
export function codexTurnParams({ effort, threadId, ...message }: CodexTurn) {
  return {
    input: codexInput(message),
    sandboxPolicy: {
      excludeSlashTmp: false,
      excludeTmpdirEnvVar: false,
      networkAccess: false,
      type: "workspaceWrite",
      writableRoots: [],
    },
    threadId,
    ...(effort === undefined ? {} : { effort }),
  };
}

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

/** A running `codex app-server`, its channel, and its lines read as they come. */
type AppServer = Child & { rpc: CodexRpc; started: Promise<unknown> };

/**
 * Starts `codex app-server` in `cwd`, in a process group of its own, and introduces the client:
 * `initialize`, asking for the experimental API, then `initialized`. Each notification goes to
 * `heard`, and `ended` runs once its output closed, with the exit event.
 */
function appServer(
  command: string,
  cwd: string,
  heard: (notification: CodexNotification) => void,
  ended: (exit: Extract<AgentEvent, { type: "exit" }>) => void,
): AppServer {
  const child = spawnGrouped(command, ["app-server"], cwd);
  const rpc = new CodexRpc(child.write);
  void (async () => {
    try {
      for await (const line of lines(child.child.stdout)) {
        const notification = rpc.read(line);
        if (notification !== undefined) {
          heard(notification);
        }
      }
    } catch {
      // A process that failed to start has no output.
    }
    const exit = await child.exited;
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
  return { ...child, rpc, started };
}

export type CodexAdapterOptions = {
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
  #command: string;
  #codexHome: string;
  #extensions: ExtensionPaths | undefined;
  #pluginDir: string;
  #startTimeoutMs: number;

  constructor({
    codexHome = process.env.CODEX_HOME ?? join(homedir(), ".codex"),
    command = "codex",
    extensions,
    pluginDir,
    startTimeoutMs = START_TIMEOUT_MS,
  }: CodexAdapterOptions) {
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

  /** Looks for the thread's file, `<codexHome>/sessions/**\/rollout-*-<id>.jsonl`, unread. */
  hasSession(nativeId: string): boolean {
    let files: Array<string>;
    try {
      files = readdirSync(join(this.#codexHome, "sessions"), { encoding: "utf8", recursive: true });
    } catch {
      return false;
    }
    const end = `-${nativeId}.jsonl`;
    return files.some((file) => {
      const name = file.slice(file.lastIndexOf("/") + 1);
      return name.startsWith("rollout-") && name.endsWith(end);
    });
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
      endShortProcess(server);
    }
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
        endInput: () => server.child.stdin.end(),
        input: codexInput,
        push,
        rpc: server.rpc,
        thread,
        turnParams: (message, threadId, effort) =>
          codexTurnParams({ ...message, threadId, ...(effort ? { effort } : {}) }),
      },
      options.effort,
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
