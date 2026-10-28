// The keys a list gives its rows beyond moving: `o` adds beside the row, in its section, `i` turns
// it into its editor in place, `m` opens its `…` menu. Each is bound only where the list can do it,
// and acts on the row the focus is on, or the selected one (see `useListKeys`'s `rowKeys`). The state
// they set is what `Card` reads: which card is edited, and which card's menu is held open.
import { useCallback, useState } from "react";
import { deleteLine, useConfirm } from "../fields/Confirm.tsx";
import type { RowState, WorkRow } from "./Card.tsx";
import type { BarAction } from "./RowBar.tsx";
import type { RowKey } from "./useListKeys.ts";

/** A section as the keys see it: its id, and its rows as they show. */
type Rows = { id: string; rows: ReadonlyArray<WorkRow> };

/**
 * A row key that the row's bar shows (see `RowBar`), with its key as written there and its icon on
 * the phone, for the rows `isFor` accepts: the status line names none of them.
 */
type BarKey = RowKey & {
  bar?: Pick<BarAction, "icon" | "keys"> & { isFor?: (row: WorkRow) => boolean };
};

/** The order of the bar's actions, by their keys. */
const BAR_ORDER = ["m", "c", "Tab", "shift+Tab", "p", "s", "v", "d"];

/**
 * A key of a list's own that acts on a row, shown in its bar: its key, its label, its icon on the
 * phone, the rows it is for, and what it does.
 */
export type RowAction = Pick<BarAction, "icon" | "keys" | "label"> & {
  isFor?: (row: WorkRow) => boolean;
  run: (row: WorkRow) => void;
};

/**
 * A key that opens a picker of the sections to move a line to, as the inbox's `c` of its categories:
 * its key, its label in the bar, and its icon on the phone.
 */
export type SectionPicker = Pick<BarAction, "icon" | "keys" | "label"> & {
  open: (row: WorkRow) => void;
};

/** A line of its own, not nested: what `p` and `s` act on, so only its bar shows them. */
const isLine = (row: WorkRow) => row.parent === undefined;

/** What the row keys call, each given only where the list can do it (see `useRowKeys`). */
type RowHandlers = {
  /** What `d` calls once the human confirmed: it deletes the line. */
  onDelete?: ((row: WorkRow) => void) | undefined;
  /** What `m` calls where the list moves its rows: it puts the row in the move mode. */
  onMoveMode?: ((row: WorkRow) => void) | undefined;
  /** What Enter does on a row, which its bar's `⏎ open` does too. */
  onOpen?: ((row: WorkRow) => void) | undefined;
  /** What Tab and Shift+Tab call: they indent and outdent the row in its outline. */
  onOutline?: ((row: WorkRow, edit: "indent" | "outdent") => void) | undefined;
  /** A key that moves a line to the section a picker chose. */
  onPickSection?: SectionPicker | undefined;
  /** What `p` calls: it makes the line a draft; `false` says the row has nothing to promote. */
  onPromote?: ((row: WorkRow) => boolean | void) | undefined;
  /** What `s` calls: it starts from the line. */
  onStart?: ((row: WorkRow) => void) | undefined;
  /** The list's own keys on a row, in its bar. */
  rowActions?: ReadonlyArray<RowAction>;
};

/** `o` and `O`: a new row below or above the row, in its section, by `onAddBeside`. */
function addKeys(
  sections: ReadonlyArray<Rows>,
  rows: ReadonlyArray<WorkRow>,
  onAddBeside: (section: string, row: WorkRow, isAbove?: boolean) => void,
): Array<BarKey> {
  const adding = (isAbove: boolean) => (at: number) => {
    const row = rows[at];
    const section = sections.find((one) => one.rows.includes(row));
    if (row === undefined || section === undefined) {
      return false;
    }
    onAddBeside(section.id, row, isAbove);
    return undefined;
  };
  return [
    // Not the row's own: it adds another, so the status line names it, not the row's bar.
    { hint: "o", keys: "o", label: "add below", run: adding(false) },
    { keys: "O", label: "add above", run: adding(true) },
  ];
}

