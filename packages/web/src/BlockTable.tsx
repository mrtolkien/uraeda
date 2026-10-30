// A table of a document's blocks, drawn by Astryx's own columns: `Blocks` draws its other kinds.
import {
  pixel,
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
import { cellRuns, keepsSpans, SinceRowSign, useSinceMark } from "./sinceMarks.tsx";
import { plain, Spans } from "./Spans.tsx";
import { Runs } from "./spec/RuleLine.tsx";

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
  // Changed since your review: its sign first, and each cell's words as runs, if they match.
  const mark = useSinceMark(row.id);
  const runs = mark?.change.kind === "changed" ? cellRuns(mark.change.runs) : undefined;
  const words = runs?.length === cells.length ? runs : undefined;
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
              {index === 0 && mark && <SinceRowSign mark={mark} />}
              {words && !keepsSpans(cell.spans) ? (
                <Runs runs={words[index]!} />
              ) : (
                <Spans spans={cell.spans} />
              )}
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

/** Each column's longest text, in characters, from 8 to 60: what its width is made from. */
function columnWeights(block: Block, context: BlockContext): Array<number> {
  const rows = context.children.get(block.id) ?? [];
  const cellsOf = (row: Block) => context.children.get(row.id) ?? [];
  const count = Math.max(0, ...rows.map((row) => cellsOf(row).length));
  return Array.from({ length: count }, (_, index) =>
    Math.min(60, Math.max(8, ...rows.map((row) => plain(cellsOf(row)[index]?.spans ?? []).length))),
  );
}

/** A column's width, in px, from its weight. */
const columnWidth = (weight: number) => weight * 8 + 32;

/** The width a table's columns take side by side, in px: below it, the table scrolls. */
export function tableWidth(block: Block, context: BlockContext): number {
  return columnWeights(block, context).reduce((sum, weight) => sum + columnWidth(weight), 0);
}

/**
 * A table's columns: each is as wide as the longest text of its cells, from 8 to 60 characters, so a
 * column of short names is narrow and one of sentences wraps past 60; the table scrolls only when
 * their sum passes its region.
 */
function tableColumns(weights: ReadonlyArray<number>): Array<TableColumn<Record<string, unknown>>> {
  return weights.map((weight, index) => ({
    key: `c${index}`,
    width: pixel(columnWidth(weight)),
  }));
}

/**
 * A table drawn by its rows, its columns' widths Astryx's own: the table is as wide as their floors
 * at least, scrolling sideways in its own region past its width, and its first row's cells carry
 * each column's width.
 */
export function TableNode({ block, context }: { block: Block; context: BlockContext }) {
  const rows = context.children.get(block.id) ?? [];
  const weights = columnWeights(block, context);
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
