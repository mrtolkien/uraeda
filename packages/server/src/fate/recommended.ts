// The recommended message of a feature, which the session's composer offers: its record, its data
// view, and its reader.
import { dataView } from "@nkzw/fate/server";
import type { Trigger } from "../runner/events.ts";
import { recommendedMessage } from "../runner/message.ts";
import type { RepoContext } from "./context.ts";

/**
 * A feature's recommended message, by its folder: its name, step, text, and trigger, or, when
 * none applies, why, `reason`, and an empty text.
 */
export type RecommendedRecord = {
  id: string;
  name: string | null;
  reason: string | null;
  step: string | null;
  text: string;
  trigger: Trigger | null;
};

export const recommendedDataView = dataView<RecommendedRecord>("RecommendedMessage")({
  id: true,
  name: true,
  reason: true,
  step: true,
  text: true,
  trigger: true,
});

/**
 * The recommended message of the feature in `folder`, from its next step, its view, and whether
 * the agent is available: none for a folder that is no feature's.
 */
export async function readRecommended(
  ctx: RepoContext,
  folder: string,
): Promise<RecommendedRecord | undefined> {
  const read = await Promise.all([
    ctx.binding.nextStep(ctx.repo, folder),
    ctx.binding.readFeature(ctx.repo, folder),
  ]).catch(() => undefined);
  if (!read) {
    return undefined;
  }
  const [next, feature] = read;
  const { available } = ctx.sessions.status();
  const message = recommendedMessage({
    agent: { available, name: ctx.sessions.adapter.name },
    feature,
    next,
  });
  return "reason" in message
    ? { id: folder, name: null, reason: message.reason, step: null, text: "", trigger: null }
    : { id: folder, ...message, reason: null };
}
