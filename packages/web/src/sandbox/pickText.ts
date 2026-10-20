// The text of a pick, copied to paste into the agent working on the checkout: the page, the
// element, its source location, its text and HTML, and the viewport it was seen in.

/** What the pick script posts for the element picked. */
export type Pick = {
  html: string;
  name: string;
  role: string;
  /**
   * The nearest `data-insp-path` of the element or its parents, from the repository's root:
   * code-inspector's `<path>:<line>:<column>:<tag name>`.
   */
  source: string | null;
  text: string;
};

/** What a pick was seen in. */
export type PickPage = {
  address: string;
  height: number;
  theme: "dark" | "light";
  width: number;
};

const TEXT_MAX = 200;
const HTML_MAX = 500;

/** A source's path, line, and column, without the tag name code-inspector adds after them. */
const LOCATION = /^(.+:\d+:\d+)(?::[^:/]*)?$/;

/** The source attributes the sandbox's config adds to every element: noise in the pick's HTML. */
const SOURCE_ATTRIBUTES = /\s+data-insp-path="[^"]*"/g;

/** The element as the bar says it: its role, and its name in quotes when it has one. */
export function elementOf({ name, role }: Pick) {
  return name === "" ? role : `${role} “${name}”`;
}

/**
 * A text on one line, cut at `max` characters, with "…" when it was cut: a line break inside would
 * make the next field look like part of it.
 */
function oneLine(text: string, max: number) {
  const line = text.replaceAll(/\s*\n\s*/g, " ");
  return line.length > max ? `${line.slice(0, max)}…` : line;
}

/** The pick's source location, `<path>:<line>:<column>`, or `unknown`. */
function sourceOf(source: string | null) {
  if (source === null) {
    return "unknown";
  }
  return LOCATION.exec(source)?.[1] ?? source;
}

/** The pick's text, one field a line. */
export function pickText(pick: Pick, page: PickPage): string {
  return [
    `Sandbox pick: ${page.address}`,
    `Element: ${elementOf(pick)}`,
    `Source: ${sourceOf(pick.source)}`,
    `Text: ${oneLine(pick.text, TEXT_MAX)}`,
    `HTML: ${oneLine(pick.html.replaceAll(SOURCE_ATTRIBUTES, ""), HTML_MAX)}`,
    `Viewport: ${page.width} × ${page.height}, ${page.theme}`,
  ].join("\n");
}
