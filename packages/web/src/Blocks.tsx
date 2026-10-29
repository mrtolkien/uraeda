import { Blockquote } from "@astryxdesign/core/Blockquote";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Divider } from "@astryxdesign/core/Divider";
import { Heading } from "@astryxdesign/core/Heading";
import { colorVars, fontWeightVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useLayoutEffect, useMemo, useRef } from "react";
import type { Block, Document, Span } from "uraeda-binding";
import { listStyles, ListNode } from "./BlockList.tsx";
import { proseRhythm, proseStyles } from "./Prose.tsx";
import { Diagram, type Place } from "./Diagram.tsx";
import { type Fold, FoldNode, type Folds, useHashFold } from "./Folds.tsx";
import { useStaticImages } from "./ImageView.tsx";
import { Paragraph } from "./layout/Paragraph.tsx";
import { useScrollMargin } from "./layout/scrollMargin.ts";
import { After, Selectable, type Selection } from "./Selection.tsx";
import { firstSentence } from "./sentences.ts";
import { SinceBlock, SinceScoped, SinceWords } from "./sinceMarks.tsx";
import { TableNode } from "./BlockTable.tsx";
import { opensImage, Spans } from "./Spans.tsx";
import { EmbedNode } from "./EmbedNode.tsx";
import { useMockupAt, useStoryAt } from "./stories.tsx";
import { ruleStyles } from "./layout/rules.ts";

/** A callout's title when it has none of its own, by its kind. */
const CALLOUT_TITLES: Record<string, string> = {
  caution: "Caution",
  important: "Important",
  note: "Note",
  question: "Question",
  tip: "Tip",
  warning: "Warning",
};

const styles = stylex.create({
  // A section that reads as prose, a round's context: more room between its paragraphs.
  airyParagraph: { marginBlockEnd: { ":last-child": 0, default: spacingVars["--spacing-4"] } },
  // Each block's room under it, but the last's of what holds it, a pane or a callout, which ends with
  // it: its own room would add to the pane's under it.
  block: {
    marginBlockEnd: { ":last-child": 0, default: spacingVars["--spacing-3"] },
  },
  callout: {
    // A callout: a bar down its side, coloured by its kind, its title above its text.
    borderInlineStartColor: colorVars["--color-accent"],
    marginBlockEnd: { ":last-child": 0, default: spacingVars["--spacing-4"] },
  },
  calloutImportant: { borderInlineStartColor: colorVars["--color-border-purple"] },
  calloutTip: { borderInlineStartColor: colorVars["--color-success"] },
  calloutTitle: {
    display: "block",
    fontWeight: fontWeightVars["--font-weight-bold"],
  },
  calloutWarning: { borderInlineStartColor: colorVars["--color-warning"] },
  heading: {
    marginBlockEnd: spacingVars["--spacing-2"],
    marginBlockStart: { ":first-child": 0, default: spacingVars["--spacing-6"] },
  },
  // A leading paragraph's first sentence, on a line of its own, and the rest under it, dimmer.
  leadRest: { color: colorVars["--color-text-secondary"], display: "block" },
  leadSentence: {
    color: colorVars["--color-text-primary"],
    display: "block",
    fontWeight: fontWeightVars["--font-weight-medium"],
  },
  // A table as wide as its columns: past the reading measure into the page's margin, scrolling only
  // past that.
  // Its maximum width is set by `TableBlock`, which measures what remains of the screen.
  table: {
    // A card's block padding is not the table's to take back, as Astryx's table does in a card
    // (`containerBleed`): it is a block among others, with room before and after it, but at the
    // start and end of what holds it.
    "--container-padding-block-end": "0px",
    "--container-padding-block-start": "0px",
    // Its rows' lines run as far as `--table-bleed` past its sides, its holder's room, as a pane's
    // to its border: Astryx's table takes it back, its first and last columns' text then at the
    // text's edges. None outside a holder.
    "--container-padding-inline-end": "var(--table-bleed, 0px)",
    "--container-padding-inline-start": "var(--table-bleed, 0px)",
    marginBlockEnd: { ":last-child": 0, default: spacingVars["--spacing-5"] },
    marginBlockStart: { ":first-child": 0, default: spacingVars["--spacing-5"] },
    maxWidth: "100%",
    minWidth: "100%",
    width: "max-content",
  },
});

