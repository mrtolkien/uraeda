import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { focusOutlineStyles } from "@astryxdesign/core/utils/focusOutline.stylex";
import * as stylex from "@stylexjs/stylex";
import { createContext, type ReactNode, type Ref, type RefObject, use, useId, useRef } from "react";
import type { Block } from "uraeda-binding";
import { useHeldElement } from "./cursor/held.ts";
import { HeldKeys, type StopKey } from "./cursor/StopKeys.tsx";
import { stopProps } from "./cursor/stops.ts";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { SinceBlock } from "./sinceMarks.tsx";
import type { Range } from "./commentRange.ts";

/**
 * How a review selects blocks: which are selected, what a tap does, given the block and the element
 * that draws it, and what follows a block. `canSelect` narrows the blocks a tap selects, every
 * selectable one by default: the others still have what follows them. `keys` are the keys a block
 * has while the keyboard's cursor holds its toggle, given the block and the toggle, drawn under it.
 */
export type Selection = {
  after?: (block: Block) => ReactNode;
  canSelect?: (block: Block) => boolean;
  isSelected: (block: Block) => boolean;
  keys?: (block: Block, toggle: HTMLElement) => ReadonlyArray<StopKey>;
  onTap: (block: Block, element: HTMLElement) => void;
  /** How a review selects the parts of the decisions a spec changes, which are not its blocks. */
  parts?: PartSelection;
};

/**
 * How a review selects a part of a decision, by its lines in the decision's file, `range`, whose
 * `decision` names the file: what follows it, whether it is selected, what a tap does, and the keys
 * it has while the keyboard's cursor holds it, as a block's.
 */
