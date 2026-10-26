// The keys a list gives its rows beyond moving: `o` adds beside the row, in its section, `i` turns
// it into its editor in place, `m` opens its `…` menu. Each is bound only where the list can do it,
// and acts on the row the focus is on, or the selected one (see `useListKeys`'s `rowKeys`). The state
// they set is what `Card` reads: which card is edited, and which card's menu is held open.
import { useState } from "react";
import type { RowState, WorkRow } from "./Card.tsx";
import type { RowKey } from "./useListKeys.ts";

/** A section as the keys see it: its id, and its rows as they show. */
type Rows = { id: string; rows: ReadonlyArray<WorkRow> };

/**
 * The row keys of a list whose `sections` are in the order they show, and the state they set.
 * `onAddBeside(section, row)` is given by a list that adds in a place: its `o`. `i` and `m` select
 * their row, so the focus has a card to return to, though a Tab put it there. `held` is the key of
 * the card whose editor or key-opened menu holds the focus, until it closes: the list takes the focus
 * back to the selected card then.
 */
export function useRowKeys(
  sections: ReadonlyArray<Rows>,
  onAddBeside: ((section: string, row: WorkRow) => void) | undefined,
  select: (key: string) => void,
) {
  const [editing, setEditing] = useState<string>();
  const [menu, setMenu] = useState<string>();
  const [keyed, setKeyed] = useState<string>();
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
    onEdited: () => setEditing(undefined),
    onMenu: (key, isOpen) => {
      setMenu((now) => (isOpen ? key : now === key ? undefined : now));
      if (!isOpen) {
        setKeyed((now) => (now === key ? undefined : now));
      }
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
        if (rows[at]?.editor === undefined) {
          return false;
        }
        select(rows[at].key);
        setEditing(rows[at].key);
      },
    });
  }
  if (rows.some((row) => row.menu !== undefined)) {
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
  return { held: editing ?? keyed, keys, state };
}
