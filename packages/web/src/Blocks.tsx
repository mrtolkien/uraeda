import { Blockquote } from "@astryxdesign/core/Blockquote";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Divider } from "@astryxdesign/core/Divider";
import { Heading } from "@astryxdesign/core/Heading";
import { List, ListItem } from "@astryxdesign/core/List";
import { colorVars, fontWeightVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useLayoutEffect, useMemo, useRef } from "react";
import type { Block, Document } from "uraeda-binding";
import { proseStyles } from "./Prose.tsx";
import { Diagram, type Place } from "./Diagram.tsx";
import { type Fold, FoldNode, type Folds, useHashFold } from "./Folds.tsx";
import { useStaticImages } from "./ImageView.tsx";
import { Paragraph } from "./layout/Paragraph.tsx";
import { useScrollMargin } from "./layout/scrollMargin.ts";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { After, Selectable, type Selection } from "./Selection.tsx";
import { SinceBlock, SinceScoped, SinceWords } from "./sinceMarks.tsx";
import { TableNode } from "./BlockTable.tsx";
import { opensImage, Spans } from "./Spans.tsx";
import { EmbedNode } from "./EmbedNode.tsx";
import { useMockupAt, useStoryAt } from "./stories.tsx";

const SIGNS: Record<string, string> = {
  ask: "?",
  con: "−",
  important: "!",
  note: "&",
  pro: "+",
  question: "?",
  warning: "⚠",
};

const CALLOUT_TITLES: Record<string, string> = {
  caution: "Caution",
  important: "Important",
  note: "Note",
  question: "Question",
  tip: "Tip",
  warning: "Warning",
};

