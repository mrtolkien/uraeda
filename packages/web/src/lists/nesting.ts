// The walks of an outline's rows, shared by every list that nests: rows in the order of the file,
// each at a depth, nested under the nearest row above it a level less deep. The outliner's items,
// a drag's keys, the work list's rows, and the keys' moves each walk theirs with these, reading a
// row's depth, or its line, their own way.

/** A row as a walk reads it: its depth, 0 for a line, which has none. */
type Deep = { depth?: number };

/** A row's depth: 0 for a line, which has none. */
export const depthOf = (row: Deep) => row.depth ?? 0;

/** The depth of each key among `rows`, by key: 0 for a line, and for a key of no row. */
export const depthByKey = (rows: ReadonlyMap<string, Deep>) => (key: string) =>
  rows.get(key)?.depth ?? 0;

/**
 * The index past the run of rows after the one at `at` for which `isIn` holds: the first after it
 * for which it does not, or the end.
 */
export function runEnd<Row>(rows: ReadonlyArray<Row>, at: number, isIn: (row: Row) => boolean) {
  const end = rows.findIndex((row, index) => index > at && !isIn(row));
  return end === -1 ? rows.length : end;
}

/**
 * The index past the rows nested under the one at `at`: the rows after it deeper than it. A place
 * past the rows is at depth 0.
 */
export function nestedEnd<Row>(
  rows: ReadonlyArray<Row>,
  at: number,
  depthAt: (row: Row) => number,
) {
  const row = rows[at];
  const depth = row === undefined ? 0 : depthAt(row);
  return runEnd(rows, at, (other) => depthAt(other) > depth);
}

/**
 * The index past the rows nested under the work list's row at `at`: the rows after it deeper than
 * it, in its line, the row they are drawn in.
 */
export function nestedRowsEnd(
  rows: ReadonlyArray<Deep & { key: string; parent?: string }>,
  at: number,
) {
  const row = rows[at];
  const line = row.parent ?? row.key;
  return runEnd(rows, at, (other) => other.parent === line && depthOf(other) > depthOf(row));
}

/**
 * The rows the one at `at` is nested under, nearest first. `top` is the least depth among `rows`:
 * a line's nested rows start at 1, under the line, which is not among them.
 */
export function ancestorsAt<Row extends Deep>(rows: ReadonlyArray<Row>, at: number, top = 0) {
  const found: Array<Row> = [];
  const row = rows[at];
  let depth = row === undefined ? 0 : depthOf(row);
  for (let index = at - 1; index >= 0 && depth > top; index -= 1) {
    const above = rows[index];
    if (depthOf(above) < depth) {
      found.push(above);
      depth = depthOf(above);
    }
  }
  return found;
}

/** The index of the row just above the one at `at` at `depth`, its sibling, or -1 for none. */
export function siblingAbove(rows: ReadonlyArray<Deep>, at: number, depth: number) {
  for (let index = at - 1; index >= 0; index -= 1) {
    if (depthOf(rows[index]) === depth) {
      return index;
    }
    if (depthOf(rows[index]) < depth) {
      return -1;
    }
  }
  return -1;
}

/** Rows, each followed by its nested rows: the order the keys go through them. */
export function withNested<Row extends { children?: ReadonlyArray<Row> }>(
  rows: ReadonlyArray<Row>,
) {
  return rows.flatMap((row) => [row, ...(row.children ?? [])]);
}
