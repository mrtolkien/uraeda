// The priorities' order, as the page shows it and as a move is sent: plain functions over the
// proposals' keys, so what is drawn and what is written count the same way.
//
// The file keeps a running proposal in its section; the page shows the running ones apart, in
// Ongoing, so a section shows only its proposals that do not run. A move is made among those, and
// sent as the file's place: `proposals.move` names the proposal by its id in the file, as the
// order stands before the move, and its place among the section's lines, the moved one taken out.
import type { Priorities, ProposalItem, ProposalsMove } from "../../store/protocol";

/** Each section's proposals' keys, in the file's order, the running ones included. */
export type Arrangement = Readonly<Record<string, ReadonlyArray<string>>>;

/** A move the human made: the proposal `key` to `index` among the rows `section` shows. */
export type Move = { key: string; section: string; index: number };

/** The sections of the file, in its order: `now`, `next`, `later`, `blocked`. */
export const arrangementOf = (priorities: Priorities): Arrangement =>
  Object.fromEntries(
    priorities.sections.map((section) => [
      section.section,
      section.proposals.map((proposal) => proposal.key),
    ]),
  );

/** Every proposal, by its key. */
export const byKey = (priorities: Priorities): ReadonlyMap<string, ProposalItem> =>
  new Map(
    priorities.sections.flatMap((section) =>
      section.proposals.map((proposal) => [proposal.key, proposal] as const),
    ),
  );

/** The section a key is in, and its place there. */
function find(order: Arrangement, key: string): { section: string; at: number } | undefined {
  for (const [section, keys] of Object.entries(order)) {
    const at = keys.indexOf(key);
    if (at !== -1) return { at, section };
  }
  return undefined;
}

/**
 * Where a row shown at `index` among a section's rows goes in the file: before the `index`-th
 * line that does not run, once the moved one is out, or after the last of them. A drop never lands
 * between two running lines, which show apart.
 */
export function fileIndex(
  keys: ReadonlyArray<string>,
  index: number,
  runs: (key: string) => boolean,
) {
  const places = keys.flatMap((key, place) => (runs(key) ? [] : [place]));
  if (index < places.length) return places[index]!;
  const last = places.at(-1);
  return last === undefined ? keys.length : last + 1;
}

/**
 * The one write a move makes, and the order once it is written: `undefined` for a move that goes
 * nowhere, or of a proposal the order does not hold.
 */
export function moveOf(
  order: Arrangement,
  move: Move,
  runs: (key: string) => boolean,
): { input: Omit<ProposalsMove, "repo" | "hash">; after: Arrangement } | undefined {
  const from = find(order, move.key);
  const target = order[move.section];
  if (from === undefined || target === undefined) return undefined;
  const rest = target.filter((key) => key !== move.key);
  const index = fileIndex(rest, move.index, runs);
  if (from.section === move.section && index === from.at) return undefined;
  const placed = [...rest.slice(0, index), move.key, ...rest.slice(index)];
  const after: Record<string, ReadonlyArray<string>> = {};
  for (const [section, keys] of Object.entries(order)) {
    after[section] = section === move.section ? placed : keys.filter((key) => key !== move.key);
  }
  return {
    after,
    input: { index, proposal: `${from.section}-${from.at + 1}`, section: move.section },
  };
}

/** The rows a section shows: its proposals that do not run, in the file's order. */
export const shownIn = (order: Arrangement, section: string, runs: (key: string) => boolean) =>
  (order[section] ?? []).filter((key) => !runs(key));
