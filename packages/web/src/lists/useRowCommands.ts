// What the keys do on the selected row of a list of work (see `WorkList`): its own keys, the move
// mode `m` starts, the moves of a line and of a nested row, and opening it.
import { type Dispatch, type SetStateAction, useLayoutEffect, useRef, useState } from "react";
import type { WorkRow } from "./Card.tsx";
import type { ShownList } from "./useShown.ts";
import { type Ahead, useItemMoves } from "./useItemMoves.ts";
import type { ItemMove } from "./useListKeys.ts";
import { useRowKeys } from "./useRowKeys.ts";
import type { WorkListProps } from "./workSection.ts";

/** What the row's commands are made with: the list as it shows, and what selects a row. */
type Shown = {
  /** `d`, once confirmed, ahead of its write (see `deleteAheadOf`). */
  deleteAhead: ((row: WorkRow) => void) | undefined;
  live: ShownList["live"];
  pick: (key: string) => void;
  placed: ShownList["placed"];
  rows: ReadonlyArray<WorkRow>;
  selected: string | undefined;
  setAhead: Dispatch<SetStateAction<ReadonlyArray<Ahead>>>;
};

/**
 * The selected row's commands: the list's own keys (`own`), the move of a line or a nested row
 * (`onMoveItem`), the move mode `m` starts (`moving`, while `isMoving`), and `open`. `isTyping`
 * says a field is open, edited or new.
 */
export function useRowCommands(
  props: Pick<
    WorkListProps,
    | "onAddBeside"
    | "onMove"
    | "onOpen"
    | "onOutline"
    | "onPromote"
    | "onStart"
    | "rowActions"
    | "sectionPicker"
  >,
  { deleteAhead, live, pick, placed, rows, selected, setAhead }: Shown,
) {
  const { onMove, onOpen, onOutline, rowActions, sectionPicker } = props;
  // The row `m` put in the move mode, while it stays selected: the keys move it until it ends.
  const [moving, setMoving] = useState<string>();
  // What a picker's choice moves, as the list is when it is made.
  const moves = useRef<{
    onMoveItem?: (move: ItemMove, at: number) => void;
    rows: ReadonlyArray<WorkRow>;
  }>({ rows: [] });
  const own = useRowKeys(placed, props.onAddBeside, pick, {
    onDelete: deleteAhead,
    onMoveMode:
      onMove &&
      ((row) => {
        pick(row.key);
        setMoving(row.key);
      }),
    // The bar's `⏎ open`, as Enter or a click opens the row.
    onOpen: onOpen && ((row) => open(row)),
    onOutline,
    onPickSection: sectionPicker && {
      ...sectionPicker,
      open: (row) =>
        sectionPicker.open(row, (section) => {
          const { onMoveItem: move, rows: now } = moves.current;
          const at = now.findIndex((one) => one.key === row.key);
          if (at !== -1) {
            move?.(`to:${section}`, at);
          }
        }),
    },
    onPromote: props.onPromote,
    onStart: props.onStart,
    ...(rowActions ? { rowActions } : {}),
  });
  const onMoveLine = useItemMoves(onMove, placed, pick, { live, setAhead });
  // A nested row moves among its siblings, up or down, in its line's outline; a line, as a drop
  // would move it.
  const onMoveItem =
    onMoveLine &&
    ((move: ItemMove, at: number) => {
      const row = rows[at];
      if (row?.parent === undefined) {
        onMoveLine(move, at);
      } else if (move === "up" || move === "down") {
        onOutline?.(row, move);
      }
    });
  useLayoutEffect(() => {
    moves.current = { onMoveItem, rows };
  });
  // Not while a field is open, edited or new: the focus is the human's there.
  const isTyping = own.state.editing !== undefined || rows.some((row) => row.isFresh);
  // The move mode ends as another row is selected, or a field opens.
  const isMoving = moving !== undefined && moving === selected && !isTyping && !!onMoveItem;
  if (moving !== undefined && !isMoving) {
    setMoving(undefined);
  }
  // Enter or a click: a row edited in place opens its field, any other its page.
  const open = (row: WorkRow) => {
    pick(row.key);
    if (row.editsInPlace && own.edit(row.key)) {
      return;
    }
    onOpen?.(row.href);
  };
  return { isMoving, isTyping, moving, onMoveItem, open, own, setMoving };
}
