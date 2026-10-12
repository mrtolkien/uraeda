import { Blockquote } from "@astryxdesign/core/Blockquote";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Divider } from "@astryxdesign/core/Divider";
import { Heading } from "@astryxdesign/core/Heading";
import { List, ListItem } from "@astryxdesign/core/List";
import { Table, TableBody, TableCell, TableHeaderCell, TableRow } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useMemo } from "react";
import type { Block, Document } from "uraeda-binding";
import { Spans } from "./Spans.tsx";

/** How a review selects blocks: which are selected, what a tap does, and what follows a block. */
export type Selection = {
  isSelected: (block: Block) => boolean;
  onTap: (block: Block) => void;
  after?: (block: Block) => ReactNode;
};

const SIGNS: Record<string, string> = {
  pro: "+",
  con: "−",
  question: "?",
  important: "!",
  warning: "⚠",
  ask: "?",
  note: "&",
};

const CALLOUT_TITLES: Record<string, string> = {
  note: "Note",
  tip: "Tip",
  important: "Important",
  warning: "Warning",
  caution: "Caution",
  question: "Question",
};

const styles = stylex.create({
  // Reading text: its own size, about 70 characters at most, left-aligned, its lines balanced.
  doc: {
    maxWidth: "var(--size-reading-measure)",
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
    textAlign: "start",
    textWrap: "pretty",
    // The page's inset, which a list's rows take back, so their text lines up with the paragraphs'.
    "--container-padding-inline-start": spacingVars["--spacing-4"],
  },
  heading: {
    marginBlockStart: spacingVars["--spacing-6"],
    marginBlockEnd: spacingVars["--spacing-2"],
    ":first-child": { marginBlockStart: 0 },
  },
  paragraph: {
    marginBlockStart: 0,
    marginBlockEnd: spacingVars["--spacing-3"],
  },
  // A list item's text, at the reading size, which Astryx's rows set smaller.
  item: {
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
    whiteSpace: "normal",
  },
  list: {
    marginBlockEnd: spacingVars["--spacing-3"],
  },
  sign: {
    fontWeight: 700,
    minWidth: spacingVars["--spacing-4"],
  },
  pro: { color: colorVars["--color-success"] },
  con: { color: colorVars["--color-error"] },
  important: { color: colorVars["--color-warning"] },
  warning: { color: colorVars["--color-warning"] },
  // A callout: a bar down its side, coloured by its kind, its title above its text.
  callout: {
    marginBlockEnd: spacingVars["--spacing-4"],
    paddingInlineStart: spacingVars["--spacing-3"],
    borderInlineStartWidth: spacingVars["--spacing-1"],
    borderInlineStartStyle: "solid",
    borderInlineStartColor: colorVars["--color-accent"],
  },
  calloutImportant: { borderInlineStartColor: colorVars["--color-border-purple"] },
  calloutWarning: { borderInlineStartColor: colorVars["--color-warning"] },
  calloutTip: { borderInlineStartColor: colorVars["--color-success"] },
  calloutTitle: {
    display: "block",
    fontWeight: 700,
  },
  block: {
    marginBlockEnd: spacingVars["--spacing-3"],
  },
  // A block a review can select: tapped as a whole, tinted with a bar once selected.
  selectable: {
    cursor: "pointer",
    paddingInlineStart: spacingVars["--spacing-1"],
    borderInlineStartWidth: spacingVars["--spacing-1"],
    borderInlineStartStyle: "solid",
    borderInlineStartColor: "transparent",
  },
  selected: {
    backgroundColor: "var(--color-selection)",
    borderInlineStartColor: "var(--color-selection-edge)",
  },
  selectedRow: {
    backgroundColor: "var(--color-selection)",
  },
  // A header cell wraps its text, as a body cell does, instead of cutting it.
  headerCell: {
    maxWidth: "none",
    overflow: "visible",
    overflowWrap: "break-word",
    textOverflow: "clip",
    whiteSpace: "normal",
  },
  center: { textAlign: "center" },
  right: { textAlign: "end" },
});

