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

/** An edit of a text: `removed` characters at `start` replaced by `inserted` ones. */
export type Edit = { start: number; removed: number; inserted: number };

/**
 * The edit that made `after` from `before`. `caret`, the field's cursor once it was typed, places
 * it: a typed edit ends at the caret, which a diff of the two texts cannot tell next to a repeated
 * character (`hel|lo`, an `l` typed at 2, reads as one typed at 4). Without a caret, or one the
 * texts disagree with, as after a text replaced from elsewhere, the edit is what lies between the
 * texts' common start and common end.
 */
export function editBetween(before: string, after: string, caret?: number): Edit {
  let prefix = 0;
  const shortest = Math.min(before.length, after.length);
  while (prefix < shortest && before[prefix] === after[prefix]) {
    prefix += 1;
  }
  if (caret !== undefined && caret >= 0 && caret <= after.length) {
    // Where the edit ends in `before`: what follows the caret is what followed the edit.
    const end = caret - (after.length - before.length);
    if (end >= 0 && end <= before.length && before.slice(end) === after.slice(caret)) {
      const start = Math.min(prefix, caret, end);
      return { start, removed: end - start, inserted: caret - start };
    }
  }
  let suffix = 0;
  while (
    suffix < shortest - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  return {
    start: prefix,
    removed: before.length - suffix - prefix,
    inserted: after.length - suffix - prefix,
  };
}

/**
 * Where a position of a text is once an edit was made: moved by what was typed or removed before
 * it, and kept where it was by what changed after it, or at it (R44), unless `after`, as for links
 * an earlier batch inserted there, which the later batch's follow. A replaced span around it puts
 * it after the replacement.
 */
export function followEdit(at: number, { start, removed, inserted }: Edit, after = false) {
  if (start > at || (start === at && !(after && removed === 0))) {
    return at;
  }
  if (start + removed <= at) {
    return at + inserted - removed;
  }
  return start + inserted;
}

/** Where a position is once `before` became `after`, as `editBetween` and `followEdit` say. */
export function followEdits(before: string, after: string, at: number, caret?: number) {
  return followEdit(at, editBetween(before, after, caret));
}
