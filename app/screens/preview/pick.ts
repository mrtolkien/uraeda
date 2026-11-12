// An element picked in a live page, as the pick script (`uraeda-pick.js`) tells it, and the words a
// review comment on it starts with: the story or the mockup, then the element, by its role and its
// name, or the start of its text when it has none.

/** What the pick script posts of the element pressed in pick mode. */
export type Picked = { name: string; role: string; text?: string };

/** How much of an unnamed element's text tells it apart. */
const SNIPPET = 40;

/** Reads a message of the page as a pick, or `undefined`. */
export function pickedOf(data: unknown): Picked | undefined {
  const said = (typeof data === "object" && data !== null ? data : {}) as Record<string, unknown>;
  if (said.uraeda !== "picked" || typeof said.role !== "string") return undefined;
  return {
    name: typeof said.name === "string" ? said.name : "",
    role: said.role,
    text: typeof said.text === "string" ? said.text : undefined,
  };
}

/** `, <role> “<name>”`, or `, <role> with “<text>”`: nothing without a pick. */
function element(picked: Picked | undefined): string {
  if (picked === undefined) return "";
  const text =
    picked.text !== undefined && picked.text.length > SNIPPET
      ? `${picked.text.slice(0, SNIPPET).trimEnd()}…`
      : picked.text;
  const name = picked.name ? ` “${picked.name}”` : text ? ` with “${text}”` : "";
  return `, ${picked.role}${name}`;
}

/** What a comment on a story is about: `Story <file>#<export>`, then the element picked. */
export const storyAbout = (link: { export: string; path: string }, picked?: Picked) =>
  `Story ${link.path.split("/").at(-1)}#${link.export}${element(picked)}`;

/** What a comment on a mockup is about: `Mockup <file>`, then the element picked. */
export const mockupAbout = (path: string, picked?: Picked) =>
  `Mockup ${path.split("/").at(-1)}${element(picked)}`;

/** `after`, a page's query and anchor, asking the server for the pick script too. */
export function withPick(after: string): string {
  const hash = after.indexOf("#");
  const query = hash === -1 ? after : after.slice(0, hash);
  const anchor = hash === -1 ? "" : after.slice(hash);
  return `${query}${query.startsWith("?") ? "&" : "?"}uraeda-pick${anchor}`;
}

/** Where a comment on an embedded page goes: while `on`, `open` starts it, about the page. */
export type EmbedComment = { on: () => boolean; open: (about: string) => void };
