import { Blockquote } from "@astryxdesign/core/Blockquote";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Divider } from "@astryxdesign/core/Divider";
import { Heading } from "@astryxdesign/core/Heading";
import { List, ListItem } from "@astryxdesign/core/List";
import { Table, TableBody, TableCell, TableHeaderCell, TableRow } from "@astryxdesign/core/Table";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, fontWeightVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useLayoutEffect, useMemo, useRef } from "react";
import type { Block, Document, SpecItems } from "uraeda-binding";
import { currentEntry, useHash } from "./routes.tsx";
import { After, Selectable, type Selection, useSelect } from "./Selection.tsx";
import { Spans } from "./Spans.tsx";

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
  center: { textAlign: "center" },
  con: { color: colorVars["--color-error"] },
  doc: {
    // Reading text: its own size, about 120 characters at most, left-aligned, its lines balanced.
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
    maxWidth: "var(--size-reading-measure)",
    textAlign: "start",
    textWrap: "pretty",
    // The page's inset, which a list's rows take back, so their text lines up with the paragraphs'.
    "--container-padding-inline-start": spacingVars["--spacing-4"],
  },
  fold: {
    marginBlockEnd: spacingVars["--spacing-3"],
  },
  foldBody: {
    // What a fold holds, at the reading size, which Astryx's content area sets to the body's.
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
    paddingBlockStart: spacingVars["--spacing-2"],
  },
  foldLabel: {
    // A fold's label, at the reading size, its row a control's height for a finger.
    alignItems: "center",
    display: "flex",
    fontSize: "var(--text-reading-size)",
    minHeight: "var(--size-element-md)",
  },
  headerCell: {
    // A header cell wraps its text, as a body cell does, instead of cutting it.
    maxWidth: "none",
    overflow: "visible",
    overflowWrap: "break-word",
    textOverflow: "clip",
    whiteSpace: "normal",
  },
  heading: {
    marginBlockEnd: spacingVars["--spacing-2"],
    marginBlockStart: { ":first-child": 0, default: spacingVars["--spacing-6"] },
  },
  important: { color: colorVars["--color-warning"] },
  item: {
    // A list item's text, at the reading size, which Astryx's rows set smaller.
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
    whiteSpace: "normal",
  },
  list: {
    // A list's margin, but last in its item or callout, which end with it.
    marginBlockEnd: { ":last-child": 0, default: spacingVars["--spacing-3"] },
  },
  paragraph: {
    marginBlockEnd: spacingVars["--spacing-3"],
    marginBlockStart: 0,
  },
  pro: { color: colorVars["--color-success"] },
  right: { textAlign: "end" },
  row: {
    // A list's row, as tall as its text: a touch screen's 44 px rows (`theme.ts`) are for controls,
    // and would push a one-line item's text below its marker.
    minHeight: 0,
  },
  sign: {
    fontWeight: fontWeightVars["--font-weight-bold"],
    minWidth: spacingVars["--spacing-4"],
  },
  warning: { color: colorVars["--color-warning"] },
});

/** A table column's alignment, from its separator row. */
const ALIGN_STYLES: Record<string, stylex.StyleXStyles> = {
  center: styles.center,
  right: styles.right,
};

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

/** Top-level blocks drawn folded, behind a toggle named by `label`, open when `key` is. */
export type Fold = { ids: ReadonlyArray<number>; key: string; label: string };

/** A document's folds, the open ones' keys, and how to open or close one. */
export type Folds = {
  list: ReadonlyArray<Fold>;
  onOpenChange: (key: string, isOpen: boolean) => void;
  open: ReadonlyArray<string>;
};

/**
 * A spec's folds, as the core finds them: each story's scenarios, keyed by the story's id, then
 * the Details section.
 */
export function specFolds(spec: Pick<SpecItems, "details" | "stories">): Array<Fold> {
  const folds: Array<Fold> = spec.stories
    .filter((story) => story.details.length > 0)
    .map((story) => ({
      ids: story.details,
      key: story.id,
      label: `Scenarios (${story.scenarios.length})`,
    }));
  if (spec.details.length > 0) {
    folds.push({ ids: spec.details, key: "details", label: "Details" });
  }
  return folds;
}

type Context = {
  children: Map<number | undefined, Array<Block>>;
  document: Document;
  /** Draws a block its own way, when it returns something. */
  override?: (block: Block) => ReactNode | undefined;
  selection?: Selection;
};

