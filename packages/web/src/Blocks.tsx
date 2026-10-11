import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { createElement, type ReactNode, useMemo } from "react";
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
};

/** A block that a review can select: the top-level blocks, list items, and table rows. */
function selectable(block: Block) {
  return block.parent === undefined || block.kind === "item" || block.kind === "row";
}

/** The attributes that make a block tappable in a review, or nothing outside one. */
function selectProps(block: Block, context: Context) {
  const { selection } = context;
  if (!selection || !selectable(block) || block.kind === "list" || block.kind === "table") {
    return undefined;
  }
  return {
    className: "block",
    role: "button",
    tabIndex: 0,
    "aria-selected": selection.isSelected(block),
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

function Children({ block, context }: { block: Block; context: Context }) {
  return (context.children.get(block.id) ?? []).map((child) => (
    <BlockNode key={child.id} block={child} context={context} />
  ));
}

function BlockNode({ block, context }: { block: Block; context: Context }): ReactNode {
  const spans = <Spans spans={block.spans} />;
  let node: ReactNode;
  switch (block.kind) {
    case "heading":
      node = createElement(`h${Math.min(block.level ?? 2, 6)}`, { id: block.anchor }, spans);
      break;
    case "paragraph":
      node = <p>{spans}</p>;
      break;
    case "list": {
      const items = <Children block={block} context={context} />;
      node = block.ordered ? <ol start={block.start}>{items}</ol> : <ul>{items}</ul>;
      break;
    }
    case "item": {
      const marker = block.marker ?? "plain";
      const sign =
        marker === "task"
          ? block.checked
            ? "☑"
            : "☐"
          : marker in SIGNS
            ? SIGNS[marker]
            : undefined;
      const props = selectProps(block, context);
      const classes = [sign ? `typed ${marker}` : "", props?.className ?? ""].join(" ").trim();
      return (
        <li {...props} className={classes || undefined}>
          {sign && (
            <span className="sign" aria-hidden="true">
              {sign}
            </span>
          )}
          {spans}
          <Children block={block} context={context} />
          {props && context.selection?.after?.(block)}
        </li>
      );
    }
    case "callout": {
      const kind = block.calloutKind ?? "note";
      node = (
        <div className={`callout ${kind}`} role="note">
          <span className="callout-title">{block.spans.length ? spans : CALLOUT_TITLES[kind]}</span>
          <Children block={block} context={context} />
        </div>
      );
      break;
    }
    case "quote":
      node = (
        <blockquote>
          <Children block={block} context={context} />
        </blockquote>
      );
      break;
    case "table":
      node = (
        <div className="table-scroll">
          <table>
            <tbody>
              <Children block={block} context={context} />
            </tbody>
          </table>
        </div>
      );
      break;
    case "row":
      node = (
        <tr>
          {(context.children.get(block.id) ?? []).map((cell) =>
            createElement(
              block.header ? "th" : "td",
              { key: cell.id, style: { textAlign: cell.align ?? undefined } },
              <Spans spans={cell.spans} />,
            ),
          )}
        </tr>
      );
      break;
    case "cell":
      node = <Spans spans={block.spans} />;
      break;
    case "code":
      node = <CodeBlock code={block.text ?? ""} language={block.language} />;
      break;
    case "rule":
      node = <hr />;
      break;
    case "html":
      // Raw HTML is shown as text, never rendered.
      node = <pre className="html">{block.text}</pre>;
      break;
  }
  const props = block.kind === "row" ? undefined : selectProps(block, context);
  if (!props) {
    return node;
  }
  return (
    <>
      <div {...props}>{node}</div>
      {context.selection?.after?.(block)}
    </>
  );
}

/**
 * Draws blocks of a document: `ids` the top-level ones to draw, all of them by default. With a
 * selection, top-level blocks and list items become tappable.
 */
export function Blocks({
  document,
  ids,
  selection,
}: {
  document: Document;
  ids?: ReadonlyArray<number>;
  selection?: Selection;
}) {
  const children = useChildren(document);
  const context = { children, selection };
  const blocks = ids
    ? ids.map((id) => document.blocks[id]).filter(Boolean)
    : (children.get(undefined) ?? []);
  return (
    <div className="doc">
      {blocks.map((block) => (
        <BlockNode key={block.id} block={block} context={context} />
      ))}
    </div>
  );
}
