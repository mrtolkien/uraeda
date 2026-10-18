// "Data": the feature's `data-model.md`, drawn after the stories. Each entity, a level-2 section of
// the file, is a part of its own, its table drawn by Astryx's columns, the "Change" column's cells
// as green "New", yellow "Changed", and red "Removed" pills. The text before the first entity shows
// in a part of its own. The page draws no part without the file.
import { Badge } from "@astryxdesign/core/Badge";
import { proportional, Table } from "@astryxdesign/core/Table";
import type { ReactNode } from "react";
import type { Block, Document } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { plain, Spans } from "../Spans.tsx";
import { Panel } from "./Panel.tsx";
import { GROUPS, type PartProps } from "./parts.ts";

/**
 * What the data part draws: the feature's folder, the width, and `data-model.md`'s tree, which the
 * page reads, and draws no part without.
 */
export type DataPartProps = Pick<PartProps, "folder" | "wide"> & { document: Document };

/** The pills of a change, by the cell's text. */
const CHANGES: Record<string, "error" | "success" | "warning"> = {
  Changed: "warning",
  New: "success",
  Removed: "error",
};

/** A row of a data table: its cells, by column. */
type DataRow = { cells: ReadonlyArray<Block>; id: string };

/** The children of a block, in order. */
function childrenOf(document: Document, id: number) {
  return document.blocks.filter((b) => b.parent === id);
}

/** A cell of a data table: in the "Change" column, a known change as its pill. */
function cellOf(cell: Block | undefined, isChange: boolean): ReactNode {
  const spans = cell?.spans ?? [];
  const variant = isChange ? CHANGES[plain(spans).trim()] : undefined;
  return variant ? (
    <Badge label={plain(spans).trim()} variant={variant} />
  ) : (
    <Spans spans={spans} />
  );
}

/** A table of the data model, its header row naming its columns. */
function DataTable({ document, table }: { document: Document; table: Block }) {
  const rows = childrenOf(document, table.id).map((row) => childrenOf(document, row.id));
  const header = childrenOf(document, table.id)[0]?.header ? (rows.shift() ?? []) : [];
  const count = Math.max(header.length, ...rows.map((cells) => cells.length));
  return (
    <Table<DataRow>
      columns={Array.from({ length: count }, (_, index) => {
        const name = plain(header[index]?.spans ?? []);
        return {
          header: <Spans spans={header[index]?.spans ?? []} />,
          key: `c${index}`,
          renderCell: (row: DataRow) => cellOf(row.cells[index], name.trim() === "Change"),
          // Equal columns, wide enough for their words: on the phone, the table scrolls in its own
          // region, as the documents' tables do.
          width: proportional(1),
        };
      })}
      data={rows.map((cells, index) => ({ cells, id: String(index) }))}
      dividers="rows"
      textOverflow="wrap"
      verticalAlign="top"
    />
  );
}

/** Blocks of the data model in their order, its tables drawn with their changes as pills. */
function DataBlocks({ document, ids }: { document: Document; ids: ReadonlyArray<number> }) {
  const nodes: Array<ReactNode> = [];
  let run: Array<number> = [];
  const flush = () => {
    if (run.length > 0) {
      nodes.push(<Blocks document={document} ids={run} key={`blocks-${run[0]}`} />);
      run = [];
    }
  };
  for (const id of ids) {
    const block = document.blocks[id];
    if (block?.kind === "table") {
      flush();
      nodes.push(<DataTable document={document} key={id} table={block} />);
    } else {
      run.push(id);
    }
  }
  flush();
  return nodes;
}

/** The data model's top-level blocks, cut at its level-2 headings: the text before them, then each. */
function sectionsOf(document: Document) {
  const intro: Array<number> = [];
  const sections: Array<{ heading: Block; ids: Array<number> }> = [];
  for (const block of document.blocks.filter((b) => b.parent == null)) {
    if (block.kind === "heading" && block.level === 2) {
      sections.push({ heading: block, ids: [] });
    } else if (sections.length > 0) {
      sections.at(-1)!.ids.push(block.id);
    } else if (!(block.kind === "heading" && block.level === 1)) {
      intro.push(block.id);
    }
  }
  return { intro, sections };
}

/** The data model: the text before its entities, then each entity, a part of its own. */
export function DataPart({ document }: DataPartProps) {
  const { intro, sections } = sectionsOf(document);
  return (
    <>
      {intro.length > 0 && (
        <Panel crumbs={[GROUPS.data.title]} id="data-model" title="Data model">
          <DataBlocks document={document} ids={intro} />
        </Panel>
      )}
      {sections.map(({ heading, ids }) => (
        <Panel
          crumbs={[GROUPS.data.title]}
          id={`data-${heading.anchor ?? heading.id}`}
          key={heading.id}
          title={<Spans spans={heading.spans} />}
        >
          <DataBlocks document={document} ids={ids} />
        </Panel>
      ))}
    </>
  );
}
