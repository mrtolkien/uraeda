import { Chain } from "./chain.ts";
import { CONTINUES_ON, Continuer } from "./continuer.ts";
import { LiveSessions } from "./live-sessions.ts";
import { Processes } from "./processes.ts";
import { runsOn } from "./runtimes.ts";
import type { SessionContext, SessionsOptions } from "./session-state.ts";
import { SubSessions } from "./sub-sessions.ts";
import { Transcript } from "./transcript.ts";
import { Turns } from "./turns.ts";

/** What the context asks of the accounts' refresh, which is made once the context is. */
type AccountHooks = Pick<SessionContext, "agentChanged" | "refreshAccounts">;

/**
 * The context the sessions' parts share, with every part made: each reaches the others through it.
 * A change of a held session waits in its hold, and every other goes to the options' `onChange`.
 */
export function sessionContext(options: SessionsOptions, accounts: AccountHooks): SessionContext {
  const context = {
    ...accounts,
    binding: options.binding,
    cache: options.cache,
    changed: (live, turn, state) => {
      if (live.held) {
        live.held.changes.push([turn, state]);
        return;
      }
      options.onChange({
        folder: live.folder,
        repo: live.repo,
        session: live.id,
        ...(turn === undefined ? {} : { turn }),
        ...(state === undefined ? {} : { state }),
      });
    },
    live: new LiveSessions(),
    ...(options.mcp === undefined ? {} : { mcp: options.mcp }),
    queue: options.queue ?? (() => undefined),
    runOptions: options.runOptions ?? (() => ({ steps: [] })),
    runtimes: options.runtimes,
  } as SessionContext;
  context.processes = new Processes(context);
  context.turns = new Turns(context);
  context.transcript = new Transcript(context);
  context.chain = new Chain(context);
  const { runtimes } = options;
  context.continuer = new Continuer(context, {
    available: (row) => runsOn(runtimes, row),
    hosted: options.hosted ?? (() => true),
    runs: options.runs ?? (() => CONTINUES_ON),
  });
  context.subSessions = new SubSessions(context);
  return context;
}
