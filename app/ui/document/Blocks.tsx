// A document tree's blocks, each drawn as its kind, in the order the core read them. The tree is
// the core's: the client walks it, and never reads Markdown. Prose keeps its measure; code,
// tables, and diagrams may take the width to the document's right edge.
import { type JSX, Text, View, type ViewRef } from "nsh";
import type { Block, Document as Tree, Span } from "../../store/protocol";
import { Divider } from "../controls";
import { RevealContext } from "../layout/here";
import { Bar } from "../lists/Row";
import { Callout, Quote } from "./Callout";
import { Code } from "./Code";
import { BlockShown, DocumentContext } from "./context";
import { Diagram } from "./Diagram";
import { Pictured, pictureAlone } from "./Picture";
import { List } from "./List";
import { BLOCK_GAP, HEADING_AIR, heading, measure, prose } from "./look";
import { Spans } from "./Spans";
import { Table } from "./Table";
import { tokens } from "../tokens";

/** A tree, and each block's children in order, read once. */
export type Read = {
  tree: Tree;
  children: (id: number | null) => ReadonlyArray<Block>;
};

export function read(tree: Tree): Read {
  const children = new Map<number | null, Array<Block>>();
  for (const block of tree.blocks) {
    const list = children.get(block.parent) ?? [];
    list.push(block);
    children.set(block.parent, list);
  }
  return { children: (id) => children.get(id) ?? [], tree };
}

/** A paragraph: its spans, or the picture a link alone to a prototype's image draws. */
function Paragraph(props: { spans: ReadonlyArray<Span> }) {
  const alone = pictureAlone(props.spans);
  if (alone !== undefined) return <Pictured alt={alone.alt} image={alone.image} />;
  return (
    <Text style={prose()}>
      <Spans spans={props.spans} />
    </Text>
  );
}

/** A block's own view, by its kind, without the screen's mark. */
function Kind(props: { block: Block; read: Read }): JSX.Element {
  const block = props.block;
  const inner = () => (
    <Blocks ids={props.read.children(block.id).map((child) => child.id)} read={props.read} />
  );
  switch (block.kind) {
    case "heading":
      return (
        <Text role="header" style={heading(block.level ?? 2)}>
          <Spans spans={block.spans} />
        </Text>
      );
    case "paragraph":
      return <Paragraph spans={block.spans} />;
    case "list":
      return <List block={block} read={props.read} />;
    case "callout":
      return <Callout block={block}>{inner()}</Callout>;
    case "quote":
      return <Quote>{inner()}</Quote>;
    case "table":
      return <Table block={block} read={props.read} />;
    case "code":
      return block.language === "mermaid" ? (
        <Diagram source={block.text ?? ""} />
      ) : (
        <Code code={block.text ?? ""} language={block.language ?? ""} />
      );
    case "html":
      // Raw HTML is shown as it is written, never drawn.
      return <Code code={block.text ?? ""} language="" />;
    case "rule":
      return <Divider />;
    default:
      // An item, a row, or a cell: drawn by its list or its table.
      return <View />;
  }
}

/** The kinds that read as prose, and keep its measure. */
const PROSE = new Set<Block["kind"]>(["heading", "paragraph", "list", "callout", "quote", "rule"]);

/**
 * A part that takes presses, under the pointer: a quiet line around it, which shows over a
 * callout's or a code block's own fill, as a fill would not.
 */
const partHover = () =>
  ({
    outlineColor: tokens.role.rule,
    outlineOffset: 4,
    outlineStyle: "solid",
    outlineWidth: 1,
  }) as const;

/** One block: the screen's own drawing of it, or its kind's, then the screen's mark under it. */
export function BlockView(props: { block: Block; first: boolean; read: Read }) {
  const hands = DocumentContext();
  const block = props.block;
  const own = hands.override?.(block);
  const mark = hands.mark?.(block);
  const top = block.parent === null;
  const air = block.kind === "heading" && !props.first ? (HEADING_AIR[block.level ?? 2] ?? 6) : 0;
  const reveal = RevealContext();
  let view: ViewRef | undefined;
  const shown = () => {
    if (view !== undefined) reveal?.(view);
  };
  return (
    <BlockShown.Provider value={shown}>
      <View
        ref={(made: ViewRef) => (view = made)}
        style={{
          marginTop: (props.first ? 0 : BLOCK_GAP) + air,
          maxWidth: PROSE.has(block.kind) ? measure() : undefined,
        }}
        hoverStyle={
          top && hands.onPress !== undefined ? partHover() : undefined
        }
        onPress={top && hands.onPress !== undefined ? () => hands.onPress?.(block) : undefined}
        testID={`block-${block.id}`}
      >
        <If when={top && hands.selected?.(block) === true}>
          <View style={{ bottom: 0, left: -10, position: "absolute", top: 0, width: 2 }}>
            <Bar />
          </View>
        </If>
        {own ?? <Kind block={block} read={props.read} />}
        {mark}
      </View>
    </BlockShown.Provider>
  );
}

/**
 * The blocks `ids` of a tree, in order: its top level's by default. `after` when they follow other
 * blocks, as a reply's: the first then takes its room above it too.
 */
export function Blocks(props: { after?: boolean; ids?: ReadonlyArray<number>; read: Read }) {
  const blocks = () =>
    props.ids === undefined
      ? props.read.children(null)
      : props.ids.map((id) => props.read.tree.blocks[id]).filter((block) => block !== undefined);
  return (
    <View>
      {blocks().map((block, index) => (
        <BlockView block={block} first={index === 0 && props.after !== true} read={props.read} />
      ))}
    </View>
  );
}
