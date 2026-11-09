// The catcher: with the switch on, each open pull request behind the default branch gets its
// catch-up's run by itself, once per tip of the default branch (US2 of agents-fix). It runs on each
// watcher burst and each turn's end in a repository, and on each change of the switch.
import type { CatchUpView, FeatureView } from "uraeda-binding";
import { continueOne } from "./fate/continue-all.ts";
import type { RepoContext } from "./fate/context.ts";
import { type FeatureStatus, featureStatuses } from "./fate/feature-status.ts";
import { reasonOf } from "./reason.ts";
import { catchUpLine } from "./runner/message.ts";
import { CATCH_UP } from "./runner/status.ts";

/** The catcher's triggers, and its stop. */
export type CatchUps = {
  /** Catches up the repository's features: after a watcher burst, or a turn's end there. */
  run(repo: string): Promise<void>;
  /** Catches up every hosted repository: the switch changed. */
  runAll(): Promise<void>;
  stop(): void;
};

/** A repository's runs: the one running, and the one asked meanwhile, which runs once after it. */
type Runs = { next?: Promise<void>; running?: Promise<void> };

/**
 * What the feature catches up with now, and the session it goes on in, when the catcher starts its
 * run: at `catch-up`, its latest session idle or with a new reply (R3), and no turn of the folder
 * caught up with that commit yet, whatever started it (R1).
 */
function due(
  ctx: RepoContext,
  root: string,
  { feature, status }: { feature: FeatureView; status: FeatureStatus },
): { catchUp: CatchUpView; session: string } | undefined {
  const { catchUp, name } = feature.step;
  const { session } = status;
  if (name !== CATCH_UP || catchUp === undefined || session === null) {
    return undefined;
  }
  if (status.status !== "idle" && status.status !== "unread") {
    return undefined;
  }
  const caughtUp = ctx.sessions.cache.caughtUp(root, feature.folder, catchUp.commit);
  return caughtUp ? undefined : { catchUp, session };
}

/**
 * Starts the catcher. A run reads the repository's features, a fresh `context` each time, and,
 * while `enabled()`, sends each one due its catch-up's message, with the line saying why, in its
 * latest session. A repository's runs go one at a time: a run asked meanwhile runs once after it,
 * so two triggers at once start one catch-up. A refusal leaves the feature, printed once per
 * feature and commit; the next trigger tries again.
 */
export function startCatchUps(options: {
  context: (repo: string) => RepoContext;
  enabled: () => boolean;
  repos: () => Array<string>;
}): CatchUps {
  let stopped = false;
  const on = () => !stopped && options.enabled();
  const printed = new Set<string>();
  const once = async (repo: string) => {
    if (!on()) {
      return;
    }
    const ctx = options.context(repo);
    const root = await ctx.sessions.mainRoot(repo);
    for (const read of await featureStatuses(ctx)) {
      const catching = due(ctx, root, read);
      // The switch turned off, or the server stopping, during the run starts no other.
      if (catching === undefined || !on()) {
        continue;
      }
      const { catchUp, session } = catching;
      const { feature } = read;
      const automatic = {
        line: catchUpLine(catchUp),
        step: CATCH_UP,
        trigger: "catch-up" as const,
      };
      try {
        await continueOne(ctx, root, feature, session, automatic);
      } catch (error) {
        const key = `${root}\0${feature.folder}\0${catchUp.commit}`;
        if (!printed.has(key)) {
          printed.add(key);
          process.stderr.write(
            `uraeda: the catch-up of ${feature.folder} was refused: ${reasonOf(error)}\n`,
          );
        }
      }
    }
  };
  const safely = (repo: string) =>
    once(repo).catch((error: unknown) => {
      process.stderr.write(`uraeda: the catch-ups of ${repo} stopped: ${reasonOf(error)}\n`);
    });
  const runs = new Map<string, Runs>();
  const run = (repo: string): Promise<void> => {
    let at = runs.get(repo);
    if (at === undefined) {
      at = {};
      runs.set(repo, at);
    }
    const of = at;
    if (of.next !== undefined) {
      return of.next;
    }
    const start = () => {
      const running = safely(repo).finally(() => {
        if (of.running === running) {
          of.running = undefined;
        }
      });
      of.running = running;
      return running;
    };
    if (of.running === undefined) {
      return start();
    }
    const next = of.running.then(() => {
      of.next = undefined;
      return start();
    });
    of.next = next;
    return next;
  };
  return {
    run,
    runAll: async () => {
      await Promise.all(options.repos().map(run));
    },
    stop: () => {
      stopped = true;
    },
  };
}
