// What an extension's server code sees: the server API its entry's default export is called
// with, the modules it imports by name, and the globals of its VM. Uraeda strips types and
// never checks them: this file is for an editor and for the agent that writes an extension.
//
// An extension's `tsconfig.json` reads it as one of its files, without the DOM's types, whose
// `fetch` and timers these replace:
//
//   { "compilerOptions": { "lib": ["es2023"], "types": [] }, "include": [".", "<this file>"] }
//
// Server code runs in a VM of its own inside Uraeda's server, on QuickJS: no Node, no `node:`
// module, and no npm package. It imports its own files by relative paths, and `uraeda/server`,
// `uraeda:fs`, and `uraeda:process`.

declare module "uraeda/server" {
  /** What every event carries: the repository it happened in, by name, and when, in RFC 3339. */
  type EventBase = { repository: string; time: string };

  /** The events an extension may listen to, by name, with their payloads. */
  export type Events = {
    /** The main checkout's `HEAD` moved to another commit, on `branch`, null when detached. */
    "commit-landed": EventBase & { branch: string | null; commit: string };
    /** A session was made, on the runtime of this name. */
    "session-started": EventBase & { runtime: string; session: string };
    /**
     * A feature or a change reached a step: `step` is the step's name, like `plan`, or at a human
     * gate the kind of the file waiting for the human, like `spec`; `waitsOn` says who acts next.
     */
    "step-reached": EventBase & {
      feature: string;
      step: string;
      waitsOn: "agent" | "human" | "nobody";
    };
    /** A session's turn ended: done, failed, or stopped; `feature` is null for a chat. */
    "turn-ended": EventBase & {
      feature: string | null;
      session: string;
      state: "done" | "failed" | "stopped";
    };
  };

  export type EventName = keyof Events;

  /** A repository of Uraeda's list, by its name and its main checkout's path. */
  export type ApiRepository = { name: string; path: string };

  /**
   * A request to a route: its method, its path as the route was registered, without a
   * repository's `/r/<name>`, its query, its headers, and its body.
   */
  export interface RouteRequest {
    arrayBuffer(): Promise<ArrayBuffer>;
    bytes(): Promise<Uint8Array>;
    readonly headers: Headers;
    json(): Promise<unknown>;
    readonly method: string;
    readonly path: string;
    /** The query's values by name, the last of a name given twice. */
    readonly query: Record<string, string>;
    text(): Promise<string>;
    readonly url: string;
  }

  /** What a route answers: a `Response`, a text, or any other value, sent as JSON. */
  export type RouteAnswer = Response | string | unknown;

  /**
   * The server API: the one object an extension's server code receives, as its entry's default
   * export is called, once each time the extension loads. The activation is synchronous, and has
   * 2 seconds. Everything it registers, and everything it starts, a timer, a process, a `fetch`,
   * is gone when the extension unloads: at a save, when it is turned off, and when the server
   * stops.
   *
   * A record, an action, or a route has 10 seconds to answer, and any piece of the extension's
   * code 10 seconds to run. A piece that runs over them, a timer's callback that throws, and a
   * rejection nothing handles turn the extension off, as broken, until its files or its settings
   * change.
   */
  export type ServerApi = {
    /**
     * Registers the action `name`, which a page calls as `extensions.act`, in a repository the
     * extension is on in. Its input and its output are JSON. What it throws is the action's
     * refusal.
     */
    action<I, O>(name: string, run: (input: I, repository: string) => O | Promise<O>): void;
    /** Prints `message` to the server's output, after the extension's name. */
    log(message: string): void;
    /** Calls `handler` with each event of that name in a repository the extension is on in. */
    on<E extends EventName>(event: E, handler: (payload: Events[E]) => void | Promise<void>): void;
    /**
     * Registers the data record `name`, which a page reads as `ExtensionRecord`, only for the
     * repositories the extension is on in; its value is JSON. `changed` sends it again, to one
     * repository's readers or to every one's. What its read throws reaches the reader as the
     * record's error.
     */
    record<T>(
      name: string,
      read: (repository: string) => T | Promise<T>,
    ): { changed(repository?: string): void };
    /** The repositories the extension is on in. */
    repositories(): ReadonlyArray<ApiRepository>;
    /**
     * Registers a route at `path`, which starts with `/x/<extension>/`; a path ending in `/*`
     * takes every path under it. It answers at `path`, `repository` then null, and under each
     * repository's `/r/<name>`, where the extension is on. Every route needs a signed-in client,
     * and refuses a request another site sent. Without `method`, it answers GET and POST; a GET
     * route answers HEAD too. One that throws answers 500, and one that does not answer in 10
     * seconds 504.
     */
    route(
      path: string,
      handler: (
        request: RouteRequest,
        repository: string | null,
      ) => RouteAnswer | Promise<RouteAnswer>,
      method?: "GET" | "POST",
    ): void;
    /** Registers an agent runtime, under the extension's name: one for an extension. */
    runtime(runtime: Runtime): void;
    /**
     * The extension's settings, defaults filled in: a repository's by name, `{}` where it is
     * off; every repository's for null.
     */
    settings(repository: string | null): Record<string, unknown>;
  };

