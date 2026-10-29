// What a list of work shows, in order (see `WorkList`): its sections as a drag and the keys' moves
// left them, each line's nested rows after it, and the columns the keys move across.
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import type { WorkRow } from "./Card.tsx";
import { withMoves } from "./itemMoves.ts";
import { withNested } from "./nesting.ts";
import { type OnDrop, useDragOrder } from "./useDragOrder.ts";
import { type Ahead, stillAhead } from "./useItemMoves.ts";
import type { Columns } from "./useListKeys.ts";
import type { WorkLayout, WorkSection } from "./workSection.ts";

/** The title of the section that is drawn under the row of columns. */
const BELOW = "Blocked";

/**
 * The columns of the keys: each section's rows, nested ones included, as indexes into all the rows,
 * without the empty.
 */
export function columnsOf(sections: ReadonlyArray<ReadonlyArray<WorkRow>>): Columns {
  let start = 0;
  return sections
    .map((rows) => {
      const indexes = rows.map((_, at) => start + at);
      start += rows.length;
      return indexes;
    })
    .filter((indexes) => indexes.length > 0);
}

/**
 * What the list shows, in order: the `drag`'s sections with the rows as a drag left them (`rowsOf`),
 * the ones `inRow` and the ones `below` it, the rows of each in the order they show (`shown`), all
 * of them (`rows`), and each section's id and rows (`placed`), which the keys move along.
 */
export function useShown(
  sections: ReadonlyArray<WorkSection>,
  layout: WorkLayout,
  { canNest, onDrop }: { canNest: boolean; onDrop: OnDrop | undefined },
  ahead: ReadonlyArray<Ahead>,
  isLayoutChosen: boolean,
) {
  // The rows that add are no lines: a drag knows none of them, and they stay at the section's end.
  // A drag reorders every row, a line's nested rows after it, each a row of its own.
  const drag = useDragOrder(
    sections.map((section) => ({
      ...section,
      rows: withNested(section.rows.filter((row) => !row.isAdd)),
    })),
    onDrop,
    canNest,
  );
  // A row a drop placed at another depth, under another line, shows there until the file has it.
  const byKey = new Map(
    drag.sections.flatMap((section) =>
      section.rows.map((row) => {
        const placed = drag.placed.get(row.key);
        if (placed === undefined) {
          return [row.key, row] as const;
        }
        const { depth: _, parent: __, ...rest } = row;
        return [
          row.key,
          {
            ...rest,
            ...(placed.depth === 0 ? {} : { depth: placed.depth }),
            ...(placed.parent === undefined ? {} : { parent: placed.parent }),
          },
        ] as const;
      }),
    ),
  );
  const addsOf = (section: WorkSection) =>
    sections.find((one) => one.id === section.id)?.rows.filter((row) => row.isAdd) ?? [];
  const isNarrowScreen = isNarrow(useWidthClass());
  // The phone stacks the columns, unless the human chose them.
  const asColumns = layout === "columns" && (isLayoutChosen || !isNarrowScreen);
  const below = asColumns ? drag.sections.filter((section) => section.title === BELOW) : [];
  const inRow = drag.sections.filter((section) => !below.includes(section));
  const rowsIn = (order: Record<string, ReadonlyArray<string>>) => (section: WorkSection) => [
    ...(section.isFixed
      ? section.rows
      : (order[section.id] ?? []).flatMap((key) => byKey.get(key) ?? [])),
    ...addsOf(section),
  ];
  // The keys go through every row, a line's nested rows after it.
  const placedIn = (rowsOf: (section: WorkSection) => ReadonlyArray<WorkRow>) =>
    [...inRow, ...below].map((section) => ({
      id: section.id,
      isFixed: section.isFixed,
      rows: rowsOf(section),
    }));
  // The file's order, then the moves the keys made ahead of their writes.
  const live = placedIn(rowsIn(drag.order));
  const moves = stillAhead(ahead, live);
  const rowsOf = rowsIn(moves.length > 0 ? withMoves(drag.order, live, moves) : drag.order);
  const shown = [...inRow, ...below].map(rowsOf);
  const placed = placedIn(rowsOf);
  return {
    asColumns,
    below,
    drag,
    inRow,
    live,
    placed,
    rows: shown.flat(),
    rowsOf,
    shown,
  };
}

/** What a list shows, in order (see `useShown`). */
export type ShownList = ReturnType<typeof useShown>;
