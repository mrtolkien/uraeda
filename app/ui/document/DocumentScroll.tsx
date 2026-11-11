// A document that scrolls itself: a long workflow file, a plan of 2,700 lines, read for half an
// hour. Its top-level blocks are the rows of Native Shell's list, which makes only those near the
// screen, so a long file opens as fast as a short one. A screen keeps its place in the visit
// (`offset`, `onOffset`), hears which block is at the top (`onPlace`), and brings a block or a
// heading to the top through its `ref`: a link to a heading, an outline's entry.
//
// Its keys read as a page's: `j` `k` and the arrows scroll by a few lines, `mod+d` `mod+u` by
// half a screen, `g g` `G` and `Home` `End` to its ends. `k` at the top does nothing, so the
// frame's `k` reaches the pane's tabs.
import {
  computed,
  type JSX,
  List,
  type ListRef,
  signal,
  untracked,
  View,
  type ViewToken,
} from "nsh";
import type { Block, Document as Tree } from "../../store/protocol";
import { type KeySpec, registerKey } from "../keys/registry";
import { BlockView, read } from "./Blocks";
import { DocumentContext, type DocumentHands } from "./context";
import { shared } from "./Document";
import { BLOCK_GAP, measure } from "./look";
import { tokens } from "../tokens";

export type DocumentScrollRef = {
  /** Brings the top-level block holding block `id` to the top: `false` when it is not drawn. */
  toBlock: (id: number) => boolean;
  /** Brings the heading with this anchor to the top: `false` when the document has none. */
  toAnchor: (anchor: string) => boolean;
  /** Scrolls to a place, in points from its top. */
  scrollTo: (offset: number, animated?: boolean) => void;
};

export type DocumentScrollProps = DocumentHands & {
  /** The core's tree: the record `WorkflowFile`'s `current.document`. */
  document: Tree;
  /** The blocks of its top level to draw, by id, in order: all of them by default. */
  ids?: ReadonlyArray<number>;
  align?: "center" | "start";
  /** Above its blocks, at the prose's measure: the page's head. */
  header?: JSX.Element;
  /** After its blocks, at the prose's measure. */
  footer?: JSX.Element;
  /** Declares its reading keys in the scope around it: true unless the screen declares its own. */
  keys?: boolean;
  /** Where it opens, in points from its top: from the visit's entry. */
  offset?: number;
  /** Hears where it came to rest, to keep it in the visit's entry. */
  onOffset?: (offset: number) => void;
  /** Hears the block at the top of the view, by id, as the reader scrolls. */
  onPlace?: (id: number) => void;
  ref?: (scroll: DocumentScrollRef) => void;
  testID?: string;
};

/** A row of the list: a top-level block, by its id. */
type Item = { id: string };

/** How far `j` and `k` scroll: three lines of prose. */
const STEP = () => tokens.type.proseLine * 3;

/** The top-level block a block is in: itself at the top level. */
function topOf(tree: Tree, id: number): number {
  let block: Block | undefined = tree.blocks[id];
  while (block !== undefined && block.parent !== null) block = tree.blocks[block.parent];
  return block?.id ?? id;
}