function Children({ block, context }: { block: Block; context: Context }) {
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

function ListNode({ block, context }: { block: Block; context: Context }) {
  const items = context.children.get(block.id) ?? [];
  // A list of typed bullets shows their signs only.
  const signed = items.length > 0 && items.every((item) => signOf(item) !== undefined);
  return (
    <List
      density="compact"
      edgeCompensation="inline"
      listStyle={block.ordered ? "decimal" : signed ? "none" : "disc"}
      start={block.ordered ? (block.start ?? 1) : undefined}
      xstyle={styles.list}
    >
      {items.map((item) => {
        const sign = signOf(item);
        const marker = item.marker ?? "plain";
        return (
          <ListItem
            key={item.id}
            label={
              <Selectable block={item} selection={context.selection}>
                <div {...stylex.props(styles.item)}>
                  <Spans spans={item.spans} />
                  <Children block={item} context={context} />
                </div>
              </Selectable>
            }
            startContent={
              sign && (
                <span aria-hidden="true" {...stylex.props(styles.sign, SIGN_STYLES[marker])}>
                  {sign}
                </span>
              )
            }
            xstyle={styles.row}
          />
        );
      })}
    </List>
  );
}

/** A table row, tapped in place, its comments following it as a row of their own. */
function RowNode({ context, row }: { context: Context; row: Block }) {
  const cells = context.children.get(row.id) ?? [];
  const select = useSelect(row, context.selection);
  const after = select && context.selection?.after?.(row);
  const Cell = row.header ? TableHeaderCell : TableCell;
  return (
    <>
      <TableRow {...select?.block} id={select?.textId} xstyle={select?.row ?? []}>
        {cells.map((cell, index) => (
          <Cell
            key={cell.id}
            xstyle={[
              row.header && styles.headerCell,
              ALIGN_STYLES[cell.align ?? ""],
              index === 0 && select?.cell,
            ]}
          >
            {index === 0 && select?.toggle}
            <span {...select?.above}>
              <Spans spans={cell.spans} />
            </span>
          </Cell>
        ))}
      </TableRow>
      {after && (
        <TableRow>
          <TableCell colSpan={cells.length}>
            <After>{after}</After>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function TableNode({ block, context }: { block: Block; context: Context }) {
  const rows = context.children.get(block.id) ?? [];
  return (
    <div {...stylex.props(styles.block)}>
      <Table dividers="rows" textOverflow="wrap" verticalAlign="top">
        <TableBody>
          {rows.map((row) => (
            <RowNode context={context} key={row.id} row={row} />
          ))}
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
          id={block.anchor}
          level={Math.min(Math.max(block.level ?? 2, 1), 6) as 1 | 2 | 3 | 4 | 5 | 6}
          xstyle={styles.heading}
        >
          {spans}
        </Heading>
      );
      break;
    case "paragraph":
      node = (
        <Text as="p" display="block" type="inherit" xstyle={styles.paragraph}>
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
            hasCopyButton={false}
            hasLanguageLabel={false}
            width="100%"
          />
        </div>
      );
      break;
  }
  return (
    <Selectable block={block} selection={context.selection}>
      {node}
    </Selectable>
  );
}

/**
 * Opens the fold holding the block the location's hash names, and scrolls to it once open: once
 * per hash, so the fold can be closed again, and not where Back returns to a saved position.
 */
function useHashFold(document: Document, folds: Folds | undefined) {
  const hash = decodeURIComponent(useHash().slice(1));
  const handled = useRef<string>(undefined);
  const target = useMemo(() => {
    let block = hash ? document.blocks.find((b) => b.anchor === hash) : undefined;
    while (block?.parent !== undefined) {
      block = document.blocks[block.parent];
    }
    const id = block?.id;
    return folds?.list.find((fold) => id !== undefined && fold.ids.includes(id));
  }, [document, folds?.list, hash]);
  useLayoutEffect(() => {
    if (!folds || !target || handled.current === hash) {
      return;
    }
    if (!folds.open.includes(target.key)) {
      folds.onOpenChange(target.key, true);
      return;
    }
    handled.current = hash;
    const element = window.document.getElementById(hash);
    if (element && typeof currentEntry().scroll !== "number") {
      element.scrollIntoView({ block: "start" });
      // A little below the top, or the top bar, where it stays on the phone.
      const bar = window.document.querySelector('[role="banner"]')?.getBoundingClientRect();
      window.scrollBy(0, -Math.max(bar?.bottom ?? 0, 0) - 16);
    }
  }, [folds, hash, target]);
}

/**
 * A fold: its toggle, named by its label, in place of its first block, its title, like the
 * scenarios' intro or the Details heading, whose anchor it takes; then its other blocks, drawn
 * while it is open, after what follows its title in a review, like a pending comment on it.
 */
function FoldNode({ context, fold, folds }: { context: Context; fold: Fold; folds: Folds }) {
  const [title, ...rest] = fold.ids.map((id) => context.document.blocks[id]);
  return (
    <div id={title?.anchor} {...stylex.props(styles.fold)}>
      <Collapsible
        chevronPosition="start"
        isOpen={folds.open.includes(fold.key)}
        onOpenChange={(isOpen: boolean) => folds.onOpenChange(fold.key, isOpen)}
        trigger={<span {...stylex.props(styles.foldLabel)}>{fold.label}</span>}
      >
        <div {...stylex.props(styles.foldBody)}>
          {title && context.selection?.after && <After>{context.selection.after(title)}</After>}
          {rest.map(
            (block) => block && <BlockNode block={block} context={context} key={block.id} />,
          )}
        </div>
      </Collapsible>
    </div>
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
  const context = { children, document, override, selection };
  const blocks = ids
    ? ids.map((id) => document.blocks[id]).filter(Boolean)
    : (children.get(undefined) ?? []);
  const folded = new Map<number, Fold | undefined>();
  for (const fold of folds?.list ?? []) {
    fold.ids.forEach((id, index) => folded.set(id, index === 0 ? fold : undefined));
  }
  return (
    <div {...stylex.props(styles.doc)}>
      {blocks.map((block) => {
        if (!folded.has(block.id)) {
          return <BlockNode block={block} context={context} key={block.id} />;
        }
        const fold = folded.get(block.id);
        return (
          fold &&
          folds && <FoldNode context={context} fold={fold} folds={folds} key={`fold-${fold.key}`} />
        );
      })}
    </div>
  );
}
