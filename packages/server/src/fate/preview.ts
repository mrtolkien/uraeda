// Stories and previews in fate: the records of a story link of a checkout, `Story`, and of a
// checkout's Storybook, `Preview`, each read a view of the runner; and of an agent's link,
// `StoryHref`, checked by the core. The runner's changes reach the records read for each base.
import { resolve } from "node:path";
import { dataView } from "@nkzw/fate/server";
import { matchStory, UNREADABLE_INDEX } from "../preview/index.ts";
import type { Checkout, PreviewState, Previews } from "../preview/runner.ts";
import type { LiveBus } from "../fate.ts";
import type { RepoContext } from "./context.ts";

/**
 * A story link of a checkout, `<folder>:<path>#<export>`, `folder` a feature's or `main`: reading
 * it is a view of the checkout's Storybook. `none` without a checkout or a preview decision; when
 * ready, its frame and its Storybook page; when failed, why.
 */
export type StoryRecord = {
  error: string | null;
  /** `/r/<name>/preview/<folder>/iframe.html?id=<id>&viewMode=story`. */
  frame: string | null;
  id: string;
  state: "none" | "starting" | "ready" | "missing" | "failed";
  /** `/f/<folder>/storybook?path=/story/<id>`, `/storybook?path=…` for `main`. */
  storybook: string | null;
};

/** A checkout's Storybook, by its folder or `main`: reading it is a view. `base` when ready. */
export type PreviewRecord = {
  base: string | null;
  error: string | null;
  id: string;
  state: "none" | "starting" | "ready" | "failed";
};

/** An agent's link, by its href as written: the story it names, from the core. Not live. */
export type StoryHrefRecord = { export: string | null; id: string; path: string | null };

export const storyDataView = dataView<StoryRecord>("Story")({
  error: true,
  frame: true,
  id: true,
  state: true,
  storybook: true,
});

export const previewDataView = dataView<PreviewRecord>("Preview")({
  base: true,
  error: true,
  id: true,
  state: true,
});

export const storyHrefDataView = dataView<StoryHrefRecord>("StoryHref")({
  export: true,
  id: true,
  path: true,
});

/** The folder of the main checkout's Storybook: dated feature folders cannot clash with it. */
export const MAIN = "main";

/**
 * A checkout's folder, resolved from the main checkout, which the session manager keeps: a
 * feature's worktree, or the main checkout without one; undefined in a repository the core finds
 * no main checkout of.
 */
export async function checkoutDir(
  ctx: RepoContext,
  worktree?: string | null,
): Promise<string | undefined> {
  const root = await ctx.sessions.mainRoot(ctx.repo).catch(() => undefined);
  return root === undefined ? undefined : resolve(root, worktree ?? ".");
}

/**
 * The checkout a folder's stories run in: the main checkout for `main`, else the feature's
 * worktree; null for a feature without one, a folder that is no feature's, or a repository the core
 * finds no main checkout of. A feature is never given a checkout of its own here: the git decision
 * leaves worktrees to the workflow.
 */
export async function checkoutOf(
  ctx: RepoContext,
  folder: string,
): Promise<{ dir: string } | null> {
  if (folder === MAIN) {
    const dir = await checkoutDir(ctx);
    return dir === undefined ? null : { dir };
  }
  const feature = await ctx.binding.readFeature(ctx.repo, folder).catch(() => undefined);
  const dir =
    feature?.worktree === undefined ? undefined : await checkoutDir(ctx, feature.worktree);
  return dir === undefined ? null : { dir };
}

/** Whether the checkout at `dir` has an active preview decision: false when it cannot be read. */
export async function hasPreview(ctx: RepoContext, dir: string): Promise<boolean> {
  return (await ctx.binding.preview(dir).catch(() => null)) !== null;
}

/** The records read for one base: its repository's bus, its folder, and its stories' ids. */
type Watched = { folder: string; live: LiveBus; stories: Set<string> };

/** Each runner's watched bases. */
const watched = new WeakMap<Previews, Map<string, Watched>>();
/** The bases a restart stops: their watched records stay, for the start that follows. */
const restarting = new Set<string>();

/** Records that `ctx` read the base's `Preview`, and the story `story` when given. */
function watch(ctx: RepoContext, base: string, folder: string, story?: string) {
  const live = ctx.hosts.byPath(ctx.repo)?.live;
  if (live === undefined) {
    return;
  }
  const bases = watched.get(ctx.previews) ?? new Map<string, Watched>();
  watched.set(ctx.previews, bases);
  const entry = bases.get(base);
  const stories = entry?.live === live ? entry.stories : new Set<string>();
  if (story !== undefined) {
    stories.add(story);
  }
  bases.set(base, { folder, live, stories });
}