  // The runtime contract: what every agent is reached through.

  /** What an agent can do, which a client offers and nothing more. */
  export type Capabilities = {
    /** The agent asks before an action, instead of skipping it. */
    approvals: boolean;
    /** The agent opens the images sent with a message, by their paths. */
    images: boolean;
    /** A message sent during a turn waits for the next one. */
    queue: boolean;
    /** A message sent during a turn joins it. */
    steer: boolean;
    /** The agent reports its sub-agents and their tools. */
    subagents: boolean;
    /** A message not read yet can be taken back. */
    takeBack: boolean;
  };

  /** An effort a model takes: the agent's id for it, and its name for people. */
  export type ModelEffort = { id: string; name: string };

  /** A model the agent lists for the account. */
  export type AgentModel = {
    description?: string;
    /** The efforts it takes, in the agent's order: empty for none. */
    efforts: Array<ModelEffort>;
    /** The agent's id, which a session stores as its model. */
    id: string;
    name: string;
  };

  /** The models a runtime lists, and what the agent runs on when none is picked, by their ids. */
  export type ModelList = {
    defaults: { effort?: string; model?: string };
    models: Array<AgentModel>;
  };

  /** A usage window of an account: no reset while the window is not open. */
  export type AccountWindow = { id: string; label: string; resetsAt: string | null; used: number };

  /** Whether an account can run a session: signed in, signed out, or without its folder. */
  export type AccountState = "ready" | "signed-out" | "missing";

  /** An account a runtime offers. `windows` are shortest first. */
  export type Account = {
    /**
     * When its windows were last read, in milliseconds since 1970: null while they never were.
     * Kept after an ask that could not read them, as `windows` are.
     */
    askedAt: number | null;
    /** What a session stores as its account. */
    id: string;
    /** Whether its usage is known: false while never read, or while its last ask failed. */
    known: boolean;
    name: string;
    state: AccountState;
    windows: Array<AccountWindow>;
  };

  /**
   * The accounts a runtime offers, an optional part of its contract: a new session starts on
   * the one with the most of its first window left, and keeps it until a usage limit moves it.
   */
  export interface Accounts {
    /** The accounts as last asked, in the listed order. */
    list(): ReadonlyArray<Account>;
    /** The name of the account `id`, listed or not. */
    nameOf(id: string): string;
    /** What needs the human, in the runtime's words, shown in the settings. */
    problems(): ReadonlyArray<string>;
    /** Asks again each account whose last ask is older than `maxAgeMs`; settles once answered. */
    refresh(maxAgeMs: number): void | Promise<void>;
  }