/** A table column's alignment, from its separator row. */
const ALIGN_STYLES: Record<string, stylex.StyleXStyles> = {
  center: styles.center,
  right: styles.right,
};

const CALLOUT_STYLES: Record<string, stylex.StyleXStyles> = {
  important: styles.calloutImportant,
  warning: styles.calloutWarning,
  caution: styles.calloutWarning,
  tip: styles.calloutTip,
};

const SIGN_STYLES: Record<string, stylex.StyleXStyles> = {
  pro: styles.pro,
  con: styles.con,
  important: styles.important,
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

type Context = {
  children: Map<number | undefined, Array<Block>>;
  selection?: Selection;
  /** Draws a block its own way, when it returns something. */
  override?: (block: Block) => ReactNode | undefined;
};

/**
 * Whether a review can select a block, and so place a comment under it: a top-level block but a
 * list or a table, a list item, or a table row.
 */
export function selectable(block: Block) {
  return block.parent === undefined
    ? block.kind !== "list" && block.kind !== "table"
    : block.kind === "item" || block.kind === "row";
}

/** The attributes that make a block tappable in a review, or nothing outside one. */
function selectProps(block: Block, context: Context) {
  const { selection } = context;
  if (!selection || !selectable(block)) {
    return undefined;
  }
  return {
    role: "button",
    tabIndex: 0,
    "aria-pressed": selection.isSelected(block),
    "data-lines": `${block.startLine}-${block.endLine}`,
    onClick: (event: React.MouseEvent) => {
      event.stopPropagation();
      selection.onTap(block);
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        event.stopPropagation();
        selection.onTap(block);
      }
    },
  };
}

/** A block a review can tap, around its drawing, with what follows it. */
function Selectable({
  block,
  context,
  children,
}: {
  block: Block;
  context: Context;
  children: ReactNode;
}) {
  const props = selectProps(block, context);
  if (!props) {
    return children;
  }
  return (
    <>
      <div
        {...props}
        {...stylex.props(styles.selectable, props["aria-pressed"] && styles.selected)}
      >
        {children}
      </div>
      {context.selection?.after?.(block)}
    </>
  );
}

