// Continue all, from home's Needs you pane: each feature whose run stopped and asks for the human
// gets its step's message, as starting the step sends it (US5 of the worker lifecycle). A chat has
// no step's message, and is left alone (R7).
import type { FeatureView } from "uraeda-binding";
import { reasonOf, REFUSAL_CODE } from "../reason.ts";
import { recommendedMessage } from "../runner/message.ts";
import { REFUSALS } from "../runner/session-state.ts";
import { continuedByAll } from "../runner/status.ts";
import type { RepoContext, Resolver } from "./context.ts";
import { callSiteError } from "./errors.ts";
import { featureStatuses } from "./feature-status.ts";
import { sources, workspace } from "./sources.ts";
import { workspaceDataView } from "./views.ts";

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
 * on: a feature at a gate, blocked, or at work is skipped, and so is one refused, as while another
 * session of its worktree works, or one whose step has no message.
 */
async function continueAll(ctx: RepoContext): Promise<void> {
  const { available } = ctx.sessions.status();
  if (!available) {
    throw callSiteError(`refused: ${REFUSALS.unavailable(ctx.sessions.adapter.name)}`);
  }
  const agent = { available, name: ctx.sessions.adapter.name };
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
    }
  }
}

/** The repository mutation of Continue all, which answers the workspace. */
export const continueAllMutations = {
  "feature.continueAll": {
    resolve: async ({ ctx, select }: Resolver<Record<string, never>>) => {
      await continueAll(ctx);
      // A new context reads the statuses again, which the sends changed.
      return sources.masked(workspaceDataView, ctx, await workspace({ ...ctx }), select);
    },
    type: "Workspace",
  },
};
