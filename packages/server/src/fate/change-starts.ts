// The starts of a change that send its first run: from a typed text and its images.
import type { ChatImage } from "../runner/images.ts";
import { changeImages } from "./chat-images.ts";
import type { RepoContext, Resolver } from "./context.ts";
import { refusable } from "./errors.ts";
import { refusedOn } from "./list-mutations.ts";
import { featureRecord, readWorkflowMessage } from "./sessions.ts";
import { sources } from "./sources.ts";
import { featureDataView } from "./views.ts";

/**
 * Runs a call of the session manager that answers at once, after reading the repository's main
 * checkout, which it matches the session's repository with.
 */
export async function onSession<T>(ctx: RepoContext, call: () => T | Promise<T>): Promise<T> {
  return refusedOn(async () => {
    await ctx.sessions.mainRoot(ctx.repo);
    return call();
  });
}

/**
 * Sends a started change's first run to its session, through the queue a running turn would hold
 * it in (R3), with the agent available and its workflow message written: the session's ID, or
 * `null` when no run was sent.
 */
async function sendFirstRun(ctx: RepoContext, folder: string): Promise<string | null> {
  // Without the agent, or a run to start, the change's page offers its message unsent.
  const message = ctx.sessions.status().available
    ? await readWorkflowMessage(ctx, `${folder}:start`)
    : undefined;
  if (!message?.text) {
    return null;
  }
  // The change's latest session: its only one, made now, unless a session moved to it.
  const { id } = await onSession(ctx, () => ctx.sessions.featureSession(ctx.repo, folder));
  const sent = await refusedOn(() =>
    ctx.sessions.send(ctx.repo, id, { text: message.text, workflow: { trigger: "start" } }),
  );
  return sent.session;
}

/**
 * Starts a change from a typed text and its images, then sends its first run. The core writes the
 * images into the change's folder: the workflow's message carries none. Once the change exists, a
 * run that could not be sent is logged, not refused (R12): the change's page offers it unsent.
 */
async function startTypedChange(
  ctx: RepoContext,
  input: { images?: Array<ChatImage>; slug?: string; text: string },
): Promise<{ folder: string; sent: boolean }> {
  const bytes = await changeImages(ctx, input.images);
  const { folder } = await refusable(() =>
    ctx.binding.startChange(ctx.repo, input.text, bytes, input.slug),
  );
  try {
    return { folder, sent: (await sendFirstRun(ctx, folder)) !== null };
  } catch (error) {
    const reason = (error as Error).message.replace(/^refused: /, "");
    process.stderr.write(`uraeda: ${folder} started, but its first run was not sent: ${reason}\n`);
    return { folder, sent: false };
  }
}

export const changeStarts = {
  "change.start": {
    resolve: async ({
      ctx,
      input,
      select,
    }: Resolver<{ images?: Array<ChatImage>; slug?: string; text: string }>) => {
      const { folder, sent } = await startTypedChange(ctx, input);
      const record = await featureRecord(ctx, await ctx.binding.readFeature(ctx.repo, folder));
      return sources.masked(
        featureDataView,
        ctx,
        sent ? record : { ...record, session: null },
        select,
      );
    },
    type: "Feature",
  },
};