function Children({ block, context }: { block: Block; context: Context }) {
  return (context.children.get(block.id) ?? []).map((child) => (
    <BlockNode key={child.id} block={child} context={context} />
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

function ListNode({ block, context }: { block: Block; context: Context }) {
  const items = context.children.get(block.id) ?? [];
  // A list of typed bullets shows their signs only.
  const signed = items.length > 0 && items.every((item) => signOf(item) !== undefined);
  return (
    <List
      listStyle={block.ordered ? "decimal" : signed ? "none" : "disc"}
      start={block.ordered ? (block.start ?? 1) : undefined}
      density="compact"
      edgeCompensation="inline"
      xstyle={styles.list}
    >
      {items.map((item) => {
        const sign = signOf(item);
        const marker = item.marker ?? "plain";
        return (
          <ListItem
            key={item.id}
            startContent={
              sign && (
                <span aria-hidden="true" {...stylex.props(styles.sign, SIGN_STYLES[marker])}>
                  {sign}
                </span>
              )
            }
            label={
              <Selectable block={item} context={context}>
                <div {...stylex.props(styles.item)}>
                  <Spans spans={item.spans} />
                  <Children block={item} context={context} />
                </div>
              </Selectable>
            }
          />
        );
      })}
    </List>
  );
}

function TableNode({ block, context }: { block: Block; context: Context }) {
  const rows = context.children.get(block.id) ?? [];
  return (
    <div {...stylex.props(styles.block)}>
      <Table dividers="rows" textOverflow="wrap" verticalAlign="top">
        <TableBody>
          {rows.map((row) => {
            // A row is tapped in place, and its comments follow it as a row of their own.
            const cells = context.children.get(row.id) ?? [];
            const props = selectProps(row, context);
            const after = props && context.selection?.after?.(row);
            const Cell = row.header ? TableHeaderCell : TableCell;
            return [
              <TableRow
                key={row.id}
                {...props}
                xstyle={
                  props ? [styles.selectable, props["aria-pressed"] && styles.selectedRow] : []
                }
              >
                {cells.map((cell) => (
                  <Cell
                    key={cell.id}
                    xstyle={[row.header && styles.headerCell, ALIGN_STYLES[cell.align ?? ""]]}
                  >
                    <Spans spans={cell.spans} />
                  </Cell>
                ))}
              </TableRow>,
              after && (
                <TableRow key={`${row.id}-after`}>
                  <TableCell colSpan={cells.length}>{after}</TableCell>
                </TableRow>
              ),
            ];
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function BlockNode({ block, context }: { block: Block; context: Context }): ReactNode {
  const own = context.override?.(block);
  if (own !== undefined) {
    return own;
  }
  const spans = <Spans spans={block.spans} />;
  let node: ReactNode;
  switch (block.kind) {
    case "heading":
      node = (
        <Heading
          level={Math.min(Math.max(block.level ?? 2, 1), 6) as 1 | 2 | 3 | 4 | 5 | 6}
          id={block.anchor}
          xstyle={styles.heading}
        >
          {spans}
        </Heading>
      );
      break;
    case "paragraph":
      node = (
        <Text as="p" type="inherit" display="block" xstyle={styles.paragraph}>
          {spans}
        </Text>
      );
      break;
    case "list":
      return <ListNode block={block} context={context} />;
    case "item":
      // Drawn by its list.
      return null;
    case "callout": {
      const kind = block.calloutKind ?? "note";
      node = (
        <div role="note" {...stylex.props(styles.callout, CALLOUT_STYLES[kind])}>
          <span {...stylex.props(styles.calloutTitle)}>
            {block.spans.length ? spans : CALLOUT_TITLES[kind]}
          </span>
          <Children block={block} context={context} />
        </div>
      );
      break;
    }
    case "quote":
      node = (
        <Blockquote xstyle={styles.block}>
          <Children block={block} context={context} />
        </Blockquote>
      );
      break;
    case "table":
      return <TableNode block={block} context={context} />;
    case "row":
    case "cell":
      // Drawn by their table.
      return null;
    case "code":
      node = (
        <div {...stylex.props(styles.block)}>
          <CodeBlock code={block.text ?? ""} language={block.language} width="100%" />
        </div>
      );
      break;
    case "rule":
      node = <Divider xstyle={styles.block} />;
      break;
    case "html":
      // Raw HTML is shown as text, never rendered.
      node = (
        <div {...stylex.props(styles.block)}>
          <CodeBlock
            code={block.text ?? ""}
            hasLanguageLabel={false}
            hasCopyButton={false}
            width="100%"
          />
        </div>
      );
      break;
  }
  return (
    <Selectable block={block} context={context}>
      {node}
    </Selectable>
  );
}

/**
 * Draws blocks of a document: `ids` the top-level ones to draw, all of them by default. With a
 * selection, top-level blocks, list items, and table rows become tappable.
 */
export function Blocks({
  document,
  ids,
  selection,
  override,
}: {
  document: Document;
  ids?: ReadonlyArray<number>;
  selection?: Selection;
  override?: (block: Block) => ReactNode | undefined;
}) {
  const children = useChildren(document);
  const context = { children, selection, override };
  const blocks = ids
    ? ids.map((id) => document.blocks[id]).filter(Boolean)
    : (children.get(undefined) ?? []);
  return (
    <div {...stylex.props(styles.doc)}>
      {blocks.map((block) => (
        <BlockNode key={block.id} block={block} context={context} />
      ))}
    </div>
  );
}
