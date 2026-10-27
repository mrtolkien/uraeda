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
  sizeVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import { useSortable } from "@dnd-kit/react/sortable";
import * as stylex from "@stylexjs/stylex";
import { createContext, type MouseEvent, type ReactNode, useContext } from "react";
import { legendStyles } from "../layout/legend.ts";

/**
 * What a card's editor tells the list: that it closed, whether it holds text not saved yet, and the
 * new key of the line it saved.
 */
export type EditorHooks = {
  onDirty: (isDirty: boolean) => void;
  onDone: () => void;
  onRenamed: (key: string) => void;
};

/** A card's line: what a list draws, and where a tap on it leads. */
export interface WorkRow {
  /**
   * What the card shows in the place of its link while it is edited in place (the `i` key): its
   * editor, which calls `onDone` once it closed, saved or not, and `onRenamed` with the key the
   * line has once saved, as the text that is its key changed.
   */
  editor?: (hooks: EditorHooks) => ReactNode;
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

/** What the list says of its cards: the one edited in place, and the one whose menu is open. */
export type RowState = {
  editing?: string;
  menu?: string;
  /** The editor of the card edited holds unsaved text, or no longer does. */
  onDirty: (isDirty: boolean) => void;
  onEdited: () => void;
  /** A card's menu opened or closed: `key` is the card's. */
  onMenu: (key: string, isOpen: boolean) => void;
  /** The line of the card edited was saved: `key` is the key it has now. */
  onRenamed: (key: string) => void;
};

/** The list's state of its cards: nothing is edited, and no menu is open, outside a list. */
export const RowStateContext = createContext<RowState>({
  onDirty: () => {},
  onEdited: () => {},
  onMenu: () => {},
  onRenamed: () => {},
});

/** What a card tells its menu: whether the list holds it open, and the list hearing it open or close. */
export type MenuState = { isOpen: boolean; onOpenChange: (isOpen: boolean) => void };

/** The menu state of the card around a `…` menu, if it is in a card. */
export const MenuStateContext = createContext<MenuState | undefined>(undefined);

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
    paddingInlineEnd: spacingVars["--spacing-2"],
    paddingInlineStart: spacingVars["--spacing-2"],
    position: "relative",
    // The long press on a phone does not select text or open the link's menu.
    userSelect: "none",
    // oxlint-disable-next-line stylex/valid-styles -- WebKit's own property, missing from StyleX's list: a long press that starts a drag must not open the link's menu
    WebkitTouchCallout: "none",
  },
  lifted: {
    backgroundColor: colorVars["--color-background-card"],
    zIndex: 1,
  },
  // The marks, centred on the top border and hiding it behind them, as a pane's title does.
  marks: { color: "var(--color-text-lavender)" },
  // Room at the end for the `…` button, so the text never runs under it.
  menu: {
    insetBlockStart: spacingVars["--spacing-1"],
    insetInlineEnd: spacingVars["--spacing-1"],
    position: "absolute",
    // Over the stretched link, so a press on it reaches it.
    zIndex: 2,
  },
  withMenu: {
    paddingInlineEnd: `calc(${sizeVars["--size-element-sm"]} + ${spacingVars["--spacing-2"]})`,
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
    // No ring of its own around the text: the card's frame draws the focus ring, and a second one,
    // as wide as the text, showed as bars inside a selected card.
    outlineStyle: { ":focus-visible": "none", default: null },
    textDecoration: "none",
  },
  text: { overflowWrap: "anywhere" },
  // A child line of the card: a bullet and its text, tabbed in from the card's own text.
  subline: {
    alignItems: "baseline",
    color: colorVars["--color-text-secondary"],
    display: "flex",
    gap: spacingVars["--spacing-2"],
    paddingInlineStart: spacingVars["--spacing-3"],
  },
  sublineText: { flex: 1, minWidth: 0, overflowWrap: "anywhere" },
});

/** The card's text as the link stretched over it: a plain click opens it with `onOpen`. */
function RowLink({ onOpen, row }: { onOpen?: (row: WorkRow) => void; row: WorkRow }) {
  return (
    <Link
      // The normal text colour, not the link's accent; two lines at most, then an ellipsis, with the
      // whole text in a tooltip.
      color="primary"
      href={row.href}
      maxLines={2}
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
  );
}

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
  const state = useContext(RowStateContext);
  const isEditing = state.editing === row.key && row.editor !== undefined;
  const { handleRef, isDragging, ref } = useSortable({
    accept: "line",
    data: { text: row.text },
    // A card edited in place does not drag: a press in its field selects text.
    disabled: row.isFixed === true || isEditing,
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
      // What the list's keys find the row by, whether or not it draws a link (see `useListKeys`).
      data-row-key={row.key}
      ref={row.isFixed ? undefined : ref}
      {...stylex.props(
        styles.frame,
        row.menu !== undefined && styles.withMenu,
        isSelected && styles.selected,
        isDragging && styles.lifted,
      )}
    >
      {/* dnd-kit's accessibility attributes (a button role, a tab stop) go on its handle: an empty, hidden element, so the card stays a link and the sensor takes a press anywhere on it. */}
      {!row.isFixed && <span aria-hidden="true" ref={handleRef} tabIndex={-1} />}
      {row.marks !== undefined && (
        <span
          {...stylex.props(
            legendStyles.legend,
            legendStyles.onBody,
            legendStyles.text,
            styles.marks,
          )}
        >
          {row.marks}
        </span>
      )}
      {isEditing ? (
        row.editor?.({
          onDirty: state.onDirty,
          onDone: state.onEdited,
          onRenamed: state.onRenamed,
        })
      ) : (
        <RowLink onOpen={onOpen} row={row} />
      )}
      {row.lines.map((line, at) => (
        // A bullet, indented under the text, in the smaller type, two lines at most.
        <span key={at} {...stylex.props(styles.subline)}>
          <span aria-hidden="true">•</span>
          <Text color="secondary" maxLines={2} type="supporting" xstyle={styles.sublineText}>
            {line}
          </Text>
        </span>
      ))}
      {/* A block of its own: under the text, as a note's row draws it, not beside it. */}
      {row.image !== undefined && <div>{row.image}</div>}
      {/* After the link, so Tab from the card reaches it; over the link by its z-index. */}
      {row.menu !== undefined && (
        <span {...stylex.props(styles.menu)}>
          <MenuStateContext
            value={{
              isOpen: state.menu === row.key,
              onOpenChange: (isOpen) => state.onMenu(row.key, isOpen),
            }}
          >
            {row.menu}
          </MenuStateContext>
        </span>
      )}
    </li>
  );
}