const styles = stylex.create({
  // A table as wide as its columns: past the reading measure into the page's margin, scrolling only
  // past that.
  // Its maximum width is set by `TableBlock`, which measures what remains of the screen.
  block: {
    marginBlockEnd: spacingVars["--spacing-3"],
  },
  callout: {
    // A callout: a bar down its side, coloured by its kind, its title above its text.
    borderInlineStartColor: colorVars["--color-accent"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: spacingVars["--spacing-1"],
    marginBlockEnd: spacingVars["--spacing-4"],
    paddingInlineStart: spacingVars["--spacing-3"],
  },
  calloutImportant: { borderInlineStartColor: colorVars["--color-border-purple"] },
  calloutTip: { borderInlineStartColor: colorVars["--color-success"] },
  calloutTitle: {
    display: "block",
    fontWeight: fontWeightVars["--font-weight-bold"],
  },
  calloutWarning: { borderInlineStartColor: colorVars["--color-warning"] },
  con: { color: colorVars["--color-error"] },
  dash: { color: colorVars["--color-text-secondary"] },
  doc: {
    // The page's inset, which a list's rows take back, so their text lines up with the paragraphs'.
    "--container-padding-inline-start": spacingVars["--spacing-4"],
  },
  // On narrow screens, a list hangs its markers in the page's margin, as far as their room
  // (`--list-marker`) and the page's inset allow: the text of a list of dashes on the paragraphs'
  // edge, wider markers' text in by what the inset lacks; a nested list's text one character in from
  // its parent's.
  hanging: {
    marginInlineStart: `calc(-1 * min(var(--list-marker), var(--page-inset, ${spacingVars["--spacing-3"]})))`,
  },
  hangingNested: {
    marginInlineStart: `calc(1ch - min(var(--list-marker), var(--page-inset, ${spacingVars["--spacing-3"]}) + 1ch))`,
  },
  hangingRow: { gap: 0 },
  hangingSign: {
    // The marker's room, as wide as the list's widest marker, its sign at its end, before the text,
    // on one line.
    boxSizing: "border-box",
    display: "flex",
    flexShrink: 0,
    justifyContent: "flex-end",
    minWidth: 0,
    paddingInlineEnd: spacingVars["--spacing-1"],
    whiteSpace: "nowrap",
    width: "var(--list-marker)",
  },
  heading: {
    marginBlockEnd: spacingVars["--spacing-2"],
    marginBlockStart: { ":first-child": 0, default: spacingVars["--spacing-6"] },
  },
  important: { color: colorVars["--color-warning"] },
  item: {
    // A list item's text, at the reading size, which Astryx's rows set smaller.
    whiteSpace: "normal",
  },
  list: {
    // A list's margin, but last in its item or callout, which end with it.
    marginBlockEnd: { ":last-child": 0, default: spacingVars["--spacing-3"] },
  },
  // The room of a hanging list's markers, its gap before the text included.
  markerRoom: (width: string) => ({ "--list-marker": width }),
  paragraph: {
    marginBlockEnd: spacingVars["--spacing-3"],
    marginBlockStart: 0,
  },
  pro: { color: colorVars["--color-success"] },
  row: {
    // A list's row, as tall as its text: a touch screen's 44 px rows (`theme.ts`) are for controls,
    // and would push a one-line item's text below its marker.
    minHeight: 0,
  },
  sign: {
    fontWeight: fontWeightVars["--font-weight-bold"],
    minWidth: spacingVars["--spacing-4"],
  },
  table: { maxWidth: "100%", minWidth: "100%", width: "max-content" },
  warning: { color: colorVars["--color-warning"] },
});

const CALLOUT_STYLES: Record<string, stylex.StyleXStyles> = {
  caution: styles.calloutWarning,
  important: styles.calloutImportant,
  tip: styles.calloutTip,
  warning: styles.calloutWarning,
};

const SIGN_STYLES: Record<string, stylex.StyleXStyles> = {
  con: styles.con,
  important: styles.important,
  pro: styles.pro,
  warning: styles.warning,
};

/** The children of each block, by id. */
function useChildren(document: Document) {
  return useMemo(() => {
    const children = new Map<number | undefined, Array<Block>>();
    for (const block of document.blocks) {
      const list = children.get(block.parent) ?? [];
      list.push(block);
      children.set(block.parent, list);
    }
    return children;
  }, [document]);
}

export type BlockContext = {
  children: Map<number | undefined, Array<Block>>;
  document: Document;
  /** Draws a block its own way, when it returns something. */
  override?: (block: Block) => ReactNode | undefined;
  /** The room a jump to a heading leaves above it, as below the phone's tabs. */
  scrollMargin: stylex.StyleXStyles;
  selection?: Selection;
  /** Whether images are drawn alone, inside a control: no lightbox, so no dialog to hold. */
  staticImages: boolean;
};

/** A diagram's place among its document's diagrams, in the order the blocks are written. */
function diagramPlace(block: Block, document: Document): Place {
  const diagrams = document.blocks.filter(
    (other) => other.kind === "code" && other.language === "mermaid",
  );
  return {
    index: diagrams.findIndex((other) => other.id === block.id) + 1,
    total: diagrams.length,
  };
}

/** A table in a block of its own, which may reach into the margin, as far as the screen's edge. */
function TableBlock({ block, context }: { block: Block; context: BlockContext }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const measure = () => {
      const room = window.innerWidth - element.getBoundingClientRect().left - 16;
      element.style.maxWidth = `min(calc(100% + 16rem), ${Math.max(0, room)}px)`;
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return (
    <div {...stylex.props(styles.block, styles.table)} ref={ref}>
      <TableNode block={block} context={context} />
    </div>
  );
}

function Children({ block, context }: { block: Block; context: BlockContext }) {
  return (context.children.get(block.id) ?? []).map((child) => (
    <BlockNode block={child} context={context} key={child.id} />
  ));
}

/** The sign a typed bullet or a task item shows in place of its marker. */
function signOf(block: Block) {
  const marker = block.marker ?? "plain";
  if (marker === "task") {
    return block.checked ? "☑" : "☐";
  }
  return marker in SIGNS ? SIGNS[marker] : undefined;
}

/**
 * The room a hanging list gives its markers, gap included: a dash's, a sign's, or its longest
 * number's and its dot, in the font the list is drawn in.
 */
function markerRoom(list: Block, items: Array<Block>) {
  if (list.ordered) {
    const digits = String((list.start ?? 1) + Math.max(items.length - 1, 0)).length;
    return `calc(${digits}ch + 0.5ch + ${spacingVars["--spacing-1"]})`;
  }
  return items.some((item) => signOf(item) !== undefined)
    ? `calc(1em + ${spacingVars["--spacing-1"]})`
    : spacingVars["--spacing-3"];
}

/**
 * The marker a row shows before its text, if not the list's own: its typed sign, or, where the list
 * hangs its markers, its number or a dash, an ordered row's sign after its number.
 */
function rowMarker(list: Block, item: Block, index: number, isHanging: boolean) {
  const marker = item.marker ?? "plain";
  const sign = signOf(item);
  const signed = (isHanging: boolean) =>
    sign && (
      <span
        aria-hidden="true"
        {...stylex.props(styles.sign, isHanging && styles.hangingSign, SIGN_STYLES[marker])}
      >
        {sign}
      </span>
    );
  if (isHanging && list.ordered) {
    return (
      <>
        <span {...stylex.props(styles.hangingSign)}>{(list.start ?? 1) + index}.</span>
        {signed(false)}
      </>
    );
  }
  if (isHanging && !sign) {
    return (
      <span aria-hidden="true" {...stylex.props(styles.hangingSign, styles.dash)}>
        -
      </span>
    );
  }
  return signed(isHanging);
}

function ListNode({ block, context }: { block: Block; context: BlockContext }) {
  const items = context.children.get(block.id) ?? [];
  // On narrow screens, every row draws its own marker, hanging in the page's margin.
  const isHanging = isNarrow(useWidthClass());
  const parent = block.parent === undefined ? undefined : context.document.blocks[block.parent];
  // A list of typed bullets shows their signs only.
  const signed = items.length > 0 && items.every((item) => signOf(item) !== undefined);
  return (
    <List
      density="compact"
      edge="flush"
      listStyle={isHanging ? "none" : block.ordered ? "decimal" : signed ? "none" : "disc"}
      start={block.ordered ? (block.start ?? 1) : undefined}
      xstyle={[
        styles.list,
        isHanging && styles.markerRoom(markerRoom(block, items)),
        isHanging && (parent?.kind === "item" ? styles.hangingNested : styles.hanging),
      ]}
    >
      {items.map((item, index) => (
        <ListItem
          // A marker beside a wrapping item stays on its first line.
          align="first-line"
          key={item.id}
          label={
            <Selectable block={item} selection={context.selection}>
              <div {...stylex.props(proseStyles.reading, styles.item)}>
                <SinceWords block={item}>
                  <Spans spans={item.spans} />
                </SinceWords>
                <Children block={item} context={context} />
              </div>
            </Selectable>
          }
          startContent={rowMarker(block, item, index, isHanging)}
          xstyle={[styles.row, isHanging && styles.hangingRow]}
        />
      ))}
    </List>
  );
}

/** The kinds drawn whole by a node of their own, or by their parent's: never selected alone. */
const UNWRAPPED = new Set<Block["kind"]>(["list", "item", "table", "row", "cell"]);

/** A block's element, by its kind, without its selection. */
function blockElement(block: Block, context: BlockContext): ReactNode {
  const spans = <Spans spans={block.spans} />;
  switch (block.kind) {
    case "heading":
      return (
        <Heading
          id={block.anchor}
          level={Math.min(Math.max(block.level ?? 2, 1), 6) as 1 | 2 | 3 | 4 | 5 | 6}
          xstyle={[styles.heading, context.scrollMargin]}
        >
          {spans}
        </Heading>
      );
    case "paragraph":
      // A paragraph holding an image is a box: its lightbox, a dialog, cannot sit in a `<p>`. A
      // link alone in it, like a story's mockup, is a control's height.
      return (
        <Paragraph
          as={!context.staticImages && block.spans.some(opensImage) ? "div" : "p"}
          xstyle={styles.paragraph}
        >
          <SinceWords block={block}>
            <Spans isAlone spans={block.spans} />
          </SinceWords>
        </Paragraph>
      );
    case "list":
      return <ListNode block={block} context={context} />;
    case "item":
      // Drawn by its list, or alone, as an option's plain bullet: its text, then its blocks.
      return (
        <div {...stylex.props(proseStyles.reading, styles.item)}>
          <SinceWords block={block}>{spans}</SinceWords>
          <Children block={block} context={context} />
        </div>
      );
    case "callout": {
      const kind = block.calloutKind ?? "note";
      return (
        <div role="note" {...stylex.props(styles.callout, CALLOUT_STYLES[kind])}>
          <span {...stylex.props(styles.calloutTitle)}>
            {block.spans.length ? (
              <SinceWords block={block}>{spans}</SinceWords>
            ) : (
              CALLOUT_TITLES[kind]
            )}
          </span>
          <Children block={block} context={context} />
        </div>
      );
    }
    case "quote":
      return (
        <Blockquote xstyle={styles.block}>
          <Children block={block} context={context} />
        </Blockquote>
      );
    case "table":
      return <TableBlock block={block} context={context} />;
    case "row":
    case "cell":
      // Drawn by their table.
      return null;
    case "code":
      return block.language === "mermaid" ? (
        <Diagram place={diagramPlace(block, context.document)} source={block.text ?? ""} />
      ) : (
        <div {...stylex.props(styles.block)}>
          <CodeBlock code={block.text ?? ""} language={block.language} width="100%" />
        </div>
      );
    case "rule":
      return <Divider xstyle={styles.block} />;
    case "html":
      // Raw HTML is shown as text, never rendered.
      return (
        <div {...stylex.props(styles.block)}>
          <CodeBlock
            code={block.text ?? ""}
            hasCopyButton={false}
            hasLanguageLabel={false}
            width="100%"
          />
        </div>
      );
  }
}

function BlockNode({ block, context }: { block: Block; context: BlockContext }): ReactNode {
  const story = useStoryAt(block);
  const mockup = useMockupAt(block);
  const own = context.override?.(block);
  if (own !== undefined) {
    return own;
  }
  if (story || mockup) {
    return (
      <SinceBlock block={block}>
        <EmbedNode block={block} context={context} />
      </SinceBlock>
    );
  }
  const node = blockElement(block, context);
  return UNWRAPPED.has(block.kind) ? (
    node
  ) : (
    <Selectable block={block} selection={context.selection}>
      {node}
    </Selectable>
  );
}

/**
 * Draws blocks of a document: `ids` the top-level ones to draw, all of them by default. With a
 * selection, top-level blocks, list items, and table rows become tappable. With folds, each fold
 * is drawn where its first block would be, and its blocks inside it.
 */
export function Blocks({
  document,
  folds,
  ids,
  override,
  selection,
}: {
  document: Document;
  folds?: Folds;
  ids?: ReadonlyArray<number>;
  override?: (block: Block) => ReactNode | undefined;
  selection?: Selection;
}) {
  const children = useChildren(document);
  useHashFold(document, folds);
  const context = {
    children,
    document,
    override,
    scrollMargin: useScrollMargin(),
    selection,
    staticImages: useStaticImages(),
  };
  const blocks = ids
    ? ids.map((id) => document.blocks[id]).filter(Boolean)
    : (children.get(undefined) ?? []);
  const folded = new Map<number, Fold | undefined>();
  for (const fold of folds?.list ?? []) {
    fold.ids.forEach((id, index) => folded.set(id, index === 0 ? fold : undefined));
  }
  return (
    <SinceScoped document={document}>
      <div {...stylex.props(proseStyles.doc, styles.doc)}>
        {blocks.map((block) => {
          if (!folded.has(block.id)) {
            return <BlockNode block={block} context={context} key={block.id} />;
          }
          const fold = folded.get(block.id);
          if (!fold || !folds) {
            return null;
          }
          // The fold's title is its toggle; what follows the title in a review, like a pending
          // comment on it, comes first inside.
          const [title, ...rest] = fold.ids.map((id) => document.blocks[id]);
          return (
            <FoldNode fold={fold} folds={folds} key={`fold-${fold.key}`} title={title}>
              {title && selection?.after && <After>{selection.after(title)}</After>}
              {rest.map(
                (inner) => inner && <BlockNode block={inner} context={context} key={inner.id} />,
              )}
            </FoldNode>
          );
        })}
      </div>
    </SinceScoped>
  );
}
