// TEMPORARY: the blocks of the round page's mockups for the clarifications redesign
// (`specs/2026-10-17-redesign-clarifications/spec.md`): a `mermaid` code block drawn as a diagram,
// a table that scrolls sideways past a width per column, and "Why it matters" set apart. The
// implementation moves them into `Blocks`, `Diagram`, and `QuestionCard`.
import { proportional, Table } from "@astryxdesign/core/Table";
import { colorVars, radiusVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { useEffect, useId, useRef } from "react";
import type { Block, Document } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { plain } from "../Spans.tsx";

const styles = stylex.create({
  diagram: {
    // A diagram scrolls inside its frame rather than the page sideways.
    overflowX: "auto",
  },
  whyBox: {
    // "Why it matters", set apart from the context it follows.
    backgroundColor: colorVars["--color-background-muted"],
    borderRadius: radiusVars["--radius-element"],
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-3"],
  },
});

/** A Mermaid diagram, drawn on demand in a sandboxed frame. */
function Diagram({ source }: { source: string }) {
  const frame = useRef<HTMLDivElement>(null);
  const id = `diagram-${useId().replaceAll(":", "")}`;
  useEffect(() => {
    let live = true;
    void import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({ securityLevel: "sandbox", startOnLoad: false, theme: "neutral" });
      const { svg } = await mermaid.render(id, source);
      if (live && frame.current) {
        frame.current.innerHTML = svg;
      }
    });
    return () => {
      live = false;
    };
  }, [id, source]);
  return <div aria-label="Diagram" ref={frame} role="img" {...stylex.props(styles.diagram)} />;
}

/** A block that starts with the words "Why it matters". */
function isWhy(block: Block | undefined): boolean {
  return block?.kind === "paragraph" && plain(block.spans).startsWith("Why it matters");
}

/**
 * A table drawn by Astryx's own columns, each at least 144 px wide, scrolling sideways in its own
 * region past that: the header row's cells name the columns, and cells show as plain text.
 */
function ScrollTable({ document, table }: { document: Document; table: number }) {
  const cellsOf = (row: number) =>
    document.blocks.filter((b) => b.parent === row).map((cell) => plain(cell.spans));
  const [header, ...rows] = document.blocks.filter((b) => b.parent === table).map((row) => row.id);
  const names = header === undefined ? [] : cellsOf(header);
  const columns = names.map((name, index) => ({
    header: name,
    key: `c${index}`,
    width: proportional(1, { minWidth: 144 }),
  }));
  const data = rows.map((row, index) => ({
    id: String(index),
    ...Object.fromEntries(cellsOf(row).map((text, column) => [`c${column}`, text])),
  }));
  return <Table columns={columns} data={data} dividers="rows" textOverflow="wrap" />;
}

/**
 * Blocks of the document, with a `mermaid` code block drawn as a diagram, a table scrolling past
 * its width, and "Why it matters" set apart.
 */
export function RichBlocks({ document, ids }: { document: Document; ids: ReadonlyArray<number> }) {
  return (
    <VStack gap={3}>
      {ids.map((id) => {
        const block = document.blocks[id];
        if (block?.kind === "code" && block.language === "mermaid") {
          return <Diagram key={id} source={block.text ?? ""} />;
        }
        if (block?.kind === "table") {
          return <ScrollTable document={document} key={id} table={id} />;
        }
        if (isWhy(block)) {
          return (
            <div key={id} {...stylex.props(styles.whyBox)}>
              <Blocks document={document} ids={[id]} />
            </div>
          );
        }
        return <Blocks document={document} ids={[id]} key={id} />;
      })}
    </VStack>
  );
}
