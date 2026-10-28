// What the pointer does on a row of a list of work (see `WorkList`): a click shows its bar or opens
// it, the mouse passing over selects it, and a press on the move mode's bar moves it.
import type { WorkRow } from "./Card.tsx";
import type { BarAction } from "./RowBar.tsx";
import type { ItemMove } from "./useListKeys.ts";

/**
 * The bar of the row in the move mode: its keys, which move it, and the one that ends it, `onDone`.
 * A press on one moves it too. In columns, the sideways keys go to the next column; one under the
 * other, to the next section.
 */
export function moveBarOf(
  row: WorkRow,
  rows: ReadonlyArray<WorkRow>,
  {
    asColumns,
    onDone,
    onMoveItem,
  }: {
    asColumns: boolean;
    onDone: () => void;
    onMoveItem: ((move: ItemMove, at: number) => void) | undefined;
  },
): ReadonlyArray<BarAction> {
  const step = (move: ItemMove) => () => {
    const at = rows.findIndex((one) => one.key === row.key);
    if (at !== -1) {
      onMoveItem?.(move, at);
    }
  };
  const across = asColumns ? "column" : "section";
  return [
    { keys: "k", label: "up", run: step("up") },
    { keys: "j", label: "down", run: step("down") },
    ...(row.parent === undefined
      ? [
          { keys: "h", label: `previous ${across}`, run: step("left") },
          { keys: "l", label: `next ${across}`, run: step("right") },
        ]
      : []),
    { keys: "⏎", label: "done", run: onDone },
  ];
}

/** What the pointer's handlers of the rows are made with: the list's selection and its state. */
type Pointing = {
  barOf: (row: WorkRow) => ReadonlyArray<BarAction>;
  barred: string | undefined;
  /** A card is edited. */
  isHeld: boolean;
  isTyping: boolean;
  open: (row: WorkRow) => void;
  pick: (key: string) => void;
  rows: ReadonlyArray<WorkRow>;
  selected: string | undefined;
  setBarred: (key: string | undefined) => void;
  setSelected: (key: string | undefined) => void;
};

/** The rows' handlers of a click (`clickOpen`) and of the mouse passing over (`hover`). */
export function rowPointer({
  barOf,
  barred,
  isHeld,
  isTyping,
  open,
  pick,
  rows,
  selected,
  setBarred,
  setSelected,
}: Pointing) {
  /**
   * A click on a row that can do more than open shows its bar first, and a click on it with its bar
   * shown opens it, as a double click does: the mouse reaches its actions before its field. Enter,
   * and a click on an Add row or a row that only opens, open it at once.
   */
  const clickOpen = (row: WorkRow, isClick: boolean) => {
    const isBarShown = !isTyping && barred === row.key && selected === row.key;
    if (isClick && !row.isAdd && !isBarShown && barOf(row).length > 1) {
      pick(row.key);
      return;
    }
    open(row);
  };
  // The mouse moving over a card selects it and takes the focus to it, so the keys act on what the
  // pointer is on. Not while a card is edited, nor during a drag.
  const hover = (row: WorkRow) => {
    const isBusy =
      isHeld ||
      rows.some((one) => one.isFresh) ||
      document.querySelector("[data-dragging], [data-dnd-dragging]") !== null;
    if (row.key === selected || isBusy) {
      return;
    }
    setSelected(row.key);
    setBarred(undefined);
    controlOf(row.key)?.focus({ preventScroll: true });
  };
  return { clickOpen, hover };
}

/**
 * The control of the row `key`, which takes its focus: the button of a row the list opens itself,
 * in its `data-row-link`, or its link. A plain list of selectors, each from the row: `:is()` would
 * match the button's wrapper in happy-dom, where a browser matches the button.
 */
export function controlOf(key: string) {
  const row = `[data-row-key="${CSS.escape(key)}"]`;
  return document.querySelector<HTMLElement>(`${row} [data-row-link] button, ${row} a[href]`);
}
