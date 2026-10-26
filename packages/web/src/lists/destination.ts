// Where a key of a list in columns leads: the pure move, apart from the keys' events and the page.

/** A move of the list keys. */
export type Move = "next" | "previous" | "first" | "last" | "left" | "right";

/** The columns of a list: each the indexes of its rows, in the order the rows show, never empty. */
export type Columns = ReadonlyArray<ReadonlyArray<number>>;

/**
 * The row a move leads to from row `current` among `count` rows, -1 for none. In `columns`, up and
 * down stay in the row's column, and left and right go to the same place of the neighbouring one,
 * or its last row; from no row, to the first of the first column.
 */
export function destination(
  move: Move,
  current: number,
  count: number,
  columns: Columns | undefined,
) {
  const column = columns?.findIndex((rows) => rows.includes(current)) ?? -1;
  if (move === "left" || move === "right") {
    if (columns === undefined || columns.length === 0) {
      return -1;
    }
    if (column === -1) {
      return columns[0][0];
    }
    const place = columns[column].indexOf(current);
    const to =
      columns[Math.min(Math.max(column + (move === "left" ? -1 : 1), 0), columns.length - 1)];
    return to[Math.min(place, to.length - 1)];
  }
  const rows = columns === undefined || column === -1 ? undefined : columns[column];
  const at = rows === undefined ? current : rows.indexOf(current);
  const last = (rows?.length ?? count) - 1;
  const to = {
    first: 0,
    last,
    next: Math.min(at + 1, last),
    previous: Math.max(at - 1, 0),
  }[move];
  return rows === undefined ? to : rows[to];
}
