// The catcher: with the switch on, each open pull request behind the default branch gets its
// catch-up's run by itself, once per tip of the default branch (US2 of agents-fix). It runs on each
// watcher burst, each refresh of the pull requests that changed them, and each turn's end in a
// repository, and on each change of the switch.
import type { CatchUpView, FeatureView } from "uraeda-binding";
import { continueOne } from "./fate/continue-all.ts";
import type { RepoContext } from "./fate/context.ts";
import { type FeatureStatus, featureStatuses } from "./fate/feature-status.ts";
import { onTurnDone } from "./live.ts";
import { reasonOf } from "./reason.ts";
import { type Runs, serially } from "./serially.ts";
import { catchUpLine } from "./runner/message.ts";
import { CATCH_UP } from "./runner/status.ts";

/** The catcher's triggers, and its stop. */
export type CatchUps = {
  /** Catches up the repository's features: after a watcher burst, or a turn's end there. */
  run(repo: string): Promise<void>;
  /** Catches up every hosted repository: the switch changed. */
  runAll(): Promise<void>;
  /** Starts no other send, and resolves once the runs in flight end. */
  stop(): Promise<void>;
};

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
 * latest session. A repository's runs, by its main checkout, go one at a time: a run asked
 * meanwhile runs once after it, so two triggers at once start one catch-up. A refusal leaves the feature, printed once per
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
  const once = async (repo: string, root: string) => {
    if (!on()) {
      return;
    }
    const ctx = options.context(repo);
    for (const read of await featureStatuses(ctx)) {
      const catching = due(ctx, root, read);
      // The switch turned off, or the server stopping, during the run starts no other.
      if (catching === undefined || !on()) {
        continue;
      }
      const { catchUp, session } = catching;
      const { feature } = read;
      const automatic = {
        commit: catchUp.commit,
        line: catchUpLine(catchUp),
        step: CATCH_UP,
        trigger: "catch-up" as const,
      };
      try {
        await continueOne(ctx, feature, session, automatic);
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
  const runs = new Map<string, Runs>();
  // The runs in flight, which the stop waits for: none reads the repository once it resolves.
  const flying = new Set<Promise<void>>();
  // By the repository's main checkout: a turn's end and a burst may name it by other paths.
  const run = (repo: string): Promise<void> => {
    const running = (async () => {
      try {
        const root = await options.context(repo).sessions.mainRoot(repo);
        await serially(runs, root, () => once(repo, root));
      } catch (error) {
        process.stderr.write(`uraeda: the catch-ups of ${repo} stopped: ${reasonOf(error)}\n`);
      }
    })();
    flying.add(running);
    void running.finally(() => flying.delete(running));
    return running;
  };
  return {
    run,
    runAll: async () => {
      await Promise.all(options.repos().map(run));
    },
    stop: async () => {
      stopped = true;
      await Promise.all(flying);
    },
  };
}

/**
 * Starts the catcher on the listed repositories, each one's context the one a request there gets:
 * it runs at each feature's turn that ends done, at each change of the settings, which may turn its
 * switch on, and once now. Its stop stops its triggers too. The hosts run it too: see `openParts`.
 */
export function catcher(shared: Omit<RepoContext, "repo">): CatchUps {
  const { hosts, sessions, settings } = shared;
  const catchUps = startCatchUps({
    context: (repo) => ({ ...shared, repo }),
    enabled: () => settings.runs().catchUpPullRequests.inForce,
    repos: () => hosts.all().flatMap((host) => (host.missing ? [] : [host.path])),
  });
  const unsubscribe = [
    onTurnDone(sessions, (repo) => void catchUps.run(repo)),
    settings.onChange(() => void catchUps.runAll()),
  ];
  void catchUps.runAll();
  return {
    ...catchUps,
    stop: () => {
      unsubscribe.forEach((stop) => stop());
      return catchUps.stop();
    },
  };
}
