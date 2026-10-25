// What the Activity draws of the pages of turns it read: each turn a run, its main agent's calls
// and thoughts its rows, each sub-agent's own calls and thoughts its group, and the stretch each row
// belongs to, joined across pages by the chat's rule (ruling R18). Which rows draw within the bound
// is decided here too, so the panel only draws.
import type { TranscriptItem } from "../TranscriptMessages.tsx";
import { type ActivityItem, joinStretches, slotsOf, type Stretch } from "./stretches.ts";

/** A page of a turn the Activity read: its items, in order. */
export type ReadPage = { items: ReadonlyArray<TranscriptItem>; page: number; turn: string };

/** A run as the Activity read it: the pages of its turn from the earliest read to its last. */
export type Run = {
  /** The calls and thoughts of each sub-agent, in order, by its starting call's id. */
  groups: ReadonlyMap<string, ReadonlyArray<ActivityItem>>;
  /** The main agent's calls and thoughts, in order: the run's rows. */
  rows: ReadonlyArray<ActivityItem>;
  /** The key of the stretch each row belongs to, by the row's `seq`. */
  stretches: ReadonlyMap<number, string>;
  turn: string;
};

/** Whether an item is a call or a thought, the Activity's rows. */
const isActivity = (item: TranscriptItem): item is ActivityItem =>
  item.kind === "tool" || item.kind === "thought";

/**
 * The stretch of each of the main agent's items, by its `seq`, over a turn's pages in order: a
 * stretch `continued` at a page's start joins the page before's last when that one is `open`, and
 * takes its key, so a stretch over pages has one key, as its recap line does.
 */
function stretchesOf(
  turn: string,
  pages: ReadonlyArray<ReadonlyArray<TranscriptItem>>,
): Map<number, string> {
  const keys = new Map<number, string>();
  let open: Stretch | undefined;
  for (const items of pages) {
    let last: Stretch | undefined;
    for (const slot of slotsOf(turn, items)) {
      if (slot.kind === "item") {
        last = undefined;
        continue;
      }
      const { stretch } = slot;
      last = open && stretch.continued ? joinStretches(open, stretch) : stretch;
      for (const item of stretch.items) {
        keys.set(item.seq, last.key);
      }
    }
    open = last?.open ? last : undefined;
  }
  return keys;
}

/** A turn's run, from its pages read, in order. */
function runOf(turn: string, pages: ReadonlyArray<ReadonlyArray<TranscriptItem>>): Run {
  const rows: Array<ActivityItem> = [];
  const groups = new Map<string, Array<ActivityItem>>();
  for (const item of pages.flat()) {
    if (!isActivity(item)) {
      continue;
    }
    if (item.parent === undefined) {
      rows.push(item);
    } else {
      const group = groups.get(item.parent) ?? [];
      group.push(item);
      groups.set(item.parent, group);
    }
  }
  return { groups, rows, stretches: stretchesOf(turn, pages), turn };
}

/** The runs of the pages read, the earliest first: consecutive pages of a turn are one run. */
export function runsOf(read: ReadonlyArray<ReadPage>): Array<Run> {
  const turns: Array<{ pages: Array<ReadonlyArray<TranscriptItem>>; turn: string }> = [];
  for (const { items, turn } of read) {
    const last = turns.at(-1);
    if (last?.turn === turn) {
      last.pages.push(items);
    } else {
      turns.push({ pages: [items], turn });
    }
  }
  return turns.map(({ pages, turn }) => runOf(turn, pages));
}

/** The count of a main agent's calls and thoughts in a page's items, as the bound counts them. */
export function rowCount(items: ReadonlyArray<TranscriptItem>): number {
  return items.filter((item) => isActivity(item) && item.parent === undefined).length;
}

/**
 * Where each run's drawn rows start: the latest rows of the runs, as many as weigh `shown`, a row
 * weighing `weight`, and back to the first row of the stretch `stretch` when a run holds it.
 * `earlier`: whether rows of the runs are left out before those drawn.
 */
export function drawnFrom(
  runs: ReadonlyArray<Run>,
  shown: number,
  weight: (run: Run, row: ActivityItem) => number,
  stretch: string | undefined,
): { earlier: boolean; from: Array<number> } {
  const from = runs.map((run) => run.rows.length);
  let total = 0;
  for (let index = runs.length - 1; index >= 0 && total < shown; index--) {
    const run = runs[index]!;
    while (from[index]! > 0 && total < shown) {
      from[index]! -= 1;
      total += weight(run, run.rows[from[index]!]!);
    }
  }
  const marked = runs.findIndex((run) =>
    run.rows.some((row) => run.stretches.get(row.seq) === stretch),
  );
  if (stretch !== undefined && marked >= 0) {
    const run = runs[marked]!;
    const first = run.rows.findIndex((row) => run.stretches.get(row.seq) === stretch);
    from[marked] = Math.min(from[marked]!, first);
    from.fill(0, marked + 1);
  }
  return { earlier: from.some((start) => start > 0), from };
}
