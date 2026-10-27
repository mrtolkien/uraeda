// The keys a list gives its rows beyond moving: `o` adds beside the row, in its section, `i` turns
// it into its editor in place, `m` opens its `…` menu. Each is bound only where the list can do it,
// and acts on the row the focus is on, or the selected one (see `useListKeys`'s `rowKeys`). The state
// they set is what `Card` reads: which card is edited, and which card's menu is held open.
import { useCallback, useState } from "react";
import { deleteLine, useConfirm } from "../fields/Confirm.tsx";
import type { RowState, WorkRow } from "./Card.tsx";
import type { RowKey } from "./useListKeys.ts";

/** A section as the keys see it: its id, and its rows as they show. */
type Rows = { id: string; rows: ReadonlyArray<WorkRow> };

/**
 * The row keys of a list whose `sections` are in the order they show, and the state they set.
 * `onAddBeside(section, row)` is given by a list that adds in a place: its `o`. `i` does nothing
 * while another card's editor holds unsaved text (R83). `i` and `m` select
 * their row, so the focus has a card to return to, though a Tab put it there. `held` is the key of
 * the card whose editor or key-opened menu holds the focus, until it closes: the list takes the focus
 * back to the selected card then. `renamed` is the key of a line just saved in its card, until the
 * list took the focus to it (`onRefocused`): its key changed with its text, so it is a new card.
 */
export function useRowKeys(
  sections: ReadonlyArray<Rows>,
  onAddBeside: ((section: string, row: WorkRow) => void) | undefined,
  select: (key: string) => void,
  {
    canMoveItems = false,
    onDelete,
    onPromote,
  }: {
    /** The list moves its rows with `m` and a key after it, so `m` opens no menu. */
    canMoveItems?: boolean;
    /** What `d` calls once the human confirmed: it deletes the line. */
    onDelete?: ((row: WorkRow) => void) | undefined;
    /** What `p` calls: it makes the line a draft; `false` says the row has nothing to promote. */
    onPromote?: ((row: WorkRow) => boolean | void) | undefined;
  } = {},
) {
  const confirm = useConfirm();
  const [editing, setEditing] = useState<string>();
  const [menu, setMenu] = useState<string>();
  const [keyed, setKeyed] = useState<string>();
  const [renamed, setRenamed] = useState<string>();
  const onRefocused = useCallback(() => setRenamed(undefined), []);
  // Whether the editor open holds unsaved text.
  const [isDirty, setDirty] = useState(false);
  const rows = sections.flatMap((section) => section.rows);
  // A card that left the list, renamed or deleted, takes its editor and its menu with it.
  const isShown = (key: string | undefined) => rows.some((row) => row.key === key);
  if (editing !== undefined && !isShown(editing)) {
    setEditing(undefined);
  }
  if (menu !== undefined && !isShown(menu)) {
    setMenu(undefined);
    setKeyed(undefined);
  }

  const state: RowState = {
    editing,
    menu,
    onDirty: setDirty,
    onEdited: () => setEditing(undefined),
    // The saved line has a new key: it is the selected one, and gets the focus once it is drawn.
    onMenu: (key, isOpen) => {
      setMenu((now) => (isOpen ? key : now === key ? undefined : now));
      if (!isOpen) {
        setKeyed((now) => (now === key ? undefined : now));
      }
    },
    onRenamed: (key) => {
      select(key);
      setRenamed(key);
    },
  };

  const keys: Array<RowKey> = [];
  if (onAddBeside !== undefined) {
    keys.push({
      hint: "o",
      keys: "o",
      label: "add beside",
      run: (at) => {
        const row = rows[at];
        const section = sections.find((one) => one.rows.includes(row));
        if (row === undefined || section === undefined) {
          return false;
        }
        onAddBeside(section.id, row);
      },
    });
  }
  if (rows.some((row) => row.editor !== undefined)) {
    keys.push({
      hint: "i",
      keys: "i",
      label: "edit",
      run: (at) => {
        // Another card's editor holding unsaved text stays open: its text would be dropped unseen.
        const isOther = editing !== undefined && editing !== rows[at]?.key;
        if (rows[at]?.editor === undefined || (isOther && isDirty)) {
          return false;
        }
        select(rows[at].key);
        setEditing(rows[at].key);
      },
    });
  }
  if (onPromote !== undefined) {
    keys.push({
      hint: "p",
      keys: "p",
      label: "promote to draft",
      run: (at) => {
        const row = rows[at];
        if (row === undefined || row.isFixed === true) {
          return false;
        }
        select(row.key);
        return onPromote(row);
      },
    });
  }
  if (onDelete !== undefined) {
    keys.push({
      hint: "d",
      keys: "d",
      label: "delete",
      run: (at) => {
        const row = rows[at];
        if (row === undefined || row.isFixed === true) {
          return false;
        }
        select(row.key);
        // The question takes `d` again for yes: `d d` deletes, as `y` does.
        void confirm(deleteLine(row.text)).then((isConfirmed) => {
          if (isConfirmed) {
            onDelete(row);
          }
        });
      },
    });
  }
  // With item moves, `m` leads to their keys (`useListKeys`); else it opens the card's menu.
  if (!canMoveItems && rows.some((row) => row.menu !== undefined)) {
    keys.push({
      hint: "m",
      keys: "m",
      label: "move",
      run: (at) => {
        if (rows[at]?.menu === undefined) {
          return false;
        }
        select(rows[at].key);
        setMenu(rows[at].key);
        setKeyed(rows[at].key);
      },
    });
  }
  return { held: editing ?? keyed, keys, onRefocused, renamed, state };
}