export type PartSelection = {
  after: (range: DecisionRange) => ReactNode;
  isSelected: (range: DecisionRange) => boolean;
  keys?: (range: DecisionRange, toggle: HTMLElement) => ReadonlyArray<StopKey>;
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
    // A block a review can select: tapped as a whole, tinted with a bar once selected. Under the
    // pointer it shows its bar and a light tint, as a card brightens, so a pointer's user sees it
    // can be pressed before pressing it; a selected block's own tint and bar stay.
    backgroundColor: { ":hover": colorVars["--color-background-muted"], default: null },
    borderInlineStartColor: { ":hover": colorVars["--color-border"], default: "transparent" },
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: spacingVars["--spacing-1"],
    cursor: "pointer",
    paddingInlineStart: spacingVars["--spacing-1"],
    position: "relative",
  },
  // A block of the document, not a list's item: the block's room under it, which its drawing, the
  // last of this box, leaves out (`Blocks`), but the last block's, followed only by what follows
  // it, which ends with what holds it.
  spaced: {
    marginBlockEnd: { ":nth-last-child(2)": 0, default: spacingVars["--spacing-3"] },
  },
  // A list's item: its room before its text taken back, out into its marker's gap.
  inList: { marginInlineStart: `calc(-2 * ${spacingVars["--spacing-1"]})` },
  // The room `selectable` takes before a block's text, without its tap or its tint.
  room: {
    borderInlineStartColor: "transparent",
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: spacingVars["--spacing-1"],
    paddingInlineStart: spacingVars["--spacing-1"],
  },
  // On narrow screens, the block takes no room for its bar, which a selected block draws in the gap
  // before its text, as a list's marker hangs in the page's margin: the text keeps the paragraphs'
  // edge and its whole width.
  selectableNarrow: {
    borderInlineStartWidth: 0,
    paddingInlineStart: 0,
  },
  selected: {
    backgroundColor: "var(--color-selection)",
    borderInlineStartColor: "var(--color-selection-edge)",
  },
  selectedNarrow: {
    boxShadow: `calc(-1 * ${spacingVars["--spacing-1"]}) 0 0 0 var(--color-selection-edge)`,
  },
  selectedRow: {
    backgroundColor: "var(--color-selection)",
  },
  // The keyboard's cursor on a block, as on a list's row: the mauve tint, but under a selected
  // range's yellow, which stays, and the block's edge in the accent, where a selected block's
  // yellow edge is, so the two never draw over each other.
  heldEdge: {
    borderInlineStartColor: colorVars["--color-accent"],
  },
  heldNarrow: {
    boxShadow: `calc(-1 * ${spacingVars["--spacing-1"]}) 0 0 0 ${colorVars["--color-accent"]}`,
  },
  heldTint: {
    backgroundColor: colorVars["--color-accent-muted"],
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
 * The mark of a selectable element, `data-lines`: a block's lines in the file, or a decision's
 * part's, its decision and side named, so a comment finds its element by its lines.
 */
export function linesMark(start: number, end: number, decision?: Range["decision"]) {
  return `${decision ? sideMark(decision) : ""}${start}-${end}`;
}

/** What starts the mark of each part of a decision's side, `linesMark`. */
export function sideMark(decision: NonNullable<Range["decision"]>) {
  return `${decision.name}${decision.removed ? " removed" : ""}:`;
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
 * or by `label` when it has no text. It is the block's stop, where the keyboard's cursor holds it.
 */
function Toggle({
  label,
  pressed,
  ref,
  textId,
}: {
  label?: string;
  pressed: boolean;
  ref: Ref<HTMLButtonElement>;
  textId: string;
}) {
  return (
    // oxlint-disable-next-line react/forbid-elements -- the review's selectable block, a toggle as large as a block of document text, which no Astryx component draws (an Astryx gap, see the plan)
    <button
      aria-pressed={pressed}
      ref={ref}
      type="button"
      {...stopProps("block", true)}
      {...(label === undefined ? { "aria-labelledby": textId } : { "aria-label": label })}
      {...stylex.props(focusOutlineStyles.focusVisible, styles.toggle)}
    />
  );
}

const NO_KEYS: ReadonlyArray<StopKey> = [];

/**
 * A selectable element's toggle as the keyboard's cursor holds it: its ref, whether it is held, and
 * its keys while it is, `keysOf` given the toggle, which `HeldKeys` declares and draws in a bar.
 */
function useToggleStop(keysOf: ((toggle: HTMLElement) => ReadonlyArray<StopKey>) | undefined) {
  const toggle = useRef<HTMLButtonElement>(null);
  const held = useHeldElement(toggle);
  const keys = held !== null && keysOf !== undefined ? keysOf(held) : NO_KEYS;
  return { held: held !== null, keys, toggle };
}

/**
 * What makes a block tappable in a review, or nothing outside one. A tap anywhere on the block
 * selects it, but on a link of its text; the keyboard and screen readers have its toggle, a button
 * named by the block's text, beside the text rather than around it, so its links stay reachable.
 * A table row draws itself with `row`, `cell`, and `above`: its first cell holds the toggle. Held by
 * the keyboard's cursor, the block has the picked look, `held`, and its keys' `bar` follows it.
 */
export function useSelect(block: Block, selection: Selection | undefined) {
  const textId = useId();
  const isOn = !!selection && selectable(block) && selection.canSelect?.(block) !== false;
  const keys = isOn ? selection.keys : undefined;
  const {
    held,
    keys: heldKeys,
    toggle,
  } = useToggleStop(keys && ((element) => keys(block, element)));
  if (!isOn) {
    return undefined;
  }
  const pressed = selection.isSelected(block);
  return {
    above: stylex.props(styles.above),
    block: tapProps(linesMark(block.startLine, block.endLine), (element) =>
      selection.onTap(block, element),
    ),
    cell: styles.cell,
    held,
    /** The ref of the toggle, the stop a comment under the block hands the cursor back to. */
    holder: toggle,
    keys: heldKeys,
    pressed,
    row: [
      styles.selectable,
      held && !pressed && styles.heldTint,
      pressed && styles.selectedRow,
      held && styles.heldEdge,
    ],
    textId,
    // A rule has no text: its lines name it.
    toggle: (
      <Toggle
        label={block.kind === "rule" ? `Line ${block.startLine}` : undefined}
        pressed={pressed}
        ref={toggle}
        textId={textId}
      />
    ),
  };
}

/**
 * The stop of the element a comment follows, its toggle, `null` where it has none, as a general
 * comment or a fold's title: the cursor goes back to it when the comment is deleted.
 */
const Holder = createContext<RefObject<HTMLElement | null> | null>(null);

/** The stop of the element what is drawn follows, as `After` gives it, `null` for none. */
export const useHolder = () => use(Holder);

/**
 * What follows a block, marked so a tap on it does not select the block it sits in. `holder` is the
 * block's toggle, given to what follows as `useHolder`; none passed, what follows has none, rather
 * than the toggle of a block around it.
 */
export function After({
  children,
  holder = null,
}: {
  children: ReactNode;
  holder?: RefObject<HTMLElement | null> | null;
}) {
  return (
    <Holder value={holder}>
      <div data-after="" {...stylex.props(styles.after)}>
        {children}
      </div>
    </Holder>
  );
}

/**
 * A block a review can tap, around its drawing, with what follows it; marked Δ when it changed
 * since your review.
 */
export function Selectable({
  block,
  children: drawing,
  isInList = false,
  selection,
}: {
  block: Block;
  children: ReactNode;
  /**
   * A list's item: its room for the bar is taken back, so that its text keeps the list's edge, as
   * near its marker as another list's, the bar of a selected item in the marker's gap.
   */
  isInList?: boolean;
  selection: Selection | undefined;
}) {
  const select = useSelect(block, selection);
  const children = <SinceBlock block={block}>{drawing}</SinceBlock>;
  const isNarrowScreen = isNarrow(useWidthClass());
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
        {...stylex.props(
          styles.selectable,
          isNarrowScreen && styles.selectableNarrow,
          isInList && !isNarrowScreen && styles.inList,
          // Held, the block's room under it goes under its bar.
          !isInList && !select.held && styles.spaced,
          select.held && !select.pressed && styles.heldTint,
          select.pressed && styles.selected,
          select.pressed && isNarrowScreen && styles.selectedNarrow,
          // The keyboard's cursor: its edge over the review's yellow one, the yellow tint kept.
          select.held && styles.heldEdge,
          select.held && isNarrowScreen && styles.heldNarrow,
        )}
      >
        {select.toggle}
        <div id={select.textId} {...select.above}>
          {children}
        </div>
      </div>
      {select.held && (
        <HeldKeys keys={select.keys}>
          {(bar) => <div {...stylex.props(!isInList && styles.spaced)}>{bar}</div>}
        </HeldKeys>
      )}
      <After holder={select.holder}>{selection?.after?.(block)}</After>
    </>
  );
}

/**
 * Blocks drawn without `selection`, read as they are, where the same page drawn for a review selects
 * them, like a plan's panes: on wide screens, they take the room a selectable block takes for its
 * bar, so their text sits where the review's does.
 */
export function SelectionRoom({
  children,
  selection,
}: {
  children: ReactNode;
  selection: Selection | undefined;
}) {
  const isNarrowScreen = isNarrow(useWidthClass());
  return selection || isNarrowScreen ? (
    children
  ) : (
    <div {...stylex.props(styles.room)}>{children}</div>
  );
}

/**
 * Something else than a block a review can tap, like a part of a decision: selected as a block is,
 * `pressed` once selected, with what follows it, `after`. `lines` names the lines it holds. Held by
 * the keyboard's cursor, it has the keys `keys` gives, given its toggle, their bar under it.
 */
export function Tappable({
  after,
  children,
  keys,
  lines,
  onTap,
  pressed,
}: {
  after?: ReactNode;
  children: ReactNode;
  keys?: (toggle: HTMLElement) => ReadonlyArray<StopKey>;
  lines: string;
  onTap: (element: HTMLElement) => void;
  pressed: boolean;
}) {
  const textId = useId();
  const { held, keys: heldKeys, toggle } = useToggleStop(keys);
  return (
    <>
      <div
        {...tapProps(lines, onTap)}
        {...stylex.props(
          styles.selectable,
          held && !pressed && styles.heldTint,
          pressed && styles.selected,
          held && styles.heldEdge,
        )}
      >
        <Toggle pressed={pressed} ref={toggle} textId={textId} />
        <div id={textId} {...stylex.props(styles.above)}>
          {children}
        </div>
      </div>
      {held && <HeldKeys keys={heldKeys} />}
      <After holder={toggle}>{after}</After>
    </>
  );
}
