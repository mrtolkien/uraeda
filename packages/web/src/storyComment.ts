// The text of a comment on a story, and its form's anchor, as the spec writes them: the story by its
// file's name and export, then the element picked in it, with the frame's width only while both
// widths show.
import type { StoryTarget } from "uraeda-binding";

/**
 * An element picked in a story's frame: its role and accessible name, the start of its text, and
 * the frame's width.
 */
export type Picked = { name: string; role: string; text?: string; width?: "phone" | "desktop" };

/** How much of an unnamed element's text tells it apart. */
const SNIPPET = 40;

/**
 * `, <width>, <role> “<name>”`, the width and the name only when there are; an element without a
 * name is told by the start of its text, `<role> with “<text>”`.
 */
function element(picked: Picked | undefined): string {
  if (!picked) {
    return "";
  }
  const width = picked.width ? `, ${picked.width}` : "";
  const text =
    picked.text && picked.text.length > SNIPPET
      ? `${picked.text.slice(0, SNIPPET).trimEnd()}…`
      : picked.text;
  const name = picked.name ? ` “${picked.name}”` : text ? ` with “${text}”` : "";
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
