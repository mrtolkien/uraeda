// The text of a comment on a story, and its form's anchor, as the spec writes them: the story by its
// file's name and export, then the element picked in it, with the frame's width only while both
// widths show.
import type { StoryTarget } from "uraeda-binding";

/** An element picked in a story's frame: its role and accessible name, and the frame's width. */
export type Picked = { name: string; role: string; width?: "phone" | "desktop" };

/** `, <width>, <role> “<name>”`, the width and the name only when there are. */
function element(picked: Picked | undefined): string {
  if (!picked) {
    return "";
  }
  const width = picked.width ? `, ${picked.width}` : "";
  const name = picked.name ? ` “${picked.name}”` : "";
  return `${width}, ${picked.role}${name}`;
}

/** `Story <file name>#<export>`, the picked element, then `: ` and the text. */
export function storyComment(story: StoryTarget, picked: Picked | undefined, text: string): string {
  return `Story ${story.path.split("/").at(-1)}#${story.export}${element(picked)}: ${text}`;
}

/** `Comment on <label>`, then the picked element. */
export function storyAnchor(label: string, picked: Picked | undefined): string {
  return `Comment on ${label}${element(picked)}`;
}
