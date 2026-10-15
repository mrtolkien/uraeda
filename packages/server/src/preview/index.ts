// A running Storybook's index, `index.json`, and the story a story link names in it.
import { posix } from "node:path";

/** One entry of Storybook's `index.json` v5: a story, or a docs page. */
export type IndexEntry = {
  /** The story's export, in the stories file. */
  exportName?: string;
  id: string;
  /** The file's path, relative to the folder Storybook runs in: `./src/A.stories.tsx`. */
  importPath: string;
  name: string;
  title: string;
  type: "story" | "docs";
};

/** Storybook's `index.json` v5: its entries by id. */
export type StoryIndex = { entries: Record<string, IndexEntry>; v: number };

/** Why a Storybook that answers is failed: its index is not JSON. */
export const UNREADABLE_INDEX = "Storybook's index could not be read.";

/**
 * The index of the Storybook on `port` of 127.0.0.1. Rejects with `UNREADABLE_INDEX` on a 200 that
 * is not an index, and with the request's own error while nothing answers, or not with a 200.
 */
export async function readIndex(port: number, signal?: AbortSignal): Promise<StoryIndex> {
  const response = await fetch(`http://127.0.0.1:${port}/index.json`, { signal });
  if (response.status !== 200) {
    await response.body?.cancel();
    throw new Error(`index.json answered ${response.status}`);
  }
  let index: unknown;
  try {
    index = await response.json();
  } catch (error) {
    if (signal?.aborted) {
      throw error;
    }
    throw new Error(UNREADABLE_INDEX, { cause: error });
  }
  if (typeof index !== "object" || index === null || !("entries" in index)) {
    throw new Error(UNREADABLE_INDEX);
  }
  return index as StoryIndex;
}

/**
 * The id of the story `story` names, in the index of the Storybook run in `folder`: the entry whose
 * `importPath`, joined to the folder, is the link's file, and whose `exportName` is its export
 * (R1). Undefined when there is none.
 */
export function matchStory(
  index: StoryIndex,
  folder: string,
  story: { export: string; path: string },
): string | undefined {
  const path = posix.normalize(story.path);
  for (const entry of Object.values(index.entries)) {
    if (
      entry.type === "story" &&
      entry.exportName === story.export &&
      posix.join(folder, entry.importPath) === path
    ) {
      return entry.id;
    }
  }
  return undefined;
}