export function DocumentScroll(props: DocumentScrollProps) {
  // A record read again brings the same document as a new object, a review's comment saved
  // included: the same hash keeps the tree, so no cell is made again and the scroll stays put.
  const document = computed(() => props.document, {
    equals: (before, after) => before.hash === after.hash,
  });
  const tree = computed(() => read(document()));
  const items = computed<ReadonlyArray<Item>>(() =>
    (
      props.ids ??
      tree()
        .children(null)
        .map((block) => block.id)
    ).map((id) => ({
      id: String(id),
    })),
  );
  const width = signal(0);
  const hands = shared(props, width);
  let list: ListRef | undefined;
  // Where it is, as the list last said: what the keys scroll from.
  const at = { height: 0, offset: props.offset ?? 0, total: 0 };

  // Its end, once the list said its size: before its first scroll, the list keeps it in bounds.
  const end = () => (at.total > 0 ? Math.max(0, at.total - at.height) : Number.POSITIVE_INFINITY);
  const scrollTo = (offset: number) => {
    list?.scrollToOffset({ animated: true, offset: Math.min(end(), Math.max(0, offset)) });
  };
  const toBlock = (id: number) => {
    const top = topOf(untracked(tree).tree, id);
    const index = untracked(items).findIndex((item) => item.id === String(top));
    if (index === -1 || list === undefined) return false;
    list.scrollToIndex({ animated: true, index, viewPosition: 0 });
    return true;
  };
  const toAnchor = (anchor: string) => {
    const heading = untracked(tree).tree.blocks.find(
      (block) => block.kind === "heading" && block.anchor === anchor,
    );
    return heading !== undefined && toBlock(heading.id);
  };

  if (props.keys !== false) {
    // A move past an end does nothing, and says so: the frame's `k` then reaches the tabs.
    const by = (amount: () => number) => () => {
      const step = amount();
      if ((step < 0 && at.offset <= 0) || (step > 0 && at.offset >= end())) return false;
      // Moved from where the last move went, so keys pressed quickly add up.
      at.offset = Math.min(end(), Math.max(0, at.offset + step));
      scrollTo(at.offset);
      return undefined;
    };
    const keys: Array<KeySpec> = [
      {
        hint: "j k",
        hintLabel: "scroll",
        keys: "j",
        label: "scroll down",
        repeat: true,
        run: by(STEP),
      },
      { keys: "k", label: "scroll up", repeat: true, run: by(() => -STEP()) },
      { keys: "ArrowDown", label: "scroll down", repeat: true, run: by(STEP) },
      { keys: "ArrowUp", label: "scroll up", repeat: true, run: by(() => -STEP()) },
      {
        keys: "mod+d",
        label: "half a screen down",
        repeat: true,
        run: by(() => (at.height || 600) / 2),
      },
      {
        keys: "mod+u",
        label: "half a screen up",
        repeat: true,
        run: by(() => -(at.height || 600) / 2),
      },
      { keys: "g g", label: "top", run: () => scrollTo((at.offset = 0)) },
      { keys: "Home", label: "top", run: () => scrollTo((at.offset = 0)) },
      { keys: "G", label: "end", run: () => list?.scrollToEnd({ animated: true }) },
      { keys: "End", label: "end", run: () => list?.scrollToEnd({ animated: true }) },
    ];
    registerKey(keys);
  }

  // The header and the footer keep the prose's measure, where the prose starts.
  const column = (children: JSX.Element | undefined, room: "top" | "bottom") => (
    <View
      style={{
        maxWidth: hands.inset() + measure(),
        paddingBottom: room === "top" ? BLOCK_GAP * 2 : 48,
        paddingLeft: hands.inset(),
        paddingTop: room === "bottom" ? BLOCK_GAP * 2 : 0,
      }}
    >
      {children}
    </View>
  );

  return (
    <DocumentContext.Provider value={hands}>
      <List
        contentOffset={props.offset === undefined ? undefined : { x: 0, y: props.offset }}
        each={items()}
        estimatedItemSize={tokens.type.proseLine * 3}
        footer={column(props.footer, "bottom")}
        header={column(props.header, "top")}
        onLayout={(event) => {
          width.set(event.bounds.size.width);
          at.height = event.bounds.size.height;
        }}
        onScroll={(event) => {
          at.offset = event.offset.y;
          at.height = event.size.height;
          at.total = event.contentSize.height;
        }}
        onScrollEnd={(event) => props.onOffset?.(event.offset.y)}
        onViewableItemsChange={({ viewableItems }: { viewableItems: ViewToken<Item>[] }) => {
          const first = viewableItems.reduce<ViewToken<Item> | undefined>(
            (top, token) => (top === undefined || token.index < top.index ? token : top),
            undefined,
          );
          if (first !== undefined) props.onPlace?.(Number(first.item.id));
        }}
        ref={(node: ListRef) => {
          list = node;
          props.ref?.({
            scrollTo: (offset, animated = false) => node.scrollToOffset({ animated, offset }),
            toAnchor,
            toBlock,
          });
        }}
        style={{ flex: 1 }}
        testID={props.testID}
        viewabilityConfig={{ itemVisibleThreshold: 0.5 }}
      >
        {(item, index) => (
          <View style={{ paddingLeft: hands.inset() }}>
            {/* A cell is reused for another block: keyed by the block, it is made again. */}
            <Each of={[tree().tree.blocks[Number(item().id)]].filter((b) => b !== undefined)}>
              {(block: () => Block) => (
                <BlockView block={block()} first={index() === 0} read={tree()} />
              )}
            </Each>
          </View>
        )}
      </List>
    </DocumentContext.Provider>
  );
}
