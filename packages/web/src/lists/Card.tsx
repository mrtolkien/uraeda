// A line of the priorities or the inbox as a row of a list: a bullet and its text, three lines at
// most, its marks before the text, and its sub-lines under it, with no frame of its own. The whole
// row is one control, stretched over it, and drags from anywhere past 5 px of a mouse press, or
// after half a second of a touch press (see `SENSORS`). The `…` button shows over its end, and the
// row the list picked shows what it can do under its text (see `RowBar`). A nested row of an outline
// is a card of its own, tabbed in by its depth, that the keys select and a drag moves, its own
// nested rows with it (see `useDragOrder`).
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import {
  colorVars,
  focusVars,
  sizeVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import { useSortable } from "@dnd-kit/react/sortable";
import * as stylex from "@stylexjs/stylex";
import {
  type ComponentProps,
  createContext,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  useContext,
} from "react";
import { pickedStyles } from "../layout/picked.ts";
import { type BarAction, RowBar } from "./RowBar.tsx";

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
   * Its rows nested under it, at any depth, in the order of the file: each drawn after it as a card
   * of its own, which the keys select, edit, and move among its siblings, and a drag moves.
   */
  children?: ReadonlyArray<WorkRow>;
  /** A nested row's depth, 1 under its line. */
  depth?: number;
  /**
   * What the card shows in the place of its link while it is edited in place (the `i` key): its
   * editor, which calls `onDone` once it closed, saved or not, and `onRenamed` with the key the
   * line has once saved, as the text that is its key changed.
   */
  editor?: (hooks: EditorHooks) => ReactNode;
  /** Enter or a click edits it in place, in place of following `href`. */
  editsInPlace?: boolean;
  /** Where a click or Enter on the card leads. */
  href: string;
  /** An icon in the place of its bullet, as a draft's file or a running entry's work. */
  icon?: ComponentProps<typeof Icon>["icon"];
  /** A picture under its text, such as a note's first image. */
  image?: ReactNode;
  /** A row that adds a line, "Add to Next": Enter on it opens the form. It is no line: never counted, dragged, or moved. */
  isAdd?: boolean;
  /** Whether it stays where it is: a running entry, which dragging would not move. */
  isFixed?: boolean;
  /** A new row being typed: its editor shows from the start, and nothing else of it. */
  isFresh?: boolean;
  /** Its text is a link to a file, as a line's draft is: drawn as a hyperlink. */
  isLinked?: boolean;
  key: string;
  /** Its text as drawn, with its formatting. */
  label?: ReactNode;
  /** Its children, each a grey line under its text. */
  lines: ReadonlyArray<string>;
  /** Its marks, as small text after its own. */
  marks?: ReactNode;
  /** The `…` button, at the card's corner. */
  menu?: ReactNode;
  /** A nested row's line: the key of the row it is drawn in. */
  parent?: string;
  /** Where its list places it, as the list knows it: the priorities' place in the file. */
  spot?: object;
  /** A line that never nests under another, by Tab or a drag: a line with a draft. */
  staysLine?: boolean;
  /** Its text, plain: the row's label when `label` is absent. */
  text: string;
}

/**
 * What the list says of its cards: the one edited in place, the one whose menu is open, and the one
 * whose bar shows, with what its bar holds.
 */
