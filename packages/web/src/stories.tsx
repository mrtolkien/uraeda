// The stories of the workflow file or message a page draws: which checkout runs them, the story
// links its paragraphs embed, and where a comment on one goes. Each page that draws a workflow file
// fills `StoryContext`, so `Blocks` and `Spans` read it without a prop through every caller.
import { createContext, type ReactNode, useContext } from "react";
import type { Block, StoryLink, StoryTarget } from "uraeda-binding";
import { MAIN_CHECKOUT, usePreviewOn } from "./data.ts";

/** Saves a comment on a story, from its embed's block: why it was refused, or nothing. */
export type StoryComment = (
  story: StoryLink,
  text: string,
  block?: Block,
) => Promise<string | undefined>;

/**
 * Where a page's comments on its stories go: `save` writes one, and `path`, the file it goes to,
 * keys each embed's unsaved text, `<path>#story:<folder>:<story path>#<export>`.
 */
export type StoryComments = { path: string; save: StoryComment };

/**
 * The stories of what a page draws: the checkout's folder, `main` for the main checkout; the story
 * links its paragraphs embed, as the core found them; where a comment goes, when one can; whether
 * its stories were removed, as a round's after its answer; and whether the checkout has a preview
 * decision, without which story links are plain links.
 */
export type Stories = {
  comment?: StoryComments;
  folder: string;
  preview: boolean;
  removed?: boolean;
  stories: ReadonlyArray<StoryLink>;
};

export const StoryContext = createContext<Stories | null>(null);

/** Gives the stories of a workflow file or a draft to what draws it. */
export function StoriesProvider({
  children,
  comment,
  folder,
  removed,
  stories,
}: {
  children: ReactNode;
  comment?: StoryComments;
  folder: string;
  removed?: boolean;
  stories: ReadonlyArray<StoryLink>;
}) {
  const preview = usePreviewOn(folder);
  return (
    <StoryContext value={{ comment, folder, preview, removed, stories }}>{children}</StoryContext>
  );
}

/** The story a paragraph embeds, in a page's stories, when its checkout has a preview decision. */
export function storyIn(context: Stories | null, block: Block | undefined): StoryLink | undefined {
  if (!context?.preview || block?.kind !== "paragraph") {
    return undefined;
  }
  return context.stories.find((story) => story.block === block.id);
}

/** The story a paragraph embeds, when its checkout has a preview decision. */
export function useStoryAt(block: Block): StoryLink | undefined {
  return storyIn(useContext(StoryContext), block);
}

/**
 * The page of a checkout's Storybook, within its repository: `/f/<folder>/storybook`, `/storybook`
 * for the main checkout, at a story when given, which the page finds by its file and export (R2).
 */
export function storybookHref(folder: string, story?: StoryTarget): string {
  const page =
    folder === MAIN_CHECKOUT ? "/storybook" : `/f/${encodeURIComponent(folder)}/storybook`;
  if (!story) {
    return page;
  }
  const path = story.path.split("/").map(encodeURIComponent).join("/");
  return `${page}?story=${path}%23${encodeURIComponent(story.export)}`;
}

/** The element id of the embed a paragraph draws, by its block, for a page to scroll to it. */
export function storyEmbedId(block: number): string {
  return `story-${block}`;
}
