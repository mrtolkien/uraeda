// The key picker's search, pure: which items a query finds, the best first.

/** What a query is ranked against: a title, a mark some have, and a first sentence. */
export type Searchable = { mark?: string; summary?: string | null; title: string };

/**
 * How well an item matches a query, lower first, or undefined when it does not: its mark or its
 * whole title, the title's start, a word's start in it, anywhere in it, in its first sentence,
 * then each word of the query, anywhere in its title or its first sentence, as "codex big" finds
 * "Codex · Fake Big".
 */
function rank({ mark, summary, title: name }: Searchable, query: string): number | undefined {
  const title = name.toLowerCase();
  if (mark?.toLowerCase() === query || title === query) {
    return 0;
  }
  if (title.startsWith(query)) {
    return 1;
  }
  if (title.split(/[\s-]+/).some((word) => word.startsWith(query))) {
    return 2;
  }
  if (title.includes(query)) {
    return 3;
  }
  const sentence = summary?.toLowerCase() ?? "";
  if (sentence.includes(query)) {
    return 4;
  }
  const words = query.split(/\s+/);
  return words.length > 1 && words.every((word) => title.includes(word) || sentence.includes(word))
    ? 5
    : undefined;
}

/** The items a query matches, the best first, ties in the list's order; all of them for none. */
export function searchRanked<T>(
  items: ReadonlyArray<T>,
  query: string,
  read: (item: T) => Searchable,
): Array<T> {
  const wanted = query.trim().toLowerCase();
  if (wanted === "") {
    return [...items];
  }
  return items
    .map((item, index) => ({ index, item, rank: rank(read(item), wanted) }))
    .filter((found): found is typeof found & { rank: number } => found.rank !== undefined)
    .toSorted((a, b) => a.rank - b.rank || a.index - b.index)
    .map((found) => found.item);
}