  /** How to open a session's process. */
  export type OpenOptions = {
    /** The account to run on, by its id: none for the agent's own login. */
    account?: string;
    /** The allow rules for this process only. */
    allowed: ReadonlyArray<string>;
    /** The feature's worktree, or the main checkout. */
    cwd: string;
    /** The effort to run on, by the agent's id: none for the agent's default. */
    effort?: string;
    /** The model to run on, by the agent's id: none for the agent's default. */
    model?: string;
    /**
     * The agent's own session id. An agent that picks its own, when not resuming, reports it in
     * its first `init`, which the session adopts.
     */
    nativeId: string;
    /** Resume `nativeId`, or start a new session with it. */
    resume: boolean;
    /** The skill folders to give the agent, beside Uraeda's own. */
    skills: ReadonlyArray<string>;
    /**
     * Uraeda's tools, which start sub-agents as sessions: for a workflow session, the MCP
     * endpoint's URL and this process's token, given in place of the agent's own sub-agents; for
     * a sub-session, `"none"`, neither. A chat has none set, and keeps the agent's own.
     */
    tools?: { token: string; url: string } | "none";
  };

  /** A message sent to an agent: steered into its turn, or queued after it. */
  export type Outgoing = {
    id: string;
    /** Its chat images, by their files. */
    images: Array<{ path: string }>;
    /** The text is the instructions of a review the agent runs as its own. */
    review?: boolean;
    text: string;
    when: "steer" | "queue";
  };

  /** An action the agent's permissions blocked, as a turn's result reports it. */
  export type Denial = { input: Record<string, unknown>; tool: string };

  /** A review an agent runs: the commits `<base>..<head>`. */
  export type ReviewAsk = { base: string; effort?: string; head: string; instructions?: string };

  /** A usage window of the account: `used` from 0 to 1. */
  export type UsageWindow = { id: string; label: string; resetsAt: string; used: number };

  /** What a tool call does, which decides how it is drawn. */
  export type ToolKind =
    | "delete"
    | "edit"
    | "execute"
    | "fetch"
    | "move"
    | "other"
    | "read"
    | "search"
    | "think";

  /** One event of a process, in order: `exit` is the last. */
  export type AgentEvent =
    | { problem?: string; sessionId: string; type: "init" }
    | { effort?: string; model: string; type: "runsOn" }
    | { text: string; type: "notice" }
    | { text: string; type: "textDelta" }
    | { text: string; type: "text" }
    | {
        activity: { kind: "thinking" } | { kind: "tool"; name: string; target?: string };
        type: "activity";
      }
    | { parent?: string; text?: string; type: "thought" }
    | {
        id: string;
        input?: Record<string, unknown>;
        kind: ToolKind;
        name: string;
        parent?: string;
        subagent?: { description: string };
        target?: string;
        type: "toolStart";
      }
    | { id: string; isError: boolean; output: string; type: "toolEnd" }
    | { id: string; type: "accepted" }
    | { id: string; type: "cancelled" }
    | { attempt: number; delayMs: number; error: string; type: "retry" }
    | { type: "usage"; windows: Array<UsageWindow> }
    | { tasks: Array<{ kind: "command" | "subagent"; tool: string }>; type: "background" }
    | { limit: { kind: "other" | "session"; resetsAt?: string; text?: string }; type: "limit" }
    | { at: string; type: "wakeup" }
    | {
        total: { cacheRead: number; cacheWrite: number; input: number; output: number };
        type: "tokens";
      }
    | {
        costUsd?: number;
        denials: Array<Denial>;
        errors: Array<string>;
        interrupted: boolean;
        models?: Array<string>;
        ok: boolean;
        type: "result";
      }
    | { code: number | null; missing?: boolean; stderr: string; type: "exit" };

