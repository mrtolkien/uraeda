// "Data": the feature's `data-model.md`, as the core cuts it (`Items.dataModel`), drawn after the
// stories and on the data model's own page. The text before the first entity, then each entity, a
// level-2 section of the file, in a pane of its own, its tables drawn by Astryx's columns, a row the
// core marks new, changed, or removed showing its change, in its "Change" column, as a green,
// yellow, or red badge.
import { Badge } from "@astryxdesign/core/Badge";
import { proportional, Table } from "@astryxdesign/core/Table";
import { VStack } from "@astryxdesign/core/VStack";
import type { ReactNode } from "react";
import type { Block, DataModelItems, DataTable as Marked, Document } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { Pane } from "../layout/Pane.tsx";
import { Spans } from "../Spans.tsx";

/** What the data panes draw: `data-model.md`'s tree, and its sections as the core reads them. */
export type DataPartProps = {
  document: Document;
  /** The panes' heading level: 3 under the spec's "Data", 2 on the data model's own page. */
  level?: 2 | 3;
  model: DataModelItems;
  /**
   * Before each section's anchor, its pane's id: "data-" on the spec page, where the spec's own
   * headings take the bare anchors; none on the data model's own page, where its links land.
   */
  prefix?: string;
};

/** The badge of each change, by the core's kind. */
const CHANGES = {
  changed: { label: "Changed", variant: "warning" },
  new: { label: "New", variant: "success" },
  removed: { label: "Removed", variant: "error" },
} as const;

/** A row of a data table: its cells, by column, and its change, if the core marks one. */
type DataRow = { cells: ReadonlyArray<Block>; change?: keyof typeof CHANGES; id: string };

/** The children of a block, in order. */
function childrenOf(document: Document, id: number) {
  return document.blocks.filter((b) => b.parent === id);
}

/** A cell of a data table: in the "Change" column, a marked row's change as a badge. */
function cellOf(cell: Block | undefined, change: DataRow["change"], isChange: boolean): ReactNode {
  const badge = isChange && change && CHANGES[change];
  return badge ? (
    <Badge label={badge.label} variant={badge.variant} />
  ) : (
    <Spans spans={cell?.spans ?? []} />
  );
}

/** A table of the data model, its header row naming its columns, its marked rows' changes. */
function DataTable({ document, table }: { document: Document; table: Marked }) {
  const rows = childrenOf(document, table.block);
  const header = rows[0]?.header ? childrenOf(document, rows.shift()!.id) : [];
  const changes = new Map(table.changes.map((change) => [change.row, change.kind]));
  const data: Array<DataRow> = rows.map((row) => ({
    cells: childrenOf(document, row.id),
    change: changes.get(row.id),
    id: String(row.id),
  }));
  const count = Math.max(header.length, ...data.map((row) => row.cells.length));
  return (
    <Table<DataRow>
      columns={Array.from({ length: count }, (_, index) => ({
        header: <Spans spans={header[index]?.spans ?? []} />,
        key: `c${index}`,
        renderCell: (row: DataRow) => cellOf(row.cells[index], row.change, index === table.column),
        // Equal columns, wide enough for their words: on the phone, the table scrolls in its own
        // region, as the documents' tables do.
        width: proportional(1),
      }))}
      data={data}
      dividers="rows"
      textOverflow="wrap"
      verticalAlign="top"
    />
  );
}

/** A section's blocks in their order, its tables drawn with their changes as badges. */
function SectionBlocks({
  document,
  section,
}: {
  document: Document;
  section: DataModelItems["sections"][number];
}) {
  const tables = new Map(section.tables.map((table) => [table.block, table]));
  const nodes: Array<ReactNode> = [];
  let run: Array<number> = [];
  const flush = () => {
    if (run.length > 0) {
      nodes.push(<Blocks document={document} ids={run} key={`blocks-${run[0]}`} />);
      run = [];
    }
  };
  for (const id of section.blocks) {
    const table = tables.get(id);
    if (table) {
      flush();
      nodes.push(<DataTable document={document} key={id} table={table} />);
    } else {
      run.push(id);
    }
  }
  flush();
  return <VStack gap={3}>{nodes}</VStack>;
}

/**
 * The data model: the text before its entities, then each entity in a pane titled by its heading,
 * `<prefix><anchor>` as id.
 */
export function DataPart({ document, level = 3, model, prefix = "data-" }: DataPartProps) {
  return (
    <>
      {model.intro.length > 0 && <Blocks document={document} ids={model.intro} />}
      {model.sections.map((section) => (
        <Pane
          icon="uraeda:database"
          id={`${prefix}${section.anchor}`}
          key={section.heading}
          level={level}
          title={section.title}
        >
          <SectionBlocks document={document} section={section} />
        </Pane>
      ))}
    </>
  );
}
