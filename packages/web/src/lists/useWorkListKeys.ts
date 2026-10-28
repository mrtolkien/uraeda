// The keys of a list of work, and its focus (see `WorkList`): the selection moved through every row
// and across its columns, the rows gliding to where the keys moved them, and the focus put back on
// the selection.
import type { WorkRow } from "./Card.tsx";
import { useRowShifts } from "./rowShifts.ts";
import { columnsOf, type ShownList } from "./useShown.ts";
import { useListKeys } from "./useListKeys.ts";
import { useRefocus } from "./useRefocus.ts";
import type { useRowCommands } from "./useRowCommands.ts";
import type { WorkListProps } from "./workSection.ts";

/** What the list's keys are given: the list as it shows, its selection, and its commands. */
type Keyed = {
  asColumns: boolean;
  /** A drag is on, or ending: no row glides. */
  isDragging: boolean;
  isFocused: boolean;
  named: string | undefined;
  onEdge: WorkListProps["onEdge"];
  pick: (key: string) => void;
  placed: ShownList["placed"];
  rows: ReadonlyArray<WorkRow>;
  selected: string | undefined;
  shown: ReadonlyArray<ReadonlyArray<WorkRow>>;
} & Pick<ReturnType<typeof useRowCommands>, "isMoving" | "onMoveItem" | "own" | "setMoving">;

/**
 * The list's keys (see `useListKeys`), off while an overlay the address names is open, its rows'
 * glides (see `useRowShifts`), and its focus (see `useRefocus`). Returns the list's element's ref.
 */
export function useWorkListKeys({
  asColumns,
  isDragging,
  isFocused,
  isMoving,
  named,
  onEdge,
  onMoveItem,
  own,
  pick,
  placed,
  rows,
  selected,
  setMoving,
  shown,
}: Keyed) {
  const isOpen = named !== undefined;
  const { focusSelected, ref } = useListKeys({
    columns: asColumns ? columnsOf(shown) : undefined,
    // Enter opens the focused card's link; the overlay, once open, has its own Escape.
    escapeLabel: isOpen ? "close" : null,
    isOff: isOpen,
    keys: rows.map((row) => row.key),
    onClose: () => false,
    onEdge:
      onEdge &&
      ((move, at) => {
        const key = rows[at]?.key;
        const section = placed.find((one) => one.rows.some((row) => row.key === key))?.id;
        return onEdge(move, section);
      }),
    onEdit: () => false,
    ...(isMoving ? { onMoveEnd: () => setMoving(undefined) } : {}),
    onMoveItem,
    onSelect: (index) => pick(rows[index].key),
    rowKeys: own.keys,
    selected: rows.findIndex((row) => row.key === selected),
  });
  useRowShifts(ref, isDragging, asColumns ? "columns" : "stack");
  useRefocus({
    focusSelected,
    held: own.held,
    isFocused,
    named,
    onRefocused: own.onRefocused,
    renamed: own.renamed,
    selected,
  });
  return ref;
}
