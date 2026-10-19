// A table of a document's blocks, drawn by Astryx's own columns: `Blocks` draws its other kinds.
import {
  proportional,
  resolveColumnWidths,
  Table,
  type TableColumn,
  TableBody,
  TableCell,
  TableHeaderCell,
  TableRow,
} from "@astryxdesign/core/Table";
import * as stylex from "@stylexjs/stylex";
import { useMemo } from "react";
import type { Block } from "uraeda-binding";
import type { BlockContext } from "./Blocks.tsx";
import { After, useSelect } from "./Selection.tsx";
import { plain, Spans } from "./Spans.tsx";

const styles = stylex.create({
  center: { textAlign: "center" },
  // A column's width and its floor, Astryx's own, on its first cell: the columns share the table.
  column: (width: string, minWidth: string) => ({ minWidth, width }),
  headerCell: {
    // A header cell wraps its text, as a body cell does, instead of cutting it.
    maxWidth: "none",
    overflow: "visible",
    overflowWrap: "break-word",
    textOverflow: "clip",
    whiteSpace: "normal",
  },
  right: { textAlign: "end" },
});

/** A table column's alignment, from its separator row. */
const ALIGN_STYLES: Record<string, stylex.StyleXStyles> = {
  center: styles.center,
  right: styles.right,
};

/**
 * A table row, tapped in place, its comments following it as a row of their own. The first row's
 * cells carry the columns' widths.
 */
function RowNode({
  context,
  row,
  widths,
}: {
  context: BlockContext;
  row: Block;
  widths?: ReadonlyArray<stylex.StyleXStyles>;
}) {
  const cells = context.children.get(row.id) ?? [];
  const select = useSelect(row, context.selection);
  const after = select && context.selection?.after?.(row);
  const Cell = row.header ? TableHeaderCell : TableCell;
  return (
    <>
      <TableRow {...select?.block} id={select?.textId} xstyle={select?.row ?? []}>
        {cells.map((cell, index) => (
          <Cell
            key={cell.id}
            xstyle={[
              widths?.[index],
              row.header && styles.headerCell,
              ALIGN_STYLES[cell.align ?? ""],
              index === 0 && select?.cell,
            ]}
          >
            {index === 0 && select?.toggle}
            <span {...select?.above}>
              <Spans spans={cell.spans} />
            </span>
          </Cell>
        ))}
      </TableRow>
      {after && (
        <TableRow>
          <TableCell colSpan={cells.length}>
            <After>{after}</After>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

/**
 * A table's columns: each takes a share of the width by the longest text of its cells, from 8 to 60
 * characters, so a column of short names does not take as much as one of sentences; at least 96 px,
 * past which the table scrolls.
 */
function tableColumns(weights: ReadonlyArray<number>): Array<TableColumn<Record<string, unknown>>> {
  return weights.map((weight, index) => ({
    key: `c${index}`,
    width: proportional(weight, { minWidth: 96 }),
  }));
}

/**
 * A table drawn by its rows, its columns' widths Astryx's own: the table is as wide as their floors
 * at least, scrolling sideways in its own region past its width, and its first row's cells carry
 * each column's width.
 */
export function TableNode({ block, context }: { block: Block; context: BlockContext }) {
  const rows = context.children.get(block.id) ?? [];
  const cellsOf = (row: Block) => context.children.get(row.id) ?? [];
  const count = Math.max(0, ...rows.map((row) => cellsOf(row).length));
  const weights = Array.from({ length: count }, (_, index) =>
    Math.min(60, Math.max(8, ...rows.map((row) => plain(cellsOf(row)[index]?.spans ?? []).length))),
  );
  const key = weights.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands for `weights`.
  const columns = useMemo(() => tableColumns(weights), [key]);
  const widths = useMemo(() => {
    const resolved = resolveColumnWidths(columns).columns;
    return columns.map((column) => {
      const style = resolved.get(column.key)?.style;
      return styles.column(String(style?.width ?? "auto"), String(style?.minWidth ?? 0));
    });
  }, [columns]);
  return (
    <Table columns={columns} dividers="rows" textOverflow="wrap" verticalAlign="top">
      <TableBody>
        {rows.map((row, index) => (
          <RowNode
            context={context}
            key={row.id}
            row={row}
            widths={index === 0 ? widths : undefined}
          />
        ))}
      </TableBody>
    </Table>
  );
}