  /** A session's open process, which takes messages until it is closed. */
  export interface AgentProcess {
    /** Ends the process once its turn is over: its `exit` follows. */
    close(): void;
    /** Its events, in order, ending with its `exit`. */
    events: AsyncIterable<AgentEvent>;
    /** Ends the running turn through the agent's own interrupt, and keeps the process. */
    interrupt(): void;
    /** Signals the process, and the processes it started. */
    kill(signal: "SIGINT" | "SIGTERM" | "SIGKILL"): void;
    send(message: Outgoing): void;
    /**
     * Changes the effort it runs on, from its next turn on: undefined for the agent's default. A
     * process without it is reopened with the new effort.
     */
    setEffort?(effort: string | undefined): void;
    /** Takes back a message the agent has not read: its `cancelled` says it was. */
    takeBack(id: string): void;
  }

  /** An agent runtime: the one interface an agent is reached through. */
  export interface Runtime {
    /** The narrowest rule that allows a blocked action, or undefined when none does alone. */
    allowRule(denial: Denial): string | undefined;
    readonly capabilities: Capabilities;
    /** The accounts the agent runs on, when it offers several. */
    readonly accounts?: Accounts;
    /** Whether the agent still has the session's transcript, in its account if it has one. */
    hasSession(nativeId: string, account?: string): boolean;
    /** The icon of its mark, a name of the app's icon set. */
    readonly icon: string;
    /** The agent's own kind, like "claude". */
    readonly kind: string;
    /** The models the agent lists, offered where a session starts. */
    models?(): ModelList | Promise<ModelList>;
    /** The agent's name, for people. */
    readonly name: string;
    /** Opens a session's process. It never throws: a process that cannot run says so as its exit. */
    open(options: OpenOptions): AgentProcess;
    /** The message that runs a review through the agent's own review, when it has one. */
    reviewMessage?(ask: ReviewAsk): { review?: boolean; text: string } | undefined;
    /** The agent's version, or undefined when it is not available on this machine. */
    version(): string | undefined | Promise<string | undefined>;
  }
}

/**
 * The owner's files, read and written whole. An extension reaches any path its owner does. Every
 * path is absolute, and each call runs on the extension's own thread: it holds the extension's
 * other calls until it returns, and nothing of Uraeda's. A path that is neither a file nor a
 * folder, like a pipe, is refused.
 */
declare module "uraeda:fs" {
  /** What a path leads to. */
  export type Kind = "file" | "folder" | "other";

  /** Adds a text to the end of a file, made when it is not there. */
  export function appendText(path: string, text: string): void;
  /** Whether something is at the path. */
  export function exists(path: string): boolean;
  /** The parts as one path, without its `.` and `..` parts: an absolute part starts over. */
  export function join(...parts: Array<string>): string;
  /** A folder's entries, by name: a link is not followed. */
  export function list(path: string): Array<{ kind: Kind | "link"; name: string }>;
  /** Makes a folder, and the folders above it. */
  export function makeFolder(path: string): void;
  /** A path's last part. */
  export function name(path: string): string;
  /** The folder a path is in. */
  export function parent(path: string): string;
  export function readBytes(path: string): Uint8Array;
  /** A file's text: one that is not UTF-8 is refused. */
  export function readText(path: string): string;
  /** The path from a folder to a path, as written. */
  export function relative(from: string, to: string): string;
  /** Removes a file, a link, or a folder with everything in it. */
  export function remove(path: string): void;
  export function rename(from: string, to: string): void;
  /** What a path leads to, a link followed, with its size and when it changed: null for nothing. */
  export function stat(path: string): { kind: Kind; modified: number | null; size: number } | null;
  export function writeBytes(path: string, bytes: Uint8Array | ArrayBuffer): void;
  export function writeText(path: string, text: string): void;
}

/**
 * Commands the server runs for the extension, in the server's environment, each leading a
 * process group of its own. One still running when the extension unloads is ended, with
 * everything it started.
 */
declare module "uraeda:process" {
  /** How a command starts: its folder, the extension's own without one, and its own variables. */
  export type Options = { cwd?: string; env?: Record<string, string> };

