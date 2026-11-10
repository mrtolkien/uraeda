// Continue all, from home's Needs you pane: each feature whose run stopped and asks for the human
// gets its step's message, as starting the step sends it (US5 of the worker lifecycle). A chat has
// no step's message, and is left alone (R7). Its answer names the runs it could not continue.
import type { FeatureView } from "uraeda-binding";
import { reasonOf, REFUSAL_CODE } from "../reason.ts";
import { ANY_AGENT } from "../runner/chain.ts";
import type { Trigger } from "../runner/events.ts";
import { recommendedMessage } from "../runner/message.ts";
import { runtimeState } from "../runner/runtimes.ts";
import { CATCH_UP, continuable, continuedByAll } from "../runner/status.ts";
import type { RepoContext, Resolver } from "./context.ts";
import { callSiteError } from "./errors.ts";
import { featureStatuses } from "./feature-status.ts";
import { sources } from "./sources.ts";
import { continuedAllDataView, type RefusedRun } from "./views-continued-all.ts";

/**
 * An automatic run's message: the step it is sent at, what started it, the line its session shows
 * before it, saying why it happened, and the commit it catches up with, when it does.
 */
export type Automatic = { commit?: string; line: string; step: string; trigger: Trigger };

/**
 * Sends the feature its step's message from `session`, which goes on there, or in the session its
 * step's options give, whose agent the send checks: none when its step has no message, as at a
 * gate. An automatic run, `automatic`, sends it with its own trigger and line, and only while the
 * feature is still at its step, catching up with its commit: the default branch moved since, the
 * next trigger catches up with the new tip.
 */
export async function continueOne(
  ctx: RepoContext,
  feature: FeatureView,
  session: string,
  automatic?: Automatic,
) {
  const next = await ctx.binding.nextStep(ctx.repo, feature.folder);
  const message = recommendedMessage({ agent: ANY_AGENT, feature, next });
  if ("reason" in message) {
    return;
  }
  if (automatic === undefined) {
    const workflow = { step: message.step, trigger: message.trigger };
    await ctx.sessions.send(ctx.repo, session, { text: message.text, workflow });
  } else if (
    message.step === automatic.step &&
    (automatic.commit === undefined || next.step.catchUp?.commit === automatic.commit)
  ) {
    const { line, step, trigger } = automatic;
    await ctx.sessions.send(ctx.repo, session, {
      text: message.text,
      workflow: { line, step, trigger },
    });
  }
}

/**
 * Whether the feature at `catch-up` already had its catch-up for the tip it reads: a conflict
 * dismissed reads idle, and Continue all would send it again. A run that asks, as one the human
 * stopped, is continued all the same. Spec: Continue all includes
 * the pull requests at "Catch up" with no run.
 */
function ranFor(ctx: RepoContext, root: string, feature: FeatureView): boolean {
  const { catchUp, name } = feature.step;
  return (
    name === CATCH_UP &&
    catchUp !== undefined &&
    ctx.sessions.cache.caughtUp(root, feature.folder, catchUp.commit)
  );
}

/**
 * Sends each feature `continuedByAll` picks its step's message, in its latest session, which goes
 * on: a feature at a gate, blocked, or at work is skipped, and so is one whose step has no message.
 * One refused, as while another session of its worktree works, is left as it was, and returned
 * with why.
 */
async function continueAll(ctx: RepoContext): Promise<Array<RefusedRun>> {
  // Refused at once when the repository's runtime is off or gone: each run is checked on its own.
  const root = await ctx.sessions.mainRoot(ctx.repo);
  const state = runtimeState(ctx.sessions.runtimes, root);
  if (!state.available) {
    throw callSiteError(`refused: ${state.refusal}`);
  }
  const refused: Array<RefusedRun> = [];
  for (const { feature, status } of await featureStatuses(ctx)) {
    if (
      !continuedByAll({ status, step: feature.step }) ||
      status.session === null ||
      (!continuable(status) && ranFor(ctx, root, feature))
    ) {
      continue;
    }
    try {
      await continueOne(ctx, feature, status.session);
    } catch (error) {
      // A refusal leaves the feature as it was, still asking: the others go on.
      if (!REFUSAL_CODE.test(error instanceof Error ? error.message : String(error))) {
        process.stderr.write(
          `uraeda: Continue all skipped ${feature.folder}: ${reasonOf(error)}\n`,
        );
      }
      refused.push({ folder: feature.folder, name: feature.slug, reason: reasonOf(error) });
    }
  }
  return refused;
}

/** The repository mutation of Continue all, which answers the runs it could not continue. */
export const continueAllMutations = {
  "feature.continueAll": {
    resolve: async ({ ctx, select }: Resolver<Record<string, never>>) => {
      const record = { id: "continue-all", refused: await continueAll(ctx) };
      return sources.masked(continuedAllDataView, ctx, record, select);
    },
    type: "ContinuedAll",
  },
};