/**
 * The records read for a base whose state changed, to send live updates to; none once its Storybook
 * is stopped. fate reads a record again for its live update, and a read is a view, which would
 * start it again: a stopped Storybook's records are forgotten without an update, and a page's next
 * read watches them again. A restart's stop keeps them, for its start's updates.
 */
export function changedRecords(previews: Previews, base: string): Watched | undefined {
  const bases = watched.get(previews);
  if (previews.state(base) !== undefined) {
    return bases?.get(base);
  }
  if (!restarting.has(base)) {
    bases?.delete(base);
  }
  return undefined;
}

/** A folder's checkout to run, under its base, or null without one or without a decision. */
async function runnable(ctx: RepoContext, folder: string): Promise<Checkout | null> {
  const checkout = await checkoutOf(ctx, folder);
  const name = ctx.hosts.byPath(ctx.repo)?.name;
  if (checkout === null || name === undefined) {
    return null;
  }
  const found = await ctx.binding.preview(checkout.dir).catch(() => null);
  if (found === null) {
    return null;
  }
  const base = `/r/${encodeURIComponent(name)}/preview/${encodeURIComponent(folder)}/`;
  return { base, command: found.command, dir: checkout.dir, folder: found.folder };
}

/** A preview's record from its state. */
function previewRecord(id: string, checkout: Checkout, state: PreviewState): PreviewRecord {
  return {
    base: state.state === "ready" ? checkout.base : null,
    error: state.state === "failed" ? state.error : null,
    id,
    state: state.state,
  };
}

const NO_PREVIEW = { base: null, error: null, state: "none" } as const;

/** A checkout's Storybook, by its folder: reading it is a view, which starts it. */
export async function readPreview(ctx: RepoContext, folder: string): Promise<PreviewRecord> {
  const checkout = await runnable(ctx, folder);
  if (checkout === null) {
    return { id: folder, ...NO_PREVIEW };
  }
  watch(ctx, checkout.base, folder);
  return previewRecord(folder, checkout, ctx.previews.view(checkout));
}

/** Restarts a checkout's Storybook, by its folder: none without a checkout or a decision. */
export async function restartPreview(ctx: RepoContext, folder: string): Promise<PreviewRecord> {
  const checkout = await runnable(ctx, folder);
  if (checkout === null) {
    return { id: folder, ...NO_PREVIEW };
  }
  watch(ctx, checkout.base, folder);
  restarting.add(checkout.base);
  try {
    return previewRecord(folder, checkout, ctx.previews.restart(checkout));
  } finally {
    restarting.delete(checkout.base);
  }
}

/**
 * The parts of a story's id, `<folder>:<path>#<export>`, its link checked by the core's rule, as
 * written from the repository's top level: undefined when it names no story.
 */
function storyParts(ctx: RepoContext, id: string) {
  const at = id.indexOf(":");
  const link = id.slice(at + 1);
  const target = at > 0 ? ctx.binding.storyLink(link) : null;
  if (target === null || `${target.path}#${target.export}` !== link) {
    return undefined;
  }
  return { export: target.export, folder: id.slice(0, at), path: target.path };
}

/**
 * A story link of a checkout, by its id, `<folder>:<path>#<export>`: reading it is a view. Once its
 * Storybook is ready, the story is found in its index, or missing.
 */
export async function readStory(ctx: RepoContext, id: string): Promise<StoryRecord> {
  const none: StoryRecord = { error: null, frame: null, id, state: "none", storybook: null };
  const parts = storyParts(ctx, id);
  const checkout = parts && (await runnable(ctx, parts.folder));
  if (!parts || !checkout) {
    return none;
  }
  watch(ctx, checkout.base, parts.folder, id);
  const state = ctx.previews.view(checkout);
  if (state.state !== "ready") {
    return { ...none, error: state.state === "failed" ? state.error : null, state: state.state };
  }
  const index = await ctx.previews.index(checkout.base);
  if (index === undefined) {
    // A ready Storybook whose index fails or does not answer in time.
    return { ...none, error: UNREADABLE_INDEX, state: "failed" };
  }
  const story = matchStory(index, checkout.folder, parts);
  if (story === undefined) {
    return { ...none, state: "missing" };
  }
  const page =
    parts.folder === MAIN ? "/storybook" : `/f/${encodeURIComponent(parts.folder)}/storybook`;
  return {
    ...none,
    frame: `${checkout.base}iframe.html?id=${encodeURIComponent(story)}&viewMode=story`,
    state: "ready",
    storybook: `${page}?path=/story/${encodeURIComponent(story)}`,
  };
}

/** An agent's link, by its href as written: its story, from the core, nulls for another link. */
export function readStoryHref(ctx: RepoContext, href: string): StoryHrefRecord {
  const target = ctx.binding.storyLink(href);
  return { export: target?.export ?? null, id: href, path: target?.path ?? null };
}
