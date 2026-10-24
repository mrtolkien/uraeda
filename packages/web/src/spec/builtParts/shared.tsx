// What the parts after the stories share: their rows' and pills' styles, and how a part draws its
// blocks in their order, those it does not draw its own way as the spec's blocks.
import { colorVars, sizeVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { Block } from "uraeda-binding";
import { Blocks } from "../../Blocks.tsx";
import { Selectable } from "../../Selection.tsx";
import type { PartProps, SpecItems } from "../parts.ts";

export const builtStyles = stylex.create({
  fold: {
    // The niche cases' toggle, at the reading size, its row a control's height for a finger.
    alignItems: "center",
    display: "flex",
    fontSize: "var(--text-reading-size)",
    minHeight: sizeVars["--size-element-md"],
  },
  list: {
    listStyleType: "none",
    margin: 0,
    padding: 0,
  },
  pill: {
    "--pill-slot": "calc(var(--text-reading-size) * var(--text-reading-line))",
    // A pill keeps its width beside text of several lines, and is centred on the first one: its
    // slot is a line of the reading text high.
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    fontSize: "var(--text-reading-size)",
    height: "var(--pill-slot)",
    lineHeight: "var(--text-reading-line)",
  },
  reading: {
    // The part's text at the reading size, as the spec's other blocks.
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
  },
  row: {
    // A row of the part, set apart from the one before by a hairline.
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: spacingVars["--spacing-0-5"],
    paddingBlockStart: spacingVars["--spacing-3"],
  },
});

/** A part's section, as the core cuts it. */
export type Part = SpecItems["parts"][number];

/** What a part's drawing takes: the spec's items, its section, and the page's context. */
export type DrawingProps = { items: SpecItems; part: Part; props: PartProps };

/**
 * A part's blocks in their order: those `own` draws, its own way or as nothing for `null`, the
 * others as the spec's blocks, each run of them in one `Blocks`.
 */
export function inOrder(
  part: Part,
  props: PartProps,
  own: (block: Block) => ReactNode | undefined,
): Array<ReactNode> {
  const nodes: Array<ReactNode> = [];
  let run: Array<number> = [];
  const flush = () => {
    if (run.length > 0) {
      nodes.push(
        <Blocks
          document={props.document}
          ids={run}
          key={`blocks-${run[0]}`}
          selection={props.selection}
        />,
      );
      run = [];
    }
  };
  for (const id of part.blocks) {
    const block = props.document.blocks[id];
    const drawn = block && own(block);
    if (drawn === undefined) {
      run.push(id);
    } else {
      flush();
      nodes.push(drawn);
    }
  }
  flush();
  return nodes;
}

/** The blocks among `ids` whose parent is `parent`, in their order. */
export function childrenIn(props: PartProps, ids: ReadonlyArray<number>, parent: number) {
  return ids.flatMap((id) => {
    const block = props.document.blocks[id];
    return block && block.parent === parent ? [block] : [];
  });
}

/** The parents of the blocks `ids`. */
export function parentsOf(props: PartProps, ids: ReadonlyArray<number>) {
  return new Set(ids.map((id) => props.document.blocks[id]?.parent));
}

/** The blocks nested in an item, like its sub-bullets, drawn as the spec's blocks. */
export function Nested({ item, props }: { item: Block; props: PartProps }) {
  const ids = props.document.blocks.filter((b) => b.parent === item.id).map((b) => b.id);
  return (
    ids.length > 0 && <Blocks document={props.document} ids={ids} selection={props.selection} />
  );
}

/**
 * An item of a part's list the core does not classify, like one without a unit's bold name or a
 * criterion's id: drawn as the spec's other items, its text then its blocks, tappable.
 */
export function Leftover({ item, props }: { item: Block; props: PartProps }) {
  return (
    <Selectable block={item} selection={props.selection}>
      <Blocks document={props.document} ids={[item.id]} selection={props.selection} />
    </Selectable>
  );
}
