// What the Activity draws of the pages of turns it read: each turn a run, its main agent's calls
// and thoughts its rows, each sub-agent's own calls and thoughts its group, and the stretch each
// row belongs to, joined across pages by the chat's rule (ruling R18). Which rows draw within the
// bound is decided here too, so the panel only draws.
import type { TranscriptItem } from "../TranscriptMessages.tsx";
import {
  type ActivityItem,
  joinStretches,
  pageEnd,
  slotsOf,
  type Stretch,
  THROUGH,
} from "./stretches.ts";

/** A page of a turn the Activity read: its items, in order. */
export type ReadPage = { items: ReadonlyArray<TranscriptItem>; page: number; turn: string };

/** A run as the Activity read it: the pages of its turn from the earliest read to its last. */
export type Run = {
  /** The calls and thoughts of each sub-agent, in order, by its starting call's id. */
  groups: ReadonlyMap<string, ReadonlyArray<ActivityItem>>;
  /** The main agent's calls and thoughts, in order: the run's rows. */
  rows: ReadonlyArray<ActivityItem>;
  /** The first page of its turn read: 0 when `rows` start at the turn's first row. */
  start: number;
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
 * takes its key, so a stretch over pages has one key, as its recap line does. A page of a
 * sub-agent's items alone is seen through.
 */
function stretchesOf(
  turn: string,
  pages: ReadonlyArray<ReadonlyArray<TranscriptItem>>,
): Map<number, string> {
  const keys = new Map<number, string>();
  let open: Stretch | undefined;
  for (const items of pages) {
    const slots = slotsOf(turn, items);
    if (pageEnd(slots) === THROUGH) {
      // A page of a sub-agent's items alone: the stretch open before it goes on after it.
      continue;
    }
    let last: Stretch | undefined;
    for (const slot of slots) {
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

/** A turn's run, from its pages read, in order, the first of them `start`. */
function runOf(
  turn: string,
  pages: ReadonlyArray<ReadonlyArray<TranscriptItem>>,
  start: number,
): Run {
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
  return { groups, rows, start, stretches: stretchesOf(turn, pages), turn };
}

/** The runs of the pages read, the earliest first: consecutive pages of a turn are one run. */
export function runsOf(read: ReadonlyArray<ReadPage>): Array<Run> {
  const turns: Array<{ pages: Array<ReadonlyArray<TranscriptItem>>; start: number; turn: string }> =
    [];
  for (const { items, page, turn } of read) {
    const last = turns.at(-1);
    if (last?.turn === turn) {
      last.pages.push(items);
    } else {
      turns.push({ pages: [items], start: page, turn });
    }
  }
  return turns.map(({ pages, start, turn }) => runOf(turn, pages, start));
}

/** The count of a main agent's calls and thoughts in a page's items, as the bound counts them. */
export function rowCount(items: ReadonlyArray<TranscriptItem>): number {
  return items.filter((item) => isActivity(item) && item.parent === undefined).length;
}

/** The rows each run draws, `from` its first to before `to`, and whether rows are left out. */
export type Drawn = {
  /** Whether rows of the runs are left out before those drawn. */
  earlier: boolean;
  from: Array<number>;
  /** Whether rows of the runs are left out after those drawn. */
  later: boolean;
  to: Array<number>;
};

/**
 * Which rows of the runs draw: from the row `split`, counted over the runs in order, as many as
 * weigh `after` forward, and as many as weigh `before` back, a row weighing `weight`. The first row
 * of the stretch `stretch` draws whatever its rows before weigh, so a stretch the window starts at
 * is never left out.
 */
export function drawnRows(
  runs: ReadonlyArray<Run>,
  { after, before, split }: { after: number; before: number; split: number },
  weight: (run: Run, row: ActivityItem) => number,
  stretch: string | undefined,
): Drawn {
  const flat = runs.flatMap((run, at) => run.rows.map((row, place) => ({ at, place, row, run })));
  let first = split;
  for (let total = 0; first > 0 && total < before;) {
    first -= 1;
    total += weight(flat[first]!.run, flat[first]!.row);
  }
  let last = split;
  for (let total = 0; last < flat.length && total < after; last++) {
    total += weight(flat[last]!.run, flat[last]!.row);
  }
  const marked = flat.findIndex(({ row, run }) => run.stretches.get(row.seq) === stretch);
  if (stretch !== undefined && marked >= last) {
    last = marked + 1;
  }
  const from = runs.map((run) => run.rows.length);
  const to = runs.map(() => 0);
  for (const { at, place } of flat.slice(first, last)) {
    from[at] = Math.min(from[at]!, place);
    to[at] = place + 1;
  }
  return { earlier: first > 0, from, later: last < flat.length, to };
}
