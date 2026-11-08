// The types an extension's server code imports as `uraeda/server`: the server API its entry's
// default export is called with, the runtime contract, and the events' payloads. Types only: the
// API itself is the object the entry receives.
import type { Context as HonoContext } from "hono";
import type { Adapter } from "./runner/adapter.ts";

export type {
  Adapter as Runtime,
  AgentProcess,
  Capabilities,
  OpenOptions,
} from "./runner/adapter.ts";
export type { AgentEvent, UsageWindow } from "./runner/events.ts";

/** What every event carries: the repository it happened in, by name, and when, in ISO 8601. */
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
 * The server API: the one object an extension's server code receives. Every call checks that the
 * version calling it is still loaded, and throws `<name>: this version of the extension was
 * unloaded` otherwise; everything it registers is undone when that version unloads. Callbacks
 * that throw or reject are reported under the extension's name and never reach Uraeda's callers;
 * a record, an action, or a route that does not answer in 10 s answers `no answer in 10 s`.
 */
export type ServerApi = {
  /** Registers the action `name`, which pages call through fate, in a repository it is on in. */
  action<I, O>(name: string, run: (input: I, repository: string) => O | Promise<O>): void;
  /** Prints `message` to the server's output, after the extension's name. */
  log(message: string): void;
  /** Calls `handler` with each event of that name in a repository the extension is on in. */
  on<E extends EventName>(event: E, handler: (payload: Events[E]) => void | Promise<void>): void;
  /**
   * Registers the data record `name`, read through fate as `ExtensionRecord` `<extension>/<name>`,
   * only for the repositories the extension is on in; its value must be JSON. `changed` sends its
   * live update, to one repository's pages or every one's.
   */
  record<T>(
    name: string,
    read: (repository: string) => T | Promise<T>,
  ): { changed(repository?: string): void };
  /** The repositories the extension is on in. */
  repositories(): ReadonlyArray<ApiRepository>;
  /**
   * Registers a route at `path`, which must start with `/x/<extension>/`; a path ending in `/*`
   * takes every path under it. It answers at `path` and under each repository's `/r/<name>`, the
   * repository then given, only where the extension is on; every route needs a signed-in session,
   * and refuses a request another site sent. Without `method`, it answers GET and POST; a GET route
   * answers HEAD too. A handler that does not answer in 10 s answers 504.
   */
  route(
    path: string,
    handler: (c: HonoContext, repository: string | null) => Response | Promise<Response>,
    method?: "GET" | "POST",
  ): void;
  /** Registers an agent runtime, under the extension's name. */
  runtime(runtime: Adapter): void;
  /** The extension's settings: a repository's by name, none where it is off; every one's for null. */
  settings(repository: string | null): Record<string, unknown>;
};
