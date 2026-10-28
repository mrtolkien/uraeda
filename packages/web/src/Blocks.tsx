import { Blockquote } from "@astryxdesign/core/Blockquote";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Divider } from "@astryxdesign/core/Divider";
import { Heading } from "@astryxdesign/core/Heading";
import { colorVars, fontWeightVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useLayoutEffect, useMemo, useRef } from "react";
import type { Block, Document, Span } from "uraeda-binding";
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
import { ruleStyles } from "./layout/rules.ts";

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
  con: { color: colorVars["--color-error"] },
  doc: {
    // The page's inset, which a list's rows take back, so their text lines up with the paragraphs'.
    "--container-padding-inline-start": spacingVars["--spacing-4"],
  },
  // A list, the browser's: its markers in `room` before its items' text, outside it, so that a
  // wrapped line hangs under the text, not under the marker.
  native: (room: string) => ({
    listStylePosition: "outside",
    marginBlockStart: 0,
    paddingInlineStart: room,
  }),
  disc: { listStyleType: "disc" },
  // On narrow screens, a dash, the narrowest marker, which hangs in the page's margin.
  dashed: { listStyleType: '"- "' },
  numbered: { listStyleType: "decimal" },
  // On narrow screens, the markers hang in the page's margin, as far as its inset allows: the
  // text of a list on the paragraphs' edge when the inset holds the markers' whole room.
  hanging: (room: string) => ({
    paddingInlineStart: `max(0px, calc(${room} - var(--page-inset, ${spacingVars["--spacing-3"]})))`,
  }),
  // A typed item's marker: its sign, in place of the list's bullet.
  signMarker: (sign: string) => ({ listStyleType: sign }),
  heading: {
    marginBlockEnd: spacingVars["--spacing-2"],
    marginBlockStart: { ":first-child": 0, default: spacingVars["--spacing-6"] },
  },
  important: { color: colorVars["--color-warning"] },
  item: {
    // A list item's room under it, but the last's, and its marker in the secondary colour.
    "::marker": { color: colorVars["--color-text-secondary"] },
    marginBlockEnd: { ":last-child": 0, default: spacingVars["--spacing-2"] },
    whiteSpace: "normal",
  },
  // A typed item's sign as its marker, in its colour and bold.
  conMarker: {
    "::marker": {
      color: colorVars["--color-error"],
      fontWeight: fontWeightVars["--font-weight-bold"],
    },
  },
  importantMarker: {
    "::marker": {
      color: colorVars["--color-warning"],
      fontWeight: fontWeightVars["--font-weight-bold"],
    },
  },
  plainSignMarker: { "::marker": { fontWeight: fontWeightVars["--font-weight-bold"] } },
  proMarker: {
    "::marker": {
      color: colorVars["--color-success"],
      fontWeight: fontWeightVars["--font-weight-bold"],
    },
  },
  list: {
    // A list's margin, but last in its item or callout, which end with it.
    marginBlockEnd: { ":last-child": 0, default: spacingVars["--spacing-3"] },
  },
  paragraph: {
    marginBlockEnd: { ":last-child": 0, default: spacingVars["--spacing-3"] },
    marginBlockStart: 0,
  },
  // A section that reads as prose, a round's context: more room between its paragraphs.
  airyParagraph: { marginBlockEnd: { ":last-child": 0, default: spacingVars["--spacing-4"] } },
  // Such a section's text: as wide as its pane, which its page keeps narrow, about 70 characters a
  // line, and more room between its lines.
  airy: { "--size-reading-measure": "none", "--text-reading-line": "1.65" },
  // A leading paragraph's first sentence, on a line of its own, and the rest under it, dimmer.
  leadSentence: {
    color: colorVars["--color-text-primary"],
    display: "block",
    fontWeight: fontWeightVars["--font-weight-medium"],
  },
  leadRest: { color: colorVars["--color-text-secondary"], display: "block" },
  pro: { color: colorVars["--color-success"] },
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

