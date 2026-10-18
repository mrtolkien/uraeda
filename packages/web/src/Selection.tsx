import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { focusOutlineStyles } from "@astryxdesign/core/utils/focusOutline.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useId } from "react";
import type { Block } from "uraeda-binding";
import type { Range } from "./useCommentDraft.ts";

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
  /** How a review selects the parts of the decisions a spec changes, which are not its blocks. */
  parts?: PartSelection;
};

/**
 * How a review selects a part of a decision, by its lines in the decision's file, `range`, whose
 * `decision` names the file: what follows it, whether it is selected, and what a tap does.
 */
export type PartSelection = {
  after: (range: DecisionRange) => ReactNode;
  isSelected: (range: DecisionRange) => boolean;
  onTap: (range: DecisionRange, element: HTMLElement) => void;
};

/** Lines of a decision's file, the decision named. */
export type DecisionRange = Range & { decision: NonNullable<Range["decision"]> };

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
    // the block (as its first cell, for a table row), Astryx's ring around it when focused by the
    // keyboard, on its edge. The ring is Astryx's own styles, in Astryx's layer: an unlayered copy of
    // its `outline-style: none` here would hide every ring Astryx draws, like a list row's.
    backgroundColor: "transparent",
    borderWidth: 0,
    cursor: "pointer",
    height: "100%",
    inset: 0,
    margin: 0,
    outlineOffset: { ":focus-visible": spacingVars["--spacing-0"], default: null },
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
 * What a tap on a selectable element does: it selects it, `onTap`, but on a link or a button of its
 * text, or on what follows a nested element, like its comment field. `lines` marks the element.
 */
function tapProps(lines: string, onTap: (element: HTMLElement) => void) {
  return {
    "data-lines": lines,
    onClick: (event: React.MouseEvent<HTMLElement>) => {
      event.stopPropagation();
      // What follows a nested block, like its comment field, belongs to that block, not this one.
      if ((event.target as Element).closest("[data-lines], [data-after]") !== event.currentTarget) {
        return;
      }
      // A link or a button in the block does its own job: the block is not selected on the way.
      // The block's toggle, the one button with a pressed state, selects it.
      const control = (event.target as Element).closest("a[href], button:not([aria-pressed])");
      if (control && event.currentTarget.contains(control)) {
        return;
      }
      onTap(event.currentTarget);
    },
  };
}

/**
 * A selectable element's toggle, for the keyboard and screen readers: named by its text, `textId`,
 * or by `label` when it has no text.
 */
function Toggle({ label, pressed, textId }: { label?: string; pressed: boolean; textId: string }) {
  return (
    // oxlint-disable-next-line react/forbid-elements -- the review's selectable block, a toggle as large as a block of document text, which no Astryx component draws (an Astryx gap, see the plan)
    <button
      aria-pressed={pressed}
      type="button"
      {...(label === undefined ? { "aria-labelledby": textId } : { "aria-label": label })}
      {...stylex.props(focusOutlineStyles.focusVisible, styles.toggle)}
    />
  );
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
    block: tapProps(`${block.startLine}-${block.endLine}`, (element) =>
      selection.onTap(block, element),
    ),
    cell: styles.cell,
    pressed,
    row: [styles.selectable, pressed && styles.selectedRow],
    textId,
    // A rule has no text: its lines name it.
    toggle: (
      <Toggle
        label={block.kind === "rule" ? `Line ${block.startLine}` : undefined}
        pressed={pressed}
        textId={textId}
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

/**
 * Something else than a block a review can tap, like a part of a decision: selected as a block is,
 * `pressed` once selected, with what follows it, `after`. `lines` names the lines it holds.
 */
export function Tappable({
  after,
  children,
  lines,
  onTap,
  pressed,
}: {
  after?: ReactNode;
  children: ReactNode;
  lines: string;
  onTap: (element: HTMLElement) => void;
  pressed: boolean;
}) {
  const textId = useId();
  return (
    <>
      <div
        {...tapProps(lines, onTap)}
        {...stylex.props(styles.selectable, pressed && styles.selected)}
      >
        <Toggle pressed={pressed} textId={textId} />
        <div id={textId} {...stylex.props(styles.above)}>
          {children}
        </div>
      </div>
      <After>{after}</After>
    </>
  );
}