export type RowState = {
  barOf?: (row: WorkRow) => ReadonlyArray<BarAction>;
  /** The key of the row whose bar shows under it: the one the keys or a click picked. */
  barred?: string;
  editing?: string;
  /** A field is open, edited or new: nothing drags, as a new row is no row of the file yet. */
  isTyping?: boolean;
  menu?: string;
  /** The key of the row in the move mode, whose keys move it: framed apart, its bar its moves. */
  moving?: string;
  /** The bar went, as a scroll sends the phone's away: the row stays selected, with no bar. */
  onBarAway?: () => void;
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
  // The row: a line of the list as a bullet and its text, with no frame of its own. A raw element,
  // as the plan's Complexity tracking says.
  frame: {
    // The bullet, in the gutter before the text: in a box of the icons' size, centred as they are,
    // so that bullets and icons line up in one column, on the middle of the first line.
    // Its box's lengths are custom properties: StyleX's values for them list no length.
    "::before": {
      "--card-bullet-height": "1.5rem",
      "--card-bullet-inset": "0.125rem",
      "--card-bullet-width": "1rem",
      alignItems: "center",
      color: colorVars["--color-text-secondary"],
      content: '"•"',
      display: "flex",
      height: "var(--card-bullet-height)",
      insetBlockStart: "var(--card-bullet-inset)",
      insetInlineStart: "var(--card-bullet-inset)",
      justifyContent: "center",
      position: "absolute",
      width: "var(--card-bullet-width)",
    },
    // The `…` button's opacity, which `CardMenu` reads: shown under the pointer, on keyboard focus
    // within the card, and always when the pointer cannot hover, a touch screen.
    "--menu-opacity": {
      ":has(:focus-visible)": 1,
      ":hover": 1,
      "@media (hover: none)": 1,
      default: 0,
    },
    // No margin: a card lifted by a drag is positioned from its border box, and a margin would
    // offset it. The whole row is tappable: on a touch screen as tall as a control, the theme's
    // 44 px; with a mouse only as tall as its text.
    cursor: "pointer",
    minHeight: { "@media (hover: none)": sizeVars["--size-element-sm"], default: null },
    minWidth: 0,
    // Its room above and below, a custom property: StyleX's padding values list no length.
    "--card-block": "0.125rem",
    paddingBlock: "var(--card-block)",
    paddingInlineEnd: spacingVars["--spacing-2"],
    // The gutter: a 1 rem bullet or icon at the row's edge, and a little room before the text.
    "--card-gutter": "1.5rem",
    paddingInlineStart: "var(--card-gutter)",
    position: "relative",
    // The long press on a phone does not select text or open the link's menu.
    userSelect: "none",
    // oxlint-disable-next-line stylex/valid-styles -- WebKit's own property, missing from StyleX's list: a long press that starts a drag must not open the link's menu
    WebkitTouchCallout: "none",
  },
  // A row being dragged: over the others, on a surface of its own.
  lifted: { backgroundColor: colorVars["--color-background-card"] },
  raised: { zIndex: 1 },
  // The card itself, around its row: no frame, no list marker.
  item: { listStyle: "none", minWidth: 0, position: "relative" },
  // A nested row, tabbed in by its depth inside its card, which a drag lifts whole from the list's
  // edge: its text is in the secondary colour (see `RowLink`).
  depth: (depth: number) => ({
    "--card-depth": `${depth * 1.5}rem`,
    paddingInlineStart: "var(--card-depth)",
  }),
  // The marks, after the text: small, and apart from it.
  marks: {
    "--card-marks-size": "0.85em",
    color: "var(--color-text-lavender)",
    fontSize: "var(--card-marks-size)",
    marginInlineStart: spacingVars["--spacing-2"],
  },
  // An icon takes the bullet's place in the gutter.
  iconed: { "::before": { content: "none" } },
  // The icon's box, in the gutter where the bullet would be: the same box as the bullet's.
  gutterIcon: {
    "--card-icon-height": "1.5rem",
    "--card-icon-inset": "0.125rem",
    "--card-icon-width": "1rem",
    alignItems: "center",
    display: "flex",
    height: "var(--card-icon-height)",
    insetBlockStart: "var(--card-icon-inset)",
    insetInlineStart: "var(--card-icon-inset)",
    justifyContent: "center",
    position: "absolute",
    width: "var(--card-icon-width)",
  },
  // The `…` button, over the end of the text where it shows (on hover, or selected): the text takes
  // the card's whole width, and the button hides what is under it with the card's own background.
  menu: {
    alignItems: "center",
    backgroundColor: colorVars["--color-background-body"],
    display: "flex",
    // The card's inner height, less the focus ring drawn just inside its border: the button never
    // covers the border or the ring.
    insetBlock: focusVars["--focus-outline-width"],
    insetInlineEnd: focusVars["--focus-outline-width"],
    opacity: "var(--menu-opacity, 1)",
    paddingInline: spacingVars["--spacing-1"],
    position: "absolute",
    // Over the stretched link, so a press on it reaches it.
    zIndex: 2,
  },
  menuOpen: { opacity: 1 },
  menuSelected: { backgroundColor: colorVars["--color-accent-muted"] },
  // A selected row shows its `…` button, over its tint and bar (`pickedStyles.picked`).
  selected: { "--menu-opacity": 1 },
  // A row in the move mode: a dashed frame all around it, in the accent, over the focus ring, as
  // a row picked up.
  moving: {
    boxShadow: "none",
    outlineColor: colorVars["--color-accent"],
    outlineOffset: `calc(-1 * ${focusVars["--focus-outline-width"]})`,
    outlineStyle: "dashed",
    outlineWidth: focusVars["--focus-outline-width"],
  },
  // The link's text, and the link stretched over the whole card by its pseudo-element.
  stretched: {
    "::after": { content: '""', inset: 0, position: "absolute" },
    color: "inherit",
    // No ring of its own around the text: the card's frame draws the focus ring, and a second one,
    // as wide as the text, showed as bars inside a selected card.
    outlineStyle: { ":focus-visible": "none", default: null },
    // A button's text is centred, a link's is not.
    textAlign: "start",
    textDecoration: "none",
  },
  text: { overflowWrap: "anywhere" },
  // A row that leads to another page, as a running line's feature or a line's draft: underlined, as
  // a link is, which `stretched` would take away.
  underlined: { textDecoration: "underline", textUnderlineOffset: "0.2em" },
  // A child line of the card: a bullet and its text, tabbed in from the card's own text.
  subline: {
    alignItems: "baseline",
    color: colorVars["--color-text-secondary"],
    display: "flex",
    gap: spacingVars["--spacing-2"],
    paddingInlineStart: spacingVars["--spacing-3"],
  },
  // A child line's text, taking the room its bullet leaves.
  sublineText: {
    flexBasis: "0%",
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    overflowWrap: "anywhere",
  },
});

