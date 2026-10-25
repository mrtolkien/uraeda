// A line of the priorities or the inbox as a small card: a square frame with its whole text
// wrapping, its sub-lines under it, and its marks set in its top border as a pane's title is. The
// whole card is one link, stretched over it, and drags from anywhere past 5 px of a mouse press, or
// after half a second of a touch press (see `SENSORS`). The `…` button's slot sits at its corner.
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import {
  borderVars,
  colorVars,
  focusVars,
  shadowVars,
  sizeVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import { useSortable } from "@dnd-kit/react/sortable";
import * as stylex from "@stylexjs/stylex";
import type { MouseEvent, ReactNode } from "react";

/** A card's line: what a list draws, and where a tap on it leads. */
export interface WorkRow {
  /** Where a click or Enter on the card leads. */
  href: string;
  /** A picture under its text, such as a note's first image. */
  image?: ReactNode;
  /** Whether it stays where it is: a running entry, which dragging would not move. */
  isFixed?: boolean;
  key: string;
  /** Its text as drawn, with its formatting. */
  label?: ReactNode;
  /** Its children, each a grey line under its text. */
  lines: ReadonlyArray<string>;
  /** Its marks, as text set in its top border. */
  marks?: ReactNode;
  /** The `…` button, at the card's corner. */
  menu?: ReactNode;
  /** Its text, plain: the row's label when `label` is absent. */
  text: string;
}

const styles = stylex.create({
  // The frame: a raw element, as the plan's Complexity tracking says (no Astryx component sets
  // marks in a border).
  frame: {
    // The `…` button's opacity, which `CardMenu` reads: shown under the pointer, on keyboard focus
    // within the card, and always when the pointer cannot hover, a touch screen.
    "--menu-opacity": {
      ":has(:focus-visible)": 1,
      ":hover": 1,
      "@media (hover: none)": 1,
      default: 0,
    },
    borderColor: colorVars["--color-border"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    // The focus ring of the link, drawn on the frame, from the pseudo-class alone: a default of the
    // app's own, unlayered, would override Astryx's layered rule on any element that shares the
    // atomic class.
    outlineColor: { ":has(:focus-visible)": colorVars["--color-accent"], default: null },
    outlineOffset: {
      ":has(:focus-visible)": `calc(-1 * ${focusVars["--focus-outline-width"]})`,
      default: null,
    },
    outlineStyle: { ":has(:focus-visible)": "solid", default: null },
    outlineWidth: { ":has(:focus-visible)": focusVars["--focus-outline-width"], default: null },
    // No margin: a card lifted by a drag is positioned from its border box, and a margin would
    // offset it. The list's gap leaves room for the marks over the border.
    // The whole card is tappable: a target as tall as a control, the theme's 44 px on a touch screen.
    cursor: "pointer",
    minHeight: sizeVars["--size-element-sm"],
    minWidth: 0,
    paddingBlock: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-2"],
    position: "relative",
    // The long press on a phone does not select text or open the link's menu.
    userSelect: "none",
    // oxlint-disable-next-line stylex/valid-styles -- WebKit's own property, missing from StyleX's list: a long press that starts a drag must not open the link's menu
    WebkitTouchCallout: "none",
  },
  lifted: {
    backgroundColor: colorVars["--color-background-card"],
    boxShadow: shadowVars["--shadow-med"],
    zIndex: 1,
  },
  // The marks, centred on the top border and hiding it behind them, as a pane's title does.
  marks: {
    backgroundColor: colorVars["--color-background-body"],
    color: "var(--color-text-lavender)",
    fontSize: typeScaleVars["--text-supporting-size"],
    insetBlockStart: 0,
    insetInlineStart: spacingVars["--spacing-2"],
    lineHeight: typeScaleVars["--text-supporting-leading"],
    paddingInline: spacingVars["--spacing-1"],
    position: "absolute",
    transform: "translateY(-50%)",
  },
  menu: {
    insetBlockStart: spacingVars["--spacing-1"],
    insetInlineEnd: spacingVars["--spacing-1"],
    position: "absolute",
    // Over the stretched link, so a press on it reaches it.
    zIndex: 2,
  },
  // The mauve tint of a selected row, apart from the pane's own background.
  selected: {
    "--menu-opacity": 1,
    backgroundColor: colorVars["--color-accent-muted"],
    borderColor: colorVars["--color-accent"],
  },
  // The link's text, and the link stretched over the whole card by its pseudo-element.
  stretched: {
    "::after": { content: '""', inset: 0, position: "absolute" },
    color: "inherit",
    textDecoration: "none",
  },
  text: { overflowWrap: "anywhere" },
});

/**
 * One card. A card that moves is a sortable of its section, dragged from anywhere, with reduced
 * motion jumping to its place; a fixed one, such as a running entry, is only drawn. `index` is its
 * place among its section's cards.
 */
export function Card({
  index,
  isSelected,
  onOpen,
  row,
  section,
}: {
  index: number;
  isSelected: boolean;
  /** Opens the card on a plain click or Enter, in place of following its link. */
  onOpen?: (row: WorkRow) => void;
  row: WorkRow;
  section: string;
}) {
  const isReduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { handleRef, isDragging, ref } = useSortable({
    accept: "line",
    data: { text: row.text },
    disabled: row.isFixed === true,
    group: section,
    id: row.key,
    index,
    type: "line",
    // With reduced motion, the cards jump to their places instead of sliding.
    transition: isReduced ? null : undefined,
  });
  return (
    <li
      // What the list's keys move between: see `useListKeys`.
      aria-current={isSelected ? "true" : undefined}
      data-row=""
      ref={row.isFixed ? undefined : ref}
      {...stylex.props(styles.frame, isSelected && styles.selected, isDragging && styles.lifted)}
    >
      {/* dnd-kit's accessibility attributes (a button role, a tab stop) go on its handle: an empty, hidden element, so the card stays a link and the sensor takes a press anywhere on it. */}
      {!row.isFixed && <span aria-hidden="true" ref={handleRef} tabIndex={-1} />}
      {row.marks !== undefined && <span {...stylex.props(styles.marks)}>{row.marks}</span>}
      <Link
        href={row.href}
        onClick={(event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
          // A click that is a drag's end is already prevented, and a modified one is the browser's.
          const plain = !(event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0);
          if (onOpen && plain && !event.defaultPrevented) {
            event.preventDefault();
            onOpen(row);
          }
        }}
        xstyle={[styles.stretched, styles.text]}
      >
        {row.label ?? row.text}
      </Link>
      {row.lines.map((line, at) => (
        <Text color="secondary" display="block" key={at}>
          {line}
        </Text>
      ))}
      {row.image}
      {/* After the link, so Tab from the card reaches it; over the link by its z-index. */}
      {row.menu !== undefined && <span {...stylex.props(styles.menu)}>{row.menu}</span>}
    </li>
  );
}
