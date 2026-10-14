import type { Hosts } from "../repositories.ts";
import type { Sessions } from "../runner/sessions.ts";
import { callSiteError } from "./errors.ts";

/** The binding, as the server loads it. */
export type Binding = typeof import("uraeda-binding");

/**
 * fate's request context: the repository the server reads and writes, through the binding, null on
 * the global endpoint; the session manager that talks to agents about its features; the hosts of
 * every listed repository; and the data folder holding their list.
 */
export type Context = {
  binding: Binding;
  sessions: Sessions;
  hosts: Hosts;
  dataDir: string;
  repo: string | null;
};

/** The context of a repository's endpoint, `/r/<name>/fate`. */
export type RepoContext = Context & { repo: string };

/**
 * The context of a repository's endpoint, or the refusal of a repository's record or mutation on
 * the global endpoint: a stale client never reads another repository's.
 */
export function inRepository(ctx: Context): RepoContext {
  if (ctx.repo === null) {
    throw callSiteError("refused: no repository");
  }
  return ctx as RepoContext;
}