/** A callout's bar's colour, by its kind: the accent's for the others. */
const CALLOUT_STYLES: Record<string, stylex.StyleXStyles> = {
  caution: styles.calloutWarning,
  important: styles.calloutImportant,
  tip: styles.calloutTip,
  warning: styles.calloutWarning,
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
  /** Its paragraphs given more room between them, as a round's context's (see `Blocks`). */
  isAiry?: boolean;
  /** The paragraph whose first sentence leads, set apart: a round's goal's first. */
  lead?: number;
  /** Draws a block its own way, when it returns something. */
  override?: (block: Block) => ReactNode | undefined;
  /** The room a jump to a heading leaves above it, as below the phone's tabs. */
  scrollMargin: stylex.StyleXStyles;
  selection?: Selection;
  /** Its list items' sentences after their first, each a bullet under it: a round's settled points. */
  splitsItems?: boolean;
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

/**
 * A table in a block of its own, which may reach into the margin, `--table-reach` past its text, as
 * far as the screen's edge: 16rem, or none where a box holds it, as a question's card.
 */
function TableBlock({ block, context }: { block: Block; context: BlockContext }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    const measure = () => {
      const room = window.innerWidth - element.getBoundingClientRect().left - 16;
      element.style.maxWidth = `min(calc(100% + var(--table-reach, 16rem)), ${Math.max(0, room)}px)`;
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

/** A block's children, each drawn as its kind. */
function Children({ block, context }: { block: Block; context: BlockContext }) {
  return (context.children.get(block.id) ?? []).map((child) => (
    <BlockNode block={child} context={context} key={child.id} />
  ));
}

/**
 * A paragraph that leads: its first sentence on a line of its own, in the text's colour and
 * heavier, the rest under it in the secondary colour, so that what a section is about reads first.
 */
function Led({ spans }: { spans: ReadonlyArray<Span> }) {
  const split = firstSentence(spans);
  if (!split) {
    return <Spans isAlone spans={spans} />;
  }
  return (
    <>
      <span {...stylex.props(styles.leadSentence)}>
        <Spans spans={split[0]} />
      </span>
      <span {...stylex.props(styles.leadRest)}>
        <Spans spans={split[1]} />
      </span>
    </>
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
          xstyle={[proseRhythm.paragraph, context.isAiry && styles.airyParagraph]}
        >
          <SinceWords block={block}>
            {block.id === context.lead ? (
              <Led spans={block.spans} />
            ) : (
              <Spans isAlone spans={block.spans} />
            )}
          </SinceWords>
        </Paragraph>
      );
    case "list":
      return (
        <ListNode
          block={block}
          context={context}
          nested={(item) => <Children block={item} context={context} />}
        />
      );
    case "item":
      // Drawn by its list, or alone, as an option's plain bullet: its text, then its blocks.
      return (
        <div {...stylex.props(proseStyles.reading, listStyles.item, proseRhythm.item)}>
          <SinceWords block={block}>{spans}</SinceWords>
          <Children block={block} context={context} />
        </div>
      );
    case "callout": {
      const kind = block.calloutKind ?? "note";
      return (
        <div role="note" {...stylex.props(ruleStyles.bar, styles.callout, CALLOUT_STYLES[kind])}>
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
  hasLead = false,
  ids,
  isAiry = false,
  override,
  selection,
  splitsItems = false,
}: {
  document: Document;
  folds?: Folds;
  /** Its first paragraph's first sentence leads, apart from the rest: a round's goal. */
  hasLead?: boolean;
  ids?: ReadonlyArray<number>;
  /** Prose given air: a shorter line, taller lines, more room between paragraphs. */
  isAiry?: boolean;
  override?: (block: Block) => ReactNode | undefined;
  selection?: Selection;
  /** Its list items' sentences after their first, each a bullet under it. */
  splitsItems?: boolean;
}) {
  const children = useChildren(document);
  useHashFold(document, folds);
  const blocks = ids
    ? ids.map((id) => document.blocks[id]).filter(Boolean)
    : (children.get(undefined) ?? []);
  const lead = hasLead ? blocks.find((block) => block.kind === "paragraph")?.id : undefined;
  const context: BlockContext = {
    children,
    document,
    isAiry,
    ...(lead === undefined ? {} : { lead }),
    ...(override ? { override } : {}),
    scrollMargin: useScrollMargin(),
    ...(selection ? { selection } : {}),
    splitsItems,
    staticImages: useStaticImages(),
  };
  const folded = new Map<number, Fold | undefined>();
  for (const fold of folds?.list ?? []) {
    fold.ids.forEach((id, index) => folded.set(id, index === 0 ? fold : undefined));
  }
  return (
    <SinceScoped document={document}>
      <div
        // Such a section's text: as wide as its pane, which its page keeps narrow, about 80
        // characters a line, and more room between its lines.
        {...stylex.props(proseStyles.doc, isAiry && proseStyles.paneWide)}
      >
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
