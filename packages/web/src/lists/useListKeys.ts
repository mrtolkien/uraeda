// The keys of a list whose rows open a pane, as the UI behaviour decision asks, declared in the key
// registry: ↑ ↓ or j k (and + -) move the focus to the previous or next row, Home and End to the
// first and last, across sections; Enter edits the selected item; Escape closes the pane. A list in
// columns keeps them inside the column, and adds h l and ← → to the same row of the neighbouring
// column, or its last row when that is shorter. J K H L and Shift with the arrows move the selected
// item itself, where the list can. They act only when the focus is on a row or on the page itself;
// the registry holds them back in a text field and under any open layer.
import { useListFocus } from "@astryxdesign/core/hooks";
import { useCallback, useLayoutEffect, useRef } from "react";
import { type Binding, useKeys } from "../keys/registry.tsx";
import { type Columns, destination, type Move } from "./destination.ts";

export type { Columns };

/**
 * The rows' links, in the list's order: each row marks its item with `data-row`, and a row a list
 * opens itself holds a button, in a `data-row-link`, where the others hold a link.
 */
const ROW = "[data-row] a[href], [data-row-link] button";

/** The key a row names itself with, `data-row-key`: what the list's own order is read by. */
const ROW_KEY = "data-row-key";

/**
 * A move of the selected item itself, which `onMoveItem` is called with: a step, or `to:<id>`, to
 * the end of the section a picker chose.
 */
export type ItemMove = "up" | "down" | "left" | "right" | `to:${string}`;

type Keys<Kind> = ReadonlyArray<readonly [keys: string, move: Kind, label: string]>;

/** The keys that move the selection, each with its label. */
const MOVES: Keys<Move> = [
  ["j", "next", "move"],
  ["ArrowDown", "next", "next row"],
  ["+", "next", "next row"],
  ["k", "previous", "previous row"],
  ["ArrowUp", "previous", "previous row"],
  ["-", "previous", "previous row"],
  ["Home", "first", "first row"],
  ["End", "last", "last row"],
];

/** The keys between columns: only a list in columns binds them. */
const COLUMN_MOVES: Keys<Move> = [
  ["h", "left", "column"],
  ["ArrowLeft", "left", "previous column"],
  ["l", "right", "next column"],
  ["ArrowRight", "right", "next column"],
];

/** The keys that move the selected item: only a list that can move items binds them. */
const ITEM_MOVES: Keys<ItemMove> = [
  ["J", "down", "move item down"],
  ["shift+ArrowDown", "down", "move item down"],
  ["K", "up", "move item up"],
  ["shift+ArrowUp", "up", "move item up"],
  ["H", "left", "move item to the previous column"],
  ["shift+ArrowLeft", "left", "move item to the previous column"],
  ["L", "right", "move item to the next column"],
  ["shift+ArrowRight", "right", "move item to the next column"],
];

/**
 * The keys of the move mode `m` puts a row in: the keys that move the selection move the row
 * instead, as many times as wanted, which the row's bar names.
 */
const MOVE_MODE: Keys<ItemMove> = [
  ["j", "down", "move item down"],
  ["ArrowDown", "down", "move item down"],
  ["k", "up", "move item up"],
  ["ArrowUp", "up", "move item up"],
  ["h", "left", "move item to the previous section"],
  ["ArrowLeft", "left", "move item to the previous section"],
  ["l", "right", "move item to the next section"],
  ["ArrowRight", "right", "move item to the next section"],
];

/** The keys that end the move mode, where the row is. */
const MOVE_ENDS = ["Escape", "Enter", "m"];

const NO_KEYS: ReadonlyArray<RowKey> = [];

/** The hint of a key of the tables above, which only the first key of each pair names. */
const HINTS: Record<string, string> = { h: "h l", j: "j k" };

/**
 * A key of the page that acts on the row the focus is on, or the selected one, `o`, `i`, `m`:
 * `run` gets the row's index, and returns `false` where the row has nothing for it, which leaves the
 * key to the page. `hint` is what the status line draws, none for a key it leaves out.
 */
export type RowKey = {
  hint?: string;
  keys: string;
  label: string;
  run: (row: number) => boolean | void;
};

/**
 * The index of the row a link is in: its place among the `links`, or with `keys`, the place of its
 * row's `data-row-key` among them, -1 for a link that is no row's.
 */
