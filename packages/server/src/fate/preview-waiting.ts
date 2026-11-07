// The review watch: the folders whose file waits for the human and embeds a story. Their
// Storybooks are kept up while they wait, started as the server starts, and their linked stories
// compiled ahead, as a turn ends, so a story shows at once when the human arrives.
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { FeatureView } from "uraeda-binding";
import type { RepoContext } from "./context.ts";
import { restartPreview, runnable } from "./preview.ts";

/** A story a link names: its stories file, from the repository's top level, and its export. */
type LinkedStory = { export: string; path: string };

/** A folder waiting for the human, and the stories its waiting file embeds. */
export type WaitingStories = { folder: string; stories: Array<LinkedStory> };

/**
 * The stories the feature's or change's file waiting for the human embeds: none when its step does
 * not wait on the human with a file, or the core cannot read the file.
 */
async function storiesOf(ctx: RepoContext, feature: FeatureView): Promise<Array<LinkedStory>> {
  const { file, waitsOn } = feature.step;
  if (waitsOn !== "human" || file === undefined) {
    return [];
  }
  const view = await ctx.binding.readFile(ctx.repo, feature.folder, file).catch(() => undefined);
  return (view?.current.stories ?? []).map((story) => ({ export: story.export, path: story.path }));
}

/**
 * Each feature or change of the repository whose file waits for the human and embeds a story,
 * with those stories: none when the core cannot read the repository.
 */
export async function waitingStories(ctx: RepoContext): Promise<Array<WaitingStories>> {
  const workspace = await ctx.binding.readWorkspace(ctx.repo).catch(() => undefined);
  const waiting: Array<WaitingStories> = [];
  for (const feature of workspace?.features ?? []) {
    const stories = await storiesOf(ctx, feature);
    if (stories.length > 0) {
      waiting.push({ folder: feature.folder, stories });
    }
  }
  return waiting;
}

/**
 * The bases, under the current frame secret, of the Storybooks to keep up: those of every waiting
 * folder with a checkout and a preview, in each of the repositories.
 */
export async function keptBases(contexts: Array<RepoContext>): Promise<Set<string>> {
  const kept = new Set<string>();
  for (const ctx of contexts) {
    for (const { folder } of await waitingStories(ctx)) {
      const checkout = await runnable(ctx, folder);
      if (checkout !== null) {
        kept.add(checkout.base);
      }
    }
  }
  return kept;
}

/**
 * Starts the Storybooks of the waiting folders of each repository, as the server starts, one after
 * the other, each once its linked stories compiled: several starting at once would load the
 * machine for minutes.
 */
export async function startWaiting(contexts: Array<RepoContext>): Promise<void> {
  for (const ctx of contexts) {
    for (const { folder, stories } of await waitingStories(ctx)) {
      await warmPreview(ctx, folder, stories).catch(() => {});
    }
  }
}

/**
 * Starts a checkout's Storybook ahead of any page, by its folder, once its preview folder has its
 * dependencies, `node_modules`: without them it would only fail, and its stories show the failure.
 * One that failed, as one a page started during the install, starts again. It compiles `stories`,
 * by default those the folder's waiting file embeds, and resolves once they compiled. Nothing reads
 * its record yet: a page that does finds it starting or ready. The stories are read before its
 * checkout, so no read comes between its base, under the frame secret, and its start.
 */
export async function warmPreview(
  ctx: RepoContext,
  folder: string,
  stories?: Array<LinkedStory>,
): Promise<void> {
  const linked = stories ?? (await linkedStories(ctx, folder));
  const checkout = await runnable(ctx, folder);
  if (checkout === null || !existsSync(join(checkout.dir, checkout.folder, "node_modules"))) {
    return;
  }
  if (ctx.previews.state(checkout.base)?.state === "failed") {
    await restartPreview(ctx, folder);
  }
  await ctx.previews.warm(checkout, linked);
}

/** The stories the folder's waiting file embeds: none for `main`, or a folder the core cannot read. */
async function linkedStories(ctx: RepoContext, folder: string): Promise<Array<LinkedStory>> {
  const feature = await ctx.binding.readFeature(ctx.repo, folder).catch(() => undefined);
  return feature === undefined ? [] : await storiesOf(ctx, feature);
}
