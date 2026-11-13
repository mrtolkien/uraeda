// A transcript's rows, read by pages: a session is its turns' ids, a turn its count of pages, and
// a page a `TurnLog` of 100 items (`app/store/README.md`). Only a window is read: the turns and
// pages of the rows within two screens of those shown, and the last turn's last page, which grows.
// A turn not read yet is one row that says so, and so is a page; each becomes its items once read.
// What the window read stays read until the rows shown are six screens away from it, so a page
// read never pushes the window off itself; it is then let go, after the store's grace.
//
// A row's id is `${turn}/${item}` for an item, `${turn}#${page}` for a page not read, and the
// turn's id for a turn not read. Its object is kept for as long as its id is in the rows, so the
// list keeps its cell; the rows change when an item comes or goes, never for a piece of a reply.
//
// A reply that streams is split into its blocks as they finish (ruling R472): each finished block
// is a row of its own, `${turn}/${item}~${block}#${page}`, before the reply's row, which draws only
// the block still growing. So the list lays out and paints the rows shown, and a long reply costs
// a frame what a short one does.
import { type Accessor, computed, effect, signal, untracked } from "nsh";
import { list, type Live, record, type RowOf, text } from "../../store";
import type { Item, Session, Turn, TurnLog } from "../../store/protocol";
import type { Read } from "../../ui/document";
import { isChats } from "./words";

/** What a row of the transcript stands for. */
export type Entry =
  | {
      kind: "item";
      /** The item as it is now, from its own signal. */
      item: () => Item | undefined;
      /** A text's words, which grow by appends while it streams. */
      text: Accessor<string>;
      turn: string;
    }
  | { kind: "waiting"; turn: string }
  /** A finished block of a reply split into rows: the reply's first or a later one. */
  | { kind: "block"; read: () => Read | undefined; first: boolean; reply: string; turn: string };

/** What the transcript's list reads: its rows, what each stands for, and where it is. */
export type Feed = {
  rows: Accessor<ReadonlyArray<RowOf>>;
  entry: (row: string) => Entry | undefined;
  /** The list says which rows it shows, by index: the window follows them. */
  shown: (first: number, last: number) => void;
  /**
   * A reply's row hears its finished blocks, each a row before it: a feed without draws a reply
   * whole, in its row, as the gallery's scene does.
   */
  finished?: (row: string, blocks: ReadonlyArray<Read>) => void;
  /** How many of a reply's blocks are rows of their own: none for a reply drawn whole. */
  split?: (row: string) => number;
};

/** How many rows past those shown are read, at the least, either way. */
const MARGIN = 40;
/** How much farther than the window what was read stays read. */
const KEPT = 3;

/** The record of a turn, and its count of pages: -2 until read, -1 for no such turn. */
type HeldTurn = { pages: Accessor<number>; live: Live<Turn | null> };

/** The turn and the page a row is of, `turn` or `turn#page`: what reads it. */
function holderOf(row: string): string {
  const slash = row.indexOf("/");
  if (slash === -1) return row;
  const hash = row.indexOf("#", slash);
  return hash === -1 ? row.slice(0, slash) : row.slice(hash + 1);
}

/** The keys of the rows from `from` to `to`, each page's with its turn's. */
function keysOf(rows: ReadonlyArray<RowOf>, from: number, to: number, into: Set<string>) {
  for (let at = Math.max(0, from); at < Math.min(rows.length, to); at += 1) {
    const holder = holderOf(rows[at]!.id);
    const hash = holder.indexOf("#");
    into.add(hash === -1 ? holder : holder.slice(0, hash));
    if (hash !== -1) into.add(holder);
  }
}

/**
 * Which items a feed lists, the chat's unless given; and whether each turn has a row of its own
 * first, its id the turn's, as a turn not read yet has: the Activity's runs' heads.
 */
export type FeedOptions = { keep?: (item: Item) => boolean; heads?: boolean };

