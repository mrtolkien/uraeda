// Where a card's menu moves a priority within its section: the file index of an up, down, top, or
// bottom, found on screen, where the running entries show in Ongoing, and turned into the file's
// index by `fileIndex`, the rule a drag already owns.
import type { PriorityEntry } from "uraeda-server/fate";
/**
 * Where a row dropped at `index` among a section's rows on screen goes in the file: the place of
 * the `index`-th entry that is not running, once the dragged one is taken out, or after the last of
 * them. The running entries show in "Ongoing", so a drop never lands between two of them.
 */
export function fileIndex(entries: ReadonlyArray<PriorityEntry>, key: string, index: number) {
  const rest = entries.filter((entry) => entry.key !== key);
  const places = rest.flatMap((entry, place) => (entry.running ? [] : [place]));
  if (index < places.length) {
    return places[index];
  }
  const last = places.at(-1);
  return last === undefined ? rest.length : last + 1;
}

export type Direction = "up" | "down" | "top" | "bottom";

/** The place of an entry among the entries of its section that show, and how many show. */
function onScreen(entries: ReadonlyArray<PriorityEntry>, key: string) {
  const shown = entries.filter((entry) => !entry.running);
  return { count: shown.length, index: shown.findIndex((entry) => entry.key === key) };
}

/**
 * The file index to pass `priorities.move` to move the entry `key` of `entries`, its section's in
 * file order, `to` a place on screen: one up or down, or the top or the bottom. A move past an end
 * stays at it. Running entries are no stop.
 */
export function moveIndex(entries: ReadonlyArray<PriorityEntry>, key: string, to: Direction) {
  const { count, index } = onScreen(entries, key);
  const target = {
    bottom: count - 1,
    down: index + 1,
    top: 0,
    up: index - 1,
  }[to];
  return fileIndex(entries, key, Math.max(0, Math.min(count - 1, target)));
}

/** Whether a card has a card above it on screen to move up past, and one below it to move down. */
export function movesOf(entries: ReadonlyArray<PriorityEntry>, key: string) {
  const { count, index } = onScreen(entries, key);
  return { down: index >= 0 && index < count - 1, up: index > 0 };
}