/** Each typed item's marker style, its sign's colour, by its kind; bold for every kind. */
const SIGN_MARKERS: Record<string, stylex.StyleXStyles> = {
  ask: styles.plainSignMarker,
  con: styles.conMarker,
  important: styles.importantMarker,
  note: styles.plainSignMarker,
  pro: styles.proMarker,
  question: styles.plainSignMarker,
  task: styles.plainSignMarker,
  warning: styles.importantMarker,
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
 * A list as the page's text draws it: the browser's own `<ul>` or `<ol>`, whose markers sit on the
 * baseline of their item's first line at any size and line height, the item's wrapped lines hanging
 * under its text. A bullet is a disc, a dash on narrow screens, where the markers hang in the
 * page's margin; a typed item's marker is its sign, in its colour, after its number in a numbered
 * list.
 */
function ListNode({ block, context }: { block: Block; context: BlockContext }) {
  const items = context.children.get(block.id) ?? [];
  const isHanging = isNarrow(useWidthClass());
  const parent = block.parent === undefined ? undefined : context.document.blocks[block.parent];
  const isNested = parent?.kind === "item";
  const Tag = block.ordered ? "ol" : "ul";
  const digits = String((block.start ?? 1) + Math.max(items.length - 1, 0)).length;
  // The markers' room: a bullet's, or the longest number's with its dot.
  const room = block.ordered ? `calc(${digits}ch + 1.25em)` : "1.25em";
  return (
    <Tag
      {...(block.ordered && (block.start ?? 1) !== 1 ? { start: block.start } : {})}
      {...stylex.props(
        styles.list,
        styles.native(room),
        block.ordered ? styles.numbered : isHanging ? styles.dashed : styles.disc,
        isHanging && !isNested && styles.hanging(room),
      )}
    >
      {items.map((item) => {
        const marker = item.marker ?? "plain";
        const sign = signOf(item);
        const isSignMarker = sign !== undefined && !block.ordered;
        return (
          <li
            key={item.id}
            {...stylex.props(
              proseStyles.reading,
              styles.item,
              isSignMarker && styles.signMarker(`"${sign} "`),
              isSignMarker && SIGN_MARKERS[marker],
            )}
          >
            <Selectable block={item} isInList selection={context.selection}>
              <div>
                {sign !== undefined && block.ordered && (
                  <span aria-hidden="true" {...stylex.props(styles.sign, SIGN_STYLES[marker])}>
                    {sign}{" "}
                  </span>
                )}
                <SinceWords block={item}>
                  <Spans spans={item.spans} />
                </SinceWords>
                <Children block={item} context={context} />
              </div>
            </Selectable>
          </li>
        );
      })}
    </Tag>
  );
}

/**
 * A paragraph's spans split after its first sentence: the sentence's, and the rest's. The end is
 * the first ".", "!" or "?" before a space or the end in plain text, not in code nor a link. None
 * when the paragraph is one sentence.
 */
function firstSentence(spans: ReadonlyArray<Span>): [Array<Span>, Array<Span>] | undefined {
  for (const [index, span] of spans.entries()) {
    if (span.code || span.link || span.image) {
      continue;
    }
    const end = /[.!?](?=\s)/.exec(span.text);
    if (end) {
      const at = end.index + 1;
      const rest = [{ ...span, text: span.text.slice(at).trimStart() }, ...spans.slice(index + 1)];
      return rest.some((one) => one.text !== "" || one.image)
        ? [[...spans.slice(0, index), { ...span, text: span.text.slice(0, at) }], rest]
        : undefined;
    }
  }
  return undefined;
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
          xstyle={[styles.paragraph, context.isAiry && styles.airyParagraph]}
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
    staticImages: useStaticImages(),
  };
  const folded = new Map<number, Fold | undefined>();
  for (const fold of folds?.list ?? []) {
    fold.ids.forEach((id, index) => folded.set(id, index === 0 ? fold : undefined));
  }
  return (
    <SinceScoped document={document}>
      <div {...stylex.props(proseStyles.doc, styles.doc, isAiry && styles.airy)}>
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
