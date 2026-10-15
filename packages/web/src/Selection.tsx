import { focusVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useId } from "react";
import type { Block } from "uraeda-binding";

/**
 * How a review selects blocks: which are selected, what a tap does, given the block and the element
 * that draws it, and what follows a block. `canSelect` narrows the blocks a tap selects, every
 * selectable one by default: the others still have what follows them.
 */
export type Selection = {
  after?: (block: Block) => ReactNode;
  canSelect?: (block: Block) => boolean;
  isSelected: (block: Block) => boolean;
  onTap: (block: Block, element: HTMLElement) => void;
};

const styles = stylex.create({
  above: {
    // The block's text, above its toggle, so its links stay links.
    position: "relative",
  },
  after: {
    // What follows a block, like its comments: no box of its own.
    display: "contents",
  },
  cell: {
    position: "relative",
  },
  selectable: {
    // A block a review can select: tapped as a whole, tinted with a bar once selected.
    borderInlineStartColor: "transparent",
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: spacingVars["--spacing-1"],
    cursor: "pointer",
    paddingInlineStart: spacingVars["--spacing-1"],
    position: "relative",
  },
  selected: {
    backgroundColor: "var(--color-selection)",
    borderInlineStartColor: "var(--color-selection-edge)",
  },
  selectedRow: {
    backgroundColor: "var(--color-selection)",
  },
  toggle: {
    // The block's toggle, for the keyboard and screen readers: under the block's text, as large as
    // the block (as its first cell, for a table row), its ring around it when focused by the keyboard.
    backgroundColor: "transparent",
    borderWidth: 0,
    cursor: "pointer",
    height: "100%",
    inset: 0,
    margin: 0,
    outlineColor: focusVars["--focus-outline-color"],
    outlineOffset: 0,
    outlineStyle: { ":focus-visible": focusVars["--focus-outline-style"], default: "none" },
    outlineWidth: focusVars["--focus-outline-width"],
    padding: 0,
    position: "absolute",
    width: "100%",
  },
});

/**
 * Whether a review can select a block, and so place a comment under it: a top-level block but a
 * list or a table, a list item, or a table row.
 */
export function selectable(block: Block) {
  return block.parent === undefined
    ? block.kind !== "list" && block.kind !== "table"
    : block.kind === "item" || block.kind === "row";
}

/**
 * What makes a block tappable in a review, or nothing outside one. A tap anywhere on the block
 * selects it, but on a link of its text; the keyboard and screen readers have its toggle, a button
 * named by the block's text, beside the text rather than around it, so its links stay reachable.
 * A table row draws itself with `row`, `cell`, and `above`: its first cell holds the toggle.
 */
export function useSelect(block: Block, selection: Selection | undefined) {
  const textId = useId();
  if (!selection || !selectable(block) || selection.canSelect?.(block) === false) {
    return undefined;
  }
  const pressed = selection.isSelected(block);
  return {
    above: stylex.props(styles.above),
    block: {
      "data-lines": `${block.startLine}-${block.endLine}`,
      onClick: (event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        // What follows a nested block, like its comment field, belongs to that block, not this one.
        if (
          (event.target as Element).closest("[data-lines], [data-after]") !== event.currentTarget
        ) {
          return;
        }
        // A link or a button in the block does its own job: the block is not selected on the way.
        // The block's toggle, the one button with a pressed state, selects it.
        const control = (event.target as Element).closest("a[href], button:not([aria-pressed])");
        if (control && event.currentTarget.contains(control)) {
          return;
        }
        selection.onTap(block, event.currentTarget);
      },
    },
    cell: styles.cell,
    pressed,
    row: [styles.selectable, pressed && styles.selectedRow],
    textId,
    toggle: (
      // oxlint-disable-next-line react/forbid-elements -- the review's selectable block, a toggle as large as a block of document text, which no Astryx component draws (an Astryx gap, see the plan)
      <button
        aria-pressed={pressed}
        type="button"
        // A rule has no text: its lines name it.
        {...(block.kind === "rule"
          ? { "aria-label": `Line ${block.startLine}` }
          : { "aria-labelledby": textId })}
        {...stylex.props(styles.toggle)}
      />
    ),
  };
}

/** What follows a block, marked so a tap on it does not select the block it sits in. */
export function After({ children }: { children: ReactNode }) {
  return (
    <div data-after="" {...stylex.props(styles.after)}>
      {children}
    </div>
  );
}

/** A block a review can tap, around its drawing, with what follows it. */
export function Selectable({
  block,
  children,
  selection,
}: {
  block: Block;
  children: ReactNode;
  selection: Selection | undefined;
}) {
  const select = useSelect(block, selection);
  if (!select) {
    // A block a tap does not select may still have something after it, like a comment.
    return selection?.after && selectable(block) ? (
      <>
        {children}
        <After>{selection.after(block)}</After>
      </>
    ) : (
      children
    );
  }
  return (
    <>
      <div
        {...select.block}
        {...stylex.props(styles.selectable, select.pressed && styles.selected)}
      >
        {select.toggle}
        <div id={select.textId} {...select.above}>
          {children}
        </div>
      </div>
      <After>{selection?.after?.(block)}</After>
    </>
  );
}