/**
 * The card's text as the control stretched over it: a plain click opens it with `onOpen`. A list
 * that opens its cards itself draws a button, with no address: the browser shows an address at the
 * window's bottom for a link under the pointer or the focus, over the status line.
 */
function RowLink({
  onOpen,
  row,
}: {
  onOpen?: (row: WorkRow, isClick: boolean) => void;
  row: WorkRow;
}) {
  const link = (
    <Link
      // The normal text colour, not the link's accent; three lines at most, then an ellipsis, with
      // the whole text in a tooltip.
      color={
        row.isLinked ? "accent" : row.isAdd || row.depth !== undefined ? "secondary" : "primary"
      }
      hasUnderline={row.isLinked === true}
      {...(onOpen ? {} : { href: row.href })}
      maxLines={3}
      onClick={(event: MouseEvent<HTMLAnchorElement | HTMLButtonElement>) => {
        // A click that is a drag's end is already prevented, and a modified one is the browser's.
        const plain = !(event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0);
        if (onOpen && plain && !event.defaultPrevented) {
          event.preventDefault();
          // A click with the pointer counts one or more; Enter on the control, none.
          onOpen(row, event.detail > 0);
        }
      }}
      xstyle={[styles.stretched, styles.text, row.isLinked === true && styles.underlined]}
    >
      {row.label ?? row.text}
      {row.marks !== undefined && <span {...stylex.props(styles.marks)}>{row.marks}</span>}
    </Link>
  );
  // What the list's keys find the row's control by: `useListKeys`.
  return onOpen ? <span data-row-link="">{link}</span> : link;
}

/** What a row of a card, its own or a nested one, hears from the pointer, and opens with. */
type RowEvents = {
  /** The mouse moved over the row: the selection and the focus follow it. */
  onHover?: (row: WorkRow) => void;
  /** The mouse left the row. */
  onHoverEnd?: (row: WorkRow) => void;
  /** Opens the row on a plain click or Enter, in place of following its link. */
  onOpen?: (row: WorkRow, isClick: boolean) => void;
};

/** The pointer's handlers of a row: only a mouse, and only one that moved over it. */
function pointerOf(row: WorkRow, { onHover, onHoverEnd }: RowEvents) {
  return {
    onPointerLeave: (event: PointerEvent) => {
      if (event.pointerType === "mouse") {
        onHoverEnd?.(row);
      }
    },
    // A row scrolled under a still pointer takes nothing.
    onPointerMove: (event: PointerEvent) => {
      if (event.pointerType === "mouse" && (event.movementX !== 0 || event.movementY !== 0)) {
        onHover?.(row);
      }
    },
  };
}

