import type { Previews } from "../preview/runner.ts";
import type { Hosts } from "../repositories.ts";
import type { Sessions } from "../runner/sessions.ts";
import type { ServerSettings } from "../settings.ts";
import type { FrameSecret } from "../sign-in/frames.ts";
import { callSiteError } from "./errors.ts";

/** The binding, as the server loads it. */
export type Binding = typeof import("uraeda-binding");

/**
 * fate's request context: the repository the server reads and writes, through the binding, null on
 * the global endpoint; the session manager that talks to agents about its features; the hosts of
 * every listed repository; the data folder holding their list; the server's Storybooks; and the
 * frame secret their paths carry; the settings in force. `lockedList` locks the list, as Uraeda's own Storybook does: see
 * `unlockedList`.
 */
export type Context = {
  binding: Binding;
  dataDir: string;
  frames: FrameSecret;
  hosts: Hosts;
  lockedList?: boolean;
  previews: Previews;
  repo: string | null;
  sessions: Sessions;
  settings: ServerSettings;
};

/** The context of a repository's endpoint, `/r/<name>/fate`. */
export type RepoContext = Context & { repo: string };

/** A repository's mutation's arguments: see `repositoryOnly` in `mutations.ts`. */
export type Resolver<Input> = { ctx: RepoContext; input: Input; select: Array<string> };

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

/**
 * Refuses a change of the list, or a folder suggestion, on a server whose list is locked: it serves
 * the repositories it started with, and reaches no other folder.
 */
export function unlockedList(ctx: Context) {
  if (ctx.lockedList) {
    throw callSiteError("refused: this server's list is locked");
  }
}
