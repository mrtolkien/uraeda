// Where a proposal moved by a drop or its keys lands in the file: a place found on screen, where
// the running entries show in Ongoing, turned into the file's index.
import type { Proposal } from "uraeda-server/fate";
/**
 * Where a row dropped at `index` among a section's rows on screen goes in the file: the place of
 * the `index`-th entry that is not running, once the dragged one is taken out, or after the last of
 * them. The running entries show in "Ongoing", so a drop never lands between two of them.
 */
export function fileIndex(entries: ReadonlyArray<Proposal>, key: string, index: number) {
  const rest = entries.filter((entry) => entry.key !== key);
  const places = rest.flatMap((entry, place) => (entry.running ? [] : [place]));
  if (index < places.length) {
    return places[index];
  }
  const last = places.at(-1);
  return last === undefined ? rest.length : last + 1;
}