  /** How a command ended: `missing` when it was not found, and the end of its stderr. */
  export type Exit = { code: number | null; missing: boolean; stderr: string };

  /** A running command. */
  export interface ChildProcess {
    /** Closes its stdin. */
    endInput(): void;
    readonly exited: Promise<Exit>;
    /** Signals it, and what it started: `SIGTERM` without a signal. */
    kill(signal?: "SIGINT" | "SIGTERM" | "SIGKILL"): void;
    /** Calls `handler` with each line of its stdout, the blank ones left out. */
    onLine(handler: (line: string) => void): void;
    /** The process that leads its group: null for a command that did not start. */
    readonly pid: number | null;
    /** Writes a value as one line of JSON to its stdin. */
    write(value: unknown): void;
  }

  /** Starts a command. It never throws: one that cannot start says so as its exit. */
  export function spawn(command: string, args?: Array<string>, options?: Options): ChildProcess;

  /** Runs a command to its end, its stdin closed: its exit, and the lines of its stdout. */
  export function run(
    command: string,
    args?: Array<string>,
    options?: Options,
  ): Promise<Exit & { lines: Array<string> }>;
}

// The globals of an extension's VM, beside JavaScript's own.

/** A request's or an answer's headers, by name, whatever its case. */
declare class Headers implements Iterable<[string, string]> {
  constructor(init?: Headers | Array<[string, string]> | Record<string, string>);
  append(name: string, value: string): void;
  delete(name: string): void;
  entries(): IterableIterator<[string, string]>;
  forEach(callback: (value: string, name: string, headers: Headers) => void): void;
  get(name: string): string | null;
  has(name: string): boolean;
  keys(): IterableIterator<string>;
  set(name: string, value: string): void;
  values(): IterableIterator<string>;
  [Symbol.iterator](): IterableIterator<[string, string]>;
}

/** An answer: `fetch`'s, or a route's. Its body is held whole. */
declare class Response {
  constructor(
    body?: string | Uint8Array | ArrayBuffer | null,
    init?: {
      headers?: ConstructorParameters<typeof Headers>[0];
      status?: number;
      statusText?: string;
    },
  );
  /** An answer whose body is `value` as JSON. */
  static json(value: unknown, init?: ConstructorParameters<typeof Response>[1]): Response;
  readonly headers: Headers;
  readonly ok: boolean;
  readonly status: number;
  readonly statusText: string;
  arrayBuffer(): Promise<ArrayBuffer>;
  bytes(): Promise<Uint8Array>;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

/**
 * Sends a request from the server, and gives its whole answer, whatever its status: within 30
 * seconds, and 64 MB. It rejects when the request cannot be sent or answered.
 */
declare function fetch(
  url: string,
  init?: {
    body?: string | Uint8Array | ArrayBuffer | null;
    headers?: ConstructorParameters<typeof Headers>[0];
    method?: string;
  },
): Promise<Response>;

/** A timer of the extension's own: its callback never runs once the extension unloaded. */
declare function setTimeout<A extends Array<unknown>>(
  callback: (...args: A) => void,
  ms?: number,
  ...args: A
): number;
declare function setInterval<A extends Array<unknown>>(
  callback: (...args: A) => void,
  ms?: number,
  ...args: A
): number;
declare function clearTimeout(id: number | undefined): void;
declare function clearInterval(id: number | undefined): void;
declare function queueMicrotask(callback: () => void): void;

/** Each line goes to the server's output, after the extension's name. */
declare const console: {
  debug(...values: Array<unknown>): void;
  error(...values: Array<unknown>): void;
  info(...values: Array<unknown>): void;
  log(...values: Array<unknown>): void;
  warn(...values: Array<unknown>): void;
};

declare class TextEncoder {
  encode(text?: string): Uint8Array;
}

declare class TextDecoder {
  /** The bytes as UTF-8 text. */
  decode(bytes?: Uint8Array | ArrayBuffer): string;
}