/**
 * The bar under a row the list picked, while it is not edited: what it can do, with their keys.
 * None for a row that only opens, as a click opens it.
 */
function Bar({ isEditing, row }: { isEditing: boolean; row: WorkRow }) {
  const state = useContext(RowStateContext);
  const actions = state.barred === row.key && !isEditing ? (state.barOf?.(row) ?? []) : [];
  return actions.length > 1 ? <RowBar actions={actions} onAway={state.onBarAway} /> : null;
}

/** A card's child lines: each a bullet, indented under the text, in the smaller type, two lines at most. */
function Sublines({ lines }: { lines: ReadonlyArray<string> }) {
  return lines.map((line, at) => (
    <span key={at} {...stylex.props(styles.subline)}>
      <span aria-hidden="true">•</span>
      <Text color="secondary" maxLines={2} type="supporting" xstyle={styles.sublineText}>
        {line}
      </Text>
    </span>
  ));
}

/** The card's `…` menu, over the end of its text, told by the list whether it is open. */
function MenuSlot({ isSelected, row }: { isSelected: boolean; row: WorkRow }) {
  const state = useContext(RowStateContext);
  return (
    <span
      {...stylex.props(
        styles.menu,
        isSelected && styles.menuSelected,
        state.menu === row.key && styles.menuOpen,
      )}
    >
      <MenuStateContext
        value={{
          isOpen: state.menu === row.key,
          onOpenChange: (isOpen) => state.onMenu(row.key, isOpen),
        }}
      >
        {row.menu}
      </MenuStateContext>
    </span>
  );
}

/**
 * One row, a line's or a nested one, tabbed in by its depth. A row that moves is a sortable of its
 * section, dragged from anywhere, with reduced motion jumping to its place; a fixed one, such as a
 * running entry, is only drawn, and so is a nested row where the list does not nest (`canNest`).
 * `index` is its place among its section's rows, nested ones included.
 */
export function Card({
  canNest = false,
  index,
  isSelected,
  onHover,
  onHoverEnd,
  onOpen,
  row,
  section,
}: RowEvents & {
  canNest?: boolean;
  index: number;
  isSelected: boolean;
  row: WorkRow;
  section: string;
}) {
  const isReduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const state = useContext(RowStateContext);
  const isEditing = (state.editing === row.key || row.isFresh === true) && row.editor !== undefined;
  const events = { onHover, onHoverEnd, onOpen };
  const isStill = row.isFixed === true || (row.depth !== undefined && !canNest);
  const { handleRef, isDragging, ref } = useSortable({
    accept: "line",
    data: { text: row.text },
    // Nothing drags while a field is open: a press in it selects text, and a new row would count
    // as a row of the file.
    disabled: isStill || state.isTyping === true,
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
      ref={isStill ? undefined : ref}
      {...stylex.props(
        styles.item,
        row.depth !== undefined && styles.depth(row.depth),
        isDragging && styles.raised,
      )}
    >
      <div
        // What a drag tabs to the depth it would land at (see `useDragOrder`).
        data-row-frame=""
        {...pointerOf(row, events)}
        {...stylex.props(
          styles.frame,
          // The focus ring of the link, drawn on the row.
          pickedStyles.ringWithin,
          row.icon !== undefined && styles.iconed,
          isSelected && pickedStyles.picked,
          isSelected && styles.selected,
          state.moving === row.key && styles.moving,
          isDragging && styles.lifted,
        )}
      >
        {/* dnd-kit's accessibility attributes (a button role, a tab stop) go on its handle: an empty, hidden element, so the card stays a link and the sensor takes a press anywhere on it. */}
        {!isStill && <span aria-hidden="true" ref={handleRef} tabIndex={-1} />}
        {row.icon !== undefined && (
          <span aria-hidden="true" {...stylex.props(styles.gutterIcon)}>
            <Icon color="secondary" icon={row.icon} size="sm" />
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
        <Sublines lines={row.lines} />
        {/* A block of its own: under the text, as a note's row draws it, not beside it. */}
        {row.image !== undefined && <div>{row.image}</div>}
        <Bar isEditing={isEditing} row={row} />
        {/* After the link, so Tab from the card reaches it; over the link by its z-index. */}
        {row.menu !== undefined && <MenuSlot isSelected={isSelected} row={row} />}
      </div>
    </li>
  );
}
