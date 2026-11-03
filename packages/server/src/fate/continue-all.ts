// Continue all, from home's Needs you pane: each feature whose run stopped and asks for the human
// gets its step's message, as starting the step sends it (US5 of the worker lifecycle). A chat has
// no step's message, and is left alone (R7). Its answer names the runs it could not continue.
import type { FeatureView } from "uraeda-binding";
import { reasonOf, REFUSAL_CODE } from "../reason.ts";
import { recommendedMessage } from "../runner/message.ts";
import { REFUSALS } from "../runner/session-state.ts";
import { continuedByAll } from "../runner/status.ts";
import type { RepoContext, Resolver } from "./context.ts";
import { callSiteError } from "./errors.ts";
import { featureStatuses } from "./feature-status.ts";
import { sources } from "./sources.ts";
import { continuedAllDataView, type RefusedRun } from "./views-continued-all.ts";

/**
 * Sends the feature its step's message in `session`, which goes on there, as its run did: none
 * when its step has no message, as at a gate.
 */
async function continueOne(
  ctx: RepoContext,
  agent: { available: boolean; name: string },
  feature: FeatureView,
  session: string,
) {
  const next = await ctx.binding.nextStep(ctx.repo, feature.folder);
  const message = recommendedMessage({ agent, feature, next });
  if (!("reason" in message)) {
    const workflow = { fresh: false, step: message.step, trigger: message.trigger };
    await ctx.sessions.send(ctx.repo, session, { text: message.text, workflow });
  }
}

/**
 * Sends each feature `continuedByAll` picks its step's message, in its latest session, which goes
 * on: a feature at a gate, blocked, or at work is skipped, and so is one whose step has no message.
 * One refused, as while another session of its worktree works, is left as it was, and returned
 * with why.
 */
async function continueAll(ctx: RepoContext): Promise<Array<RefusedRun>> {
  const { available } = ctx.sessions.status();
  if (!available) {
    throw callSiteError(`refused: ${REFUSALS.unavailable(ctx.sessions.adapter.name)}`);
  }
  const agent = { available, name: ctx.sessions.adapter.name };
  const refused: Array<RefusedRun> = [];
  for (const { feature, status } of await featureStatuses(ctx)) {
    if (!continuedByAll({ status, step: feature.step }) || status.session === null) {
      continue;
    }
    try {
      await continueOne(ctx, agent, feature, status.session);
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
