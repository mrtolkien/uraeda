// A list's cursor: the one row the keys and the pointer share, and the selection, which is the
// cursor's row, or a range from an anchor to it where the list allows one. It is plain state over
// the list's rows, so a screen can keep it in the visit's entry and give it back: `initial`, and
// `onChange` as it moves. It never scrolls: the list it is given to keeps its row in view.
//
// Rows read `holds(id)`, which compares ids and builds nothing, so a cursor's move redraws the two
// rows it left and reached, and a list that grows by a row costs no walk of its rows. Where an id
// sits in the rows is looked for only as a key moves the cursor.
import { type Accessor, effect, signal, untracked } from "nsh";

/** A row as a list takes it: an id, stable for the row's life, and anything else. */
export type Item = { readonly id: string };

export type CursorOptions = {
  /** The row it starts on, from the visit's entry: none by default, as a list opens. */
  initial?: string;
  /** Hears each move, to keep it in the visit's entry. */
  onChange?: (id: string | undefined) => void;
  /** Whether a range can be held: `J` `K`, Shift with the arrows. */
  range?: boolean;
};

export type Cursor<Row extends Item = Item> = {
  /** The row under the cursor, `undefined` while none is. */
  at: Accessor<string | undefined>;
  /** Where a range starts, while one is held. */
  anchor: Accessor<string | undefined>;
  /** Whether a row is selected: the cursor's, or in the range. Read by each row as it draws. */
  holds: (id: string) => boolean;
  /** The selected rows, in the list's order. */
  selected: () => ReadonlyArray<string>;
  /**
   * Puts the cursor on a row: `extend` keeps or starts a range, else it ends; `reveal` asks the
   * list to bring it into view, as a key's move does and a pointer's does not.
   */
  set: (id: string | undefined, how?: { extend?: boolean; reveal?: boolean }) => void;
  /** Moves by `by` rows; `false` at an end, so the key goes on to what is past the list. */
  move: (by: number, extend?: boolean) => boolean;
  /** To the first or the last row. */
  to: (end: "first" | "last", extend?: boolean) => boolean;
  /** Moves at each move the list must show: its row's id and a count, so the same row asks again. */
  reveal: Accessor<{ id: string; times: number } | undefined>;
  /** The rows, as the cursor was made over them. */
  items: Accessor<ReadonlyArray<Row>>;
  /** Whether it holds ranges. */
  ranges: boolean;
};

/** Where `id` is in `rows`: looked for from `hint` first, which is right unless rows moved. */
function indexOf(rows: ReadonlyArray<Item>, id: string, hint: number) {
  if (rows[hint]?.id === id) {
    return hint;
  }
  return rows.findIndex((row) => row.id === id);
}

export function createCursor<Row extends Item>(
  items: Accessor<ReadonlyArray<Row>>,
  options: CursorOptions = {},
): Cursor<Row> {
  const at = signal<string | undefined>(options.initial);
  const anchor = signal<string | undefined>(undefined);
  const reveal = signal<{ id: string; times: number } | undefined>(undefined);
  // Where the cursor's row was, last time it was looked for: the first place looked next time,
  // and where the cursor lands when its row goes.
  let place = 0;
  let times = 0;

  const put = (id: string | undefined, how: { extend?: boolean; reveal?: boolean } = {}) => {
    const was = untracked(at);
    if (how.extend === true && options.range === true) {
      if (untracked(anchor) === undefined) {
        anchor.set(was ?? id);
      }
    } else {
      anchor.set(undefined);
    }
    at.set(id);
    if (id !== undefined && how.reveal === true) {
      times += 1;
      reveal.set({ id, times });
    }
    if (id !== was) {
      options.onChange?.(id);
    }
  };

  // A row under the cursor that goes leaves the cursor where it was, on the row that takes its
  // place: one look at the old place, a walk of the rows only when rows moved before it.
  effect(() => {
    const rows = items();
    const id = untracked(at);
    if (id === undefined) {
      return;
    }
    const found = indexOf(rows, id, place);
    if (found !== -1) {
      place = found;
      return;
    }
    const next = rows[Math.min(place, rows.length - 1)];
    untracked(() => put(next?.id));
  });

  const move = (by: number, extend = false) => {
    const rows = untracked(items);
    if (rows.length === 0) {
      return false;
    }
    const id = untracked(at);
    // The first move takes the first row, or the last going up, as a list opens with none.
    if (id === undefined) {
      put(rows[by > 0 ? 0 : rows.length - 1]!.id, { extend, reveal: true });
      return true;
    }
    const from = indexOf(rows, id, place);
    const to = Math.max(0, Math.min(rows.length - 1, (from === -1 ? place : from) + by));
    if (to === from) {
      return false;
    }
    place = to;
    put(rows[to]!.id, { extend, reveal: true });
    return true;
  };

  const holds = (id: string) => {
    const start = anchor();
    if (start === undefined) {
      return at() === id;
    }
    return inRange().has(id);
  };

  // The range's rows, looked for once per move while one is held.
  let rangeOf: { anchor?: string; at?: string; rows?: ReadonlyArray<Item>; ids: Set<string> } = {
    ids: new Set(),
  };
  const inRange = () => {
    const start = anchor();
    const end = at();
    const rows = items();
    if (rangeOf.anchor !== start || rangeOf.at !== end || rangeOf.rows !== rows) {
      rangeOf = { anchor: start, at: end, rows, ids: new Set(selectedOf(rows, start, end)) };
    }
    return rangeOf.ids;
  };

  return {
    anchor,
    at,
    holds,
    items,
    move,
    ranges: options.range === true,
    reveal,
    selected: () => selectedOf(items(), anchor(), at()),
    set: (id, how) => {
      // Where a press put the cursor is where it lands when its row goes.
      if (id !== undefined) {
        const found = indexOf(untracked(items), id, place);
        if (found !== -1) {
          place = found;
        }
      }
      put(id, how);
    },
    to: (end, extend = false) => {
      const rows = untracked(items);
      const target = end === "first" ? rows[0] : rows[rows.length - 1];
      if (target === undefined || target.id === untracked(at)) {
        return false;
      }
      place = end === "first" ? 0 : rows.length - 1;
      put(target.id, { extend, reveal: true });
      return true;
    },
  };
}

/** The ids from `start` to `end`, in the rows' order: the cursor's alone without a range. */
function selectedOf(rows: ReadonlyArray<Item>, start: string | undefined, end: string | undefined) {
  if (end === undefined) {
    return [];
  }
  if (start === undefined) {
    return [end];
  }
  const a = rows.findIndex((row) => row.id === start);
  const b = rows.findIndex((row) => row.id === end);
  if (a === -1 || b === -1) {
    return [end];
  }
  return rows.slice(Math.min(a, b), Math.max(a, b) + 1).map((row) => row.id);
}