/** Tab and Shift+Tab: the row indented or outdented in its outline, by `onOutline`. */
function outlineKeys(
  rows: ReadonlyArray<WorkRow>,
  onOutline: (row: WorkRow, edit: "indent" | "outdent") => void,
): Array<BarKey> {
  const outlining = (edit: "indent" | "outdent") => (at: number) => {
    const row = rows[at];
    if (row === undefined || row.isFixed === true || row.isAdd === true) {
      return false;
    }
    onOutline(row, edit);
    return undefined;
  };
  return [
    {
      bar: { icon: "uraeda:indent", isFor: (row) => row.staysLine !== true, keys: "⇥" },
      keys: "Tab",
      label: "indent",
      run: outlining("indent"),
    },
    {
      bar: { icon: "uraeda:outdent", isFor: (row) => !isLine(row), keys: "⇧⇥" },
      keys: "shift+Tab",
      label: "outdent",
      run: outlining("outdent"),
    },
  ];
}

/** `s`: the line selected, and started from, by `onStart`. */
function startKey(
  rows: ReadonlyArray<WorkRow>,
  select: (key: string) => void,
  onStart: (row: WorkRow) => void,
): BarKey {
  return {
    bar: { icon: "uraeda:arrow-right", isFor: isLine, keys: "s" },
    keys: "s",
    label: "start",
    run: (at) => {
      const row = rows[at];
      if (row === undefined || row.isAdd === true) {
        return false;
      }
      select(row.key);
      onStart(row);
      return undefined;
    },
  };
}

/** `p`: the line selected, and made a draft, by `onPromote`. */
function promoteKey(
  rows: ReadonlyArray<WorkRow>,
  select: (key: string) => void,
  onPromote: (row: WorkRow) => boolean | void,
): BarKey {
  return {
    bar: { icon: "uraeda:file-pen-line", isFor: isLine, keys: "p" },
    keys: "p",
    label: "draft",
    run: (at) => {
      const row = rows[at];
      if (row === undefined || row.isFixed === true) {
        return false;
      }
      select(row.key);
      return onPromote(row);
    },
  };
}

/** `d`: the line selected, and deleted by `onDelete` once the human confirmed it. */
function deleteKey(
  rows: ReadonlyArray<WorkRow>,
  select: (key: string) => void,
  onDelete: (row: WorkRow) => void,
  confirm: ReturnType<typeof useConfirm>,
): BarKey {
  return {
    bar: { icon: "uraeda:trash", keys: "d" },
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
  };
}

/** The list's own keys on a row, `rowActions`, each on the rows it is for, which it selects. */
function actionKeys(
  rows: ReadonlyArray<WorkRow>,
  select: (key: string) => void,
  rowActions: ReadonlyArray<RowAction>,
): Array<BarKey> {
  return rowActions.map(({ icon, isFor, keys: key, label, run }) => ({
    bar: { ...(icon === undefined ? {} : { icon }), ...(isFor ? { isFor } : {}), keys: key },
    keys: key,
    label,
    run: (at) => {
      const row = rows[at];
      if (row === undefined || row.isFixed === true || !(isFor?.(row) ?? true)) {
        return false;
      }
      select(row.key);
      run(row);
    },
  }));
}

/** The picker's key: the line selected, and the sections to move it to picked from. */
function pickerKey(
  rows: ReadonlyArray<WorkRow>,
  select: (key: string) => void,
  { icon, keys: key, label, open }: SectionPicker,
): BarKey {
  return {
    bar: { ...(icon === undefined ? {} : { icon }), isFor: isLine, keys: key },
    keys: key,
    label,
    run: (at) => {
      const row = rows[at];
      if (row === undefined || row.isFixed === true || !isLine(row)) {
        return false;
      }
      select(row.key);
      open(row);
    },
  };
}

/** `m` where the list moves its rows: the row in the move mode, by `onMoveMode`. */
function moveModeKey(rows: ReadonlyArray<WorkRow>, onMoveMode: (row: WorkRow) => void): BarKey {
  return {
    // No icon: the phone moves a row by dragging it, and the moves' keys are for a keyboard.
    bar: { keys: "m" },
    keys: "m",
    label: "move",
    run: (at) => {
      const row = rows[at];
      if (row === undefined || row.isFixed === true || row.isAdd === true) {
        return false;
      }
      onMoveMode(row);
    },
  };
}

/**
 * What the bar under `row` shows: the keys that act on it, in the bar's order. Enter first, which
 * edits a row edited in place and opens any other; `m` puts it in the move mode, whose bar the
 * list draws. A row that stays where it is only opens, and one that adds a line has no bar.
 */
