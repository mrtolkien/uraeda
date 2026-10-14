/** How many line breaks, up to two, a text ends with, or starts with. */
function breaks(text: string, fromEnd: boolean) {
  let count = 0;
  while (count < 2 && text.at(fromEnd ? -1 - count : count) === "\n") {
    count += 1;
  }
  return count;
}

/**
 * Inserts image links in a text at a position, one per line, in a paragraph of their own: a blank
 * line before them unless they start the text, and after them unless they end it. Returns the new
 * text, and the first link's alt text as the selection, so typing replaces it.
 */
export function insertLinks(
  text: string,
  at: number,
  links: string[],
): { text: string; selection: [number, number] } {
  const before = text.slice(0, at);
  const after = text.slice(at);
  const lead = before ? "\n".repeat(2 - breaks(before, true)) : "";
  const tail = after ? "\n".repeat(2 - breaks(after, false)) : "\n";
  const start = before.length + lead.length;
  // A link is `![alt](images/name)`: its target never holds `](`, its alt text's brackets are
  // escaped.
  const first = links[0] ?? "";
  const selection: [number, number] = [start + 2, start + first.lastIndexOf("](")];
  return { text: `${before}${lead}${links.join("\n")}${tail}${after}`, selection };
}

/**
 * Where a position of a text is once the text was edited: moved by what was typed or removed before
 * it, and kept where it was by what changed after it, or at it.
 */
export function followEdits(before: string, after: string, at: number) {
  let prefix = 0;
  const shortest = Math.min(before.length, after.length);
  while (prefix < shortest && before[prefix] === after[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < shortest - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  // The edit replaced `before[prefix, before.length - suffix)`.
  if (before.length - suffix <= at && prefix < at) {
    return at + after.length - before.length;
  }
  return Math.min(at, prefix + (after.length - suffix - prefix));
}