function indexOfLink(
  links: ReadonlyArray<Element>,
  keys: ReadonlyArray<string> | undefined,
  target: EventTarget | null,
) {
  const link = links.find((one) => one === target);
  if (link === undefined) {
    return -1;
  }
  return keys === undefined
    ? links.indexOf(link)
    : keys.indexOf(link.closest("[data-row]")?.getAttribute(ROW_KEY) ?? "");
}

/**
 * Puts the focus on the link of the row at `index`, the row a `keys`' index names: a row edited
 * in place draws no link, and the focus stays where it is. Returns whether it moved.
 */
function focusRowAt(
  links: ReadonlyArray<Element>,
  keys: ReadonlyArray<string> | undefined,
  index: number,
  focusItem: (at: number) => void,
) {
  const at = links.findIndex((link) => indexOfLink(links, keys, link) === index);
  if (at === -1) {
    return false;
  }
  focusItem(at);
  return true;
}

/** Where a list's keys act, and what they do there. */
type Acts = {
  edit: (row: number) => boolean;
  item: (move: ItemMove, row: number) => void;
  /** Returning `false` says the list has no row to move on. */
  move: (move: Move, row: number) => boolean | void;
  /** The row a key pressed at `target` acts on, -1 for none selected, null where it is not ours. */
  rowAt: (target: EventTarget | null) => number | null;
};

/**
 * The list's bindings, with the hints the status line names: `j k move`, `h l column` only with
 * columns, and Escape's; Enter and `m` are the row's, in its bar. With `isOff`, a layer the list
 * owns holds the keys, and only Escape's stays named, as the layer's owner keeps it. With
 * `onMoveEnd`, the selected row is in the move mode: its keys alone, which its bar names.
 */
function bindingsOf({
  acts,
  canMoveItems,
  columns,
  escapeLabel,
  isOff,
  onClose,
  onMoveEnd,
  rowKeys,
}: {
  acts: Acts;
  canMoveItems: boolean;
  columns: boolean;
  escapeLabel: string | null;
  isOff: boolean;
  onClose: () => boolean;
  onMoveEnd: (() => void) | undefined;
  rowKeys: ReadonlyArray<RowKey>;
}): ReadonlyArray<Binding> {
  const when = (target: EventTarget | null) => acts.rowAt(target) !== null;
  /** Runs `act` on the row of the key, or says the key is not the list's to take. */
  const onRow = (act: (row: number) => boolean | void) => (event: KeyboardEvent) => {
    const row = acts.rowAt(event.target);
    return row === null || act(row) === false ? (false as const) : undefined;
  };
  if (onMoveEnd !== undefined && canMoveItems && !isOff) {
    return [
      ...[...MOVE_MODE, ...ITEM_MOVES].map(([keys, move, label]) => ({
        keys,
        label,
        run: onRow((row) => acts.item(move, row)),
        when,
      })),
      ...MOVE_ENDS.map((keys) => ({ keys, label: "done moving", run: onMoveEnd, when })),
    ];
  }
  const hint = (keys: string) => (isOff || HINTS[keys] === undefined ? {} : { hint: HINTS[keys] });
  const moves: ReadonlyArray<Binding> = [...MOVES, ...(columns ? COLUMN_MOVES : [])].map(
    ([keys, move, label]) => ({
      ...hint(keys),
      keys,
      label,
      run: onRow((row) => acts.move(move, row)),
      when,
    }),
  );
  const items: ReadonlyArray<Binding> = canMoveItems
    ? ITEM_MOVES.map(([keys, move, label]) => ({
        // No hint: `m` is the row's, in its bar (see `useRowKeys`), and the keys after it show in
        // the leader's menu.
        keys,
        label,
        run: onRow((row) => acts.item(move, row)),
        when,
      }))
    : [];
  const own: ReadonlyArray<Binding> = rowKeys.map(({ hint: named, keys, label, run }) => ({
    ...(isOff || named === undefined ? {} : { hint: named }),
    keys,
    label,
    run: onRow((row) => row !== -1 && run(row)),
    when,
  }));
  return [
    ...moves,
    ...items,
    ...own,
    {
      // No hint: opening is the row's, in its bar (see `useRowKeys`).
      keys: "Enter",
      label: "open",
      run: onRow(acts.edit),
      when,
    },
    {
      ...(escapeLabel === null ? {} : { hint: "esc", hintInLayer: isOff }),
      keys: "Escape",
      label: escapeLabel ?? "close",
      run: () => (onClose() ? undefined : false),
      // As before the registry: Escape is the list's on a row or the page, not on a control elsewhere.
      when,
    },
  ];
}