function barOf(
  row: WorkRow,
  rows: ReadonlyArray<WorkRow>,
  keys: ReadonlyArray<BarKey>,
  onOpen: ((row: WorkRow) => void) | undefined,
): ReadonlyArray<BarAction> {
  const at = rows.findIndex((one) => one.key === row.key);
  if (at === -1 || row.isAdd === true) {
    return [];
  }
  const open: ReadonlyArray<BarAction> =
    onOpen === undefined
      ? []
      : [
          row.editsInPlace
            ? { icon: "uraeda:pencil", keys: "⏎", label: "edit", run: () => onOpen(row) }
            : { icon: "uraeda:enter", keys: "⏎", label: "open", run: () => onOpen(row) },
        ];
  if (row.isFixed === true) {
    return open;
  }
  const own = keys
    .filter((key) => key.bar !== undefined && (key.bar.isFor?.(row) ?? true))
    .map((key) => ({
      ...(key.bar?.icon === undefined ? {} : { icon: key.bar.icon }),
      keys: key.bar?.keys ?? key.keys,
      label: key.label,
      order: key.keys,
      run: () => void key.run(at),
    }));
  return [
    ...open,
    ...own
      .sort((a, b) => BAR_ORDER.indexOf(a.order) - BAR_ORDER.indexOf(b.order))
      .map(({ order: _, ...action }) => action),
  ];
}

/**
 * The state the row keys set, as `Card` reads it: which card is edited, and whether its editor
 * holds unsaved text; which card's menu is open, and which one a key opened; and the key of a line
 * just saved in its card, until the list took the focus to it (`onRefocused`).
 */
function useRowState(rows: ReadonlyArray<WorkRow>, select: (key: string) => void) {
  const [editing, setEditing] = useState<string>();
  const [menu, setMenu] = useState<string>();
  const [keyed, setKeyed] = useState<string>();
  const [renamed, setRenamed] = useState<string>();
  const onRefocused = useCallback(() => setRenamed(undefined), []);
  // Whether the editor open holds unsaved text.
  const [isDirty, setDirty] = useState(false);
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
  return { editing, isDirty, keyed, onRefocused, renamed, setEditing, setKeyed, setMenu, state };
}

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
  onAddBeside: ((section: string, row: WorkRow, isAbove?: boolean) => void) | undefined,
  select: (key: string) => void,
  {
    onDelete,
    onMoveMode,
    onOpen,
    onOutline,
    onPickSection,
    onPromote,
    onStart,
    rowActions = [],
  }: RowHandlers = {},
) {
  const confirm = useConfirm();
  const rows = sections.flatMap((section) => section.rows);
  const { editing, isDirty, keyed, onRefocused, renamed, setEditing, setKeyed, setMenu, state } =
    useRowState(rows, select);

  const keys: Array<BarKey> = [
    ...(onAddBeside === undefined ? [] : addKeys(sections, rows, onAddBeside)),
    ...(onOutline === undefined ? [] : outlineKeys(rows, onOutline)),
    ...(onStart === undefined ? [] : [startKey(rows, select, onStart)]),
  ];
  if (rows.some((row) => row.editor !== undefined)) {
    keys.push({
      // Not in the bar: Enter edits a row edited in place, and the bar names Enter.
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
  keys.push(
    ...(onPromote === undefined ? [] : [promoteKey(rows, select, onPromote)]),
    ...(onDelete === undefined ? [] : [deleteKey(rows, select, onDelete, confirm)]),
    ...actionKeys(rows, select, rowActions),
    ...(onPickSection === undefined ? [] : [pickerKey(rows, select, onPickSection)]),
  );
  // With item moves, `m` puts the row in the move mode, whose keys move it (`useListKeys`); else it
  // opens the card's menu.
  if (onMoveMode !== undefined) {
    keys.push(moveModeKey(rows, onMoveMode));
  } else if (rows.some((row) => row.menu !== undefined)) {
    keys.push({
      bar: { isFor: (row) => row.menu !== undefined, keys: "m" },
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
  /**
   * Opens the editor of the row `key`, as `i` does: not while another's holds unsaved text. Returns
   * whether it opened.
   */
  const edit = (key: string) => {
    const row = rows.find((one) => one.key === key);
    if (row?.editor === undefined || (editing !== undefined && editing !== key && isDirty)) {
      return false;
    }
    select(key);
    setEditing(key);
    return true;
  };

  return {
    barOf: (row: WorkRow) => barOf(row, rows, keys, onOpen),
    edit,
    held: editing ?? keyed,
    keys,
    onRefocused,
    renamed,
    state,
  };
}