/** The rows of `session`'s transcript in `repo`, read by a window of pages. Call it in a view. */
// oxlint-disable-next-line max-lines-per-function -- the transcript's window of pages, read and let go in one effect; the row array can be a function of its own
export function transcriptFeed(
  repo: Accessor<string>,
  session: Accessor<Session | null | undefined>,
  options: FeedOptions = {},
): Feed {
  const keep = options.keep ?? isChats;
  const shown = signal({ first: -1, last: -1 });
  /** The finished blocks of the replies split into rows, by their rows, and how many, by row. */
  const blocks = new Map<string, ReadonlyArray<Read>>();
  const counts = signal<ReadonlyMap<string, number>>(new Map());
  /** What is read now, sorted and joined: the window changes it, as the rows and the list move. */
  const keys = signal("");
  const objects = new Map<string, RowOf>();
  const rowOf = (id: string) => {
    let row = objects.get(id);
    if (row === undefined) {
      row = { id };
      objects.set(id, row);
    }
    return row;
  };

  /**
   * The records read, by `turn` and `turn#page`: held by this computation, and let go, after the
   * store's grace, when it runs again without them.
   */
  const held = computed(() => {
    const turns = new Map<string, HeldTurn>();
    const pages = new Map<string, Live<TurnLog | null>>();
    const name = repo();
    for (const key of keys().split("\n")) {
      if (key === "") continue;
      const hash = key.indexOf("#");
      if (hash === -1) {
        const live = record("Turn", { id: key, repo: name });
        const count = computed(() => {
          const value = live();
          return value === undefined ? -2 : value === null ? -1 : value.pages;
        });
        turns.set(key, { live, pages: count });
      } else {
        const turn = key.slice(0, hash);
        pages.set(key, record("TurnLog", { page: Number(key.slice(hash + 1)), repo: name, turn }));
      }
    }
    return { pages, turns };
  });

  /** A page's items, once read. */
  const itemsOf = (key: string) => {
    const live = held().pages.get(key);
    return live === undefined || live() == null ? undefined : list<Item>(live, ["items"]);
  };

  const rows = computed(() => {
    const out: Array<RowOf> = [];
    const { turns } = held();
    for (const turn of session()?.turns ?? []) {
      const count = turns.get(turn)?.pages() ?? -2;
      if (count === -1) continue;
      if (count === -2) {
        out.push(rowOf(turn));
        continue;
      }
      if (options.heads === true) out.push(rowOf(turn));
      for (let page = 0; page < count; page += 1) {
        const key = `${turn}#${page}`;
        const items = itemsOf(key);
        if (items === undefined) {
          out.push(rowOf(key));
          continue;
        }
        const split = counts();
        for (const { id } of items.rows()) {
          const item = untracked(() => items.item(id));
          if (item !== undefined && !keep(item)) continue;
          const row = `${turn}/${id}#${key}`;
          for (let block = 0; block < (split.get(row) ?? 0); block += 1) {
            out.push(rowOf(`${turn}/${id}~${block}#${key}`));
          }
          out.push(rowOf(row));
        }
      }
      // A head stays when nothing is under it: a turn read must never take its rows away, or the
      // window, which reads what is near the rows shown, would read on and on.
    }
    return out;
  });

  // The window: what the rows near those shown need, what was read and is still near, and the
  // last turn with its last page. It writes what is read, which the rows then follow.
  effect(() => {
    const now = rows();
    const { first, last } = shown();
    const span = Math.max(MARGIN, 2 * (last - first + 1));
    const [from, to] = first < 0 ? [now.length - span, now.length] : [first - span, last + span];
    const near = new Set<string>();
    keysOf(now, from, to, near);
    const far = new Set<string>();
    keysOf(now, from - KEPT * span, to + KEPT * span, far);
    for (const key of untracked(keys).split("\n")) {
      if (key !== "" && far.has(key)) near.add(key);
    }
    // A feed that leaves items out reads every page of a turn near: a page of no row would hold
    // no key, be let go, show unread, and be read again, without end.
    if (options.keep !== undefined) {
      for (const key of near) {
        if (key.includes("#")) continue;
        const count = held().turns.get(key)?.pages() ?? 0;
        for (let page = 0; page < count; page += 1) near.add(`${key}#${page}`);
      }
    }
    const tail = session()?.turns.at(-1);
    if (tail !== undefined) {
      near.add(tail);
      const count = held().turns.get(tail)?.pages() ?? 0;
      if (count > 0) near.add(`${tail}#${count - 1}`);
    }
    const next = [...near].toSorted().join("\n");
    if (next !== untracked(keys)) keys.set(next);
  });

  const entries = new Map<string, Entry>();
  return {
    entry: (row) => {
      let entry = entries.get(row);
      if (entry === undefined) {
        const slash = row.indexOf("/");
        const hash = row.indexOf("#");
        if (slash === -1) {
          entry = { kind: "waiting", turn: hash === -1 ? row : row.slice(0, hash) };
        } else {
          const turn = row.slice(0, slash);
          const page = row.slice(row.indexOf("#", slash) + 1);
          const id = row.slice(slash + 1, row.indexOf("#", slash));
          const tilde = id.indexOf("~");
          if (tilde !== -1) {
            const reply = `${turn}/${id.slice(0, tilde)}#${page}`;
            const block = Number(id.slice(tilde + 1));
            const read = () => blocks.get(reply)?.[block];
            entry = { first: block === 0, kind: "block", read, reply, turn };
            entries.set(row, entry);
            return entry;
          }
          // Read through the page held now: a page let go and read again is another record.
          entry = {
            item: () => itemsOf(page)?.item(id),
            kind: "item",
            text: () => {
              const live = held().pages.get(page);
              return live === undefined ? "" : text(live, ["items", id, "text"])();
            },
            turn,
          };
        }
        entries.set(row, entry);
      }
      return entry;
    },
    finished: (row, finished) => {
      blocks.set(row, finished);
      if (untracked(counts).get(row) === finished.length) return;
      counts.set(new Map(untracked(counts)).set(row, finished.length));
    },
    rows,
    split: (row) => counts().get(row) ?? 0,
    shown: (first, last) => {
      const now = untracked(shown);
      if (now.first !== first || now.last !== last) shown.set({ first, last });
    },
  };
}