/**
 * The keyboard of a list: `selected` is the index of the row open in the pane, -1 for none.
 * `onSelect(index)` is called once the focus moved to a row; `onEdit()` on Enter on the selected
 * row, returning whether it edited, else the row's link opens it; `onClose()` on Escape, returning
 * whether it closed something. `escapeLabel` is what the status line says Escape does, "close" by
 * default, or `null` where it does nothing. `columns` says the list is in columns, and which rows
 * each holds (see `Columns`): its keys move inside a column and between them. `onMoveItem(move,
 * row)` is given by a list whose items can move: `J K H L` and Shift with the arrows call it with
 * the row the focus is on, or the selected one when the focus is on the page; without it those
 * keys are not bound. `rowKeys` are the page's own keys on a row, bound once (`RowKey`). `keys` are
 * the keys of the rows in the order `selected`, `columns`, and the rows given to the keys use, where
 * a row may draw no link, as one edited in place: a row is then found by its `data-row-key`, never
 * by its place among the links; without them the rows are the links, in the order they are drawn.
 * `isOff` says a layer the list owns, like its overlay, holds the keys: the status line then names
 * only Escape's. Returns the ref of the list's element, and what focuses the selected row.
 */
export function useListKeys({
  columns,
  escapeLabel = "close",
  isOff = false,
  keys,
  onClose,
  onEdge,
  onEdit,
  onMoveEnd,
  onMoveItem,
  onSelect,
  rowKeys = NO_KEYS,
  selected,
}: {
  columns?: Columns;
  escapeLabel?: string | null;
  isOff?: boolean;
  keys?: ReadonlyArray<string>;
  onClose: () => boolean;
  /**
   * A move up from the top row of a column, or any move with no row selected (`row` -1): `true`
   * says what is around the list took it, as home's panes above it do.
   */
  onEdge?: ((move: Move, row: number) => boolean) | undefined;
  onEdit: () => boolean;
  /** Given while the selected row is in the move mode: what ends it. */
  onMoveEnd?: () => void;
  onMoveItem?: (move: ItemMove, row: number) => void;
  onSelect: (index: number) => void;
  rowKeys?: ReadonlyArray<RowKey>;
  selected: number;
}) {
  const { focusItem, getItems, listRef } = useListFocus<HTMLDivElement>({ itemSelector: ROW });
  const rows = { getItems, keys };
  const latest = useRef(rows);
  useLayoutEffect(() => {
    latest.current = rows;
  });
  const focusRow = (index: number) => focusRowAt(getItems(), keys, index, focusItem);
  const acts: Acts = {
    edit: (row) => row === selected && selected !== -1 && onEdit(),
    item: (move, row) => {
      if (row !== -1) {
        onMoveItem?.(move, row);
      }
    },
    move: (move, row) => {
      const count = keys?.length ?? getItems().length;
      if (count === 0) {
        return false;
      }
      const to = destination(move, row, count, columns);
      // Up past the top of its column, or any move with no row selected: what is around the list
      // may take the focus.
      const isEdge = row === -1 || (move === "previous" && to === row);
      if (isEdge && onEdge?.(move, row) === true) {
        return true;
      }
      if (to !== -1 && focusRow(to)) {
        onSelect(to);
      }
      return true;
    },
    rowAt: (target) => {
      const row = indexOfLink(getItems(), keys, target);
      // The page, or the list's own region, which a click in the room under a short column focuses.
      const onPage =
        target === document.body ||
        target === document.documentElement ||
        (target instanceof HTMLElement && target.hasAttribute("data-list-page"));
      return row !== -1 || onPage ? (row === -1 ? selected : row) : null;
    },
  };
  useKeys(
    bindingsOf({
      acts,
      canMoveItems: onMoveItem !== undefined,
      columns: columns !== undefined,
      escapeLabel,
      isOff,
      onClose,
      onMoveEnd,
      rowKeys,
    }),
  );

  const focusSelected = useCallback(() => {
    return (
      selected !== -1 &&
      focusRowAt(latest.current.getItems(), latest.current.keys, selected, focusItem)
    );
  }, [focusItem, selected]);
  return { focusSelected, ref: listRef };
}
