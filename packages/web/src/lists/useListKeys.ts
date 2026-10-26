// The keys of a list whose rows open a pane, as the UI behaviour decision asks, declared in the key
// registry: ↑ ↓ or j k (and + -) move the focus to the previous or next row, Home and End to the
// first and last, across sections; Enter edits the selected item; Escape closes the pane. A list in
// columns keeps them inside the column, and adds h l and ← → to the same row of the neighbouring
// column, or its last row when that is shorter. J K H L and Shift with the arrows move the selected
// item itself, where the list can. They act only when the focus is on a row or on the page itself;
// the registry holds them back in a text field and under any open layer.
import { useListFocus } from "@astryxdesign/core/hooks";
import { useCallback } from "react";
import { type Binding, useKeys } from "../keys/registry.tsx";
import { type Columns, destination, type Move } from "./destination.ts";

export type { Columns };

/** The rows' links, in the list's order: each row marks its item with `data-row`. */
const ROW = "[data-row] a[href]";

/** A move of the selected item itself, which `onMoveItem` is called with. */
export type ItemMove = "up" | "down" | "left" | "right";

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

/** The hint of a key of the tables above, which only the first key of each pair names. */
const HINTS: Record<string, string> = { h: "h l", j: "j k" };

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
 * columns, `⏎ open`, and Escape's. With `isOff`, a layer the list owns holds the keys, and only
 * Escape's stays named, as the layer's owner keeps it.
 */
function bindingsOf({
  acts,
  canMoveItems,
  columns,
  escapeLabel,
  isOff,
  onClose,
}: {
  acts: Acts;
  canMoveItems: boolean;
  columns: boolean;
  escapeLabel: string | null;
  isOff: boolean;
  onClose: () => boolean;
}): ReadonlyArray<Binding> {
  const when = (target: EventTarget | null) => acts.rowAt(target) !== null;
  /** Runs `act` on the row of the key, or says the key is not the list's to take. */
  const onRow = (act: (row: number) => boolean | void) => (event: KeyboardEvent) => {
    const row = acts.rowAt(event.target);
    return row === null || act(row) === false ? (false as const) : undefined;
  };
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
        keys,
        label,
        run: onRow((row) => acts.item(move, row)),
        when,
      }))
    : [];
  return [
    ...moves,
    ...items,
    {
      ...(isOff ? {} : { hint: "⏎" }),
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
 * keys are not bound. `isOff` says a layer the list owns, like its overlay, holds the keys: the
 * status line then names only Escape's. Returns the ref of the list's element, and what focuses
 * the selected row.
 */
export function useListKeys({
  columns,
  escapeLabel = "close",
  isOff = false,
  onClose,
  onEdit,
  onMoveItem,
  onSelect,
  selected,
}: {
  columns?: Columns;
  escapeLabel?: string | null;
  isOff?: boolean;
  onClose: () => boolean;
  onEdit: () => boolean;
  onMoveItem?: (move: ItemMove, row: number) => void;
  onSelect: (index: number) => void;
  selected: number;
}) {
  const { focusItem, getItems, listRef } = useListFocus<HTMLDivElement>({ itemSelector: ROW });
  const acts: Acts = {
    edit: (row) => row === selected && selected !== -1 && onEdit(),
    item: (move, row) => {
      if (row !== -1) {
        onMoveItem?.(move, row);
      }
    },
    move: (move, row) => {
      const count = getItems().length;
      if (count === 0) {
        return false;
      }
      const to = destination(move, row, count, columns);
      if (to !== -1) {
        focusItem(to);
        onSelect(to);
      }
      return true;
    },
    rowAt: (target) => {
      const row = getItems().indexOf(target as Element);
      const onPage = target === document.body || target === document.documentElement;
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
    }),
  );

  const focusSelected = useCallback(() => {
    if (selected !== -1) {
      focusItem(selected);
    }
  }, [focusItem, selected]);
  return { focusSelected, ref: listRef };
}
