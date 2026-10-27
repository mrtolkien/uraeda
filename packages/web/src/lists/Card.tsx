// A line of the priorities or the inbox as a row of a list: a bullet and its text, three lines at
// most, its marks before the text, and its sub-lines under it, with no frame of its own. The whole
// row is one control, stretched over it, and drags from anywhere past 5 px of a mouse press, or
// after half a second of a touch press (see `SENSORS`). The `…` button shows over its end.
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
  type ReactNode,
  useContext,
} from "react";

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
  /** A row that adds a line, "Add to Next": Enter on it opens the form. It is no line: never counted, dragged, or moved. */
  isAdd?: boolean;
  /** An icon in the place of its bullet, as a draft's file or a running entry's work. */
  icon?: ComponentProps<typeof Icon>["icon"];
  /** Its text is a link to a file, as a line's draft is: drawn as a hyperlink. */
  isLinked?: boolean;
  /** Its marks, as small text after its own. */
  marks?: ReactNode;
  /** Enter shows its whole content in a pane beside it, in place of following `href`. */
  peek?: boolean;
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
  // The row: a line of the list as a bullet and its text, with no frame of its own. A raw element,
  // as the plan's Complexity tracking says.
  frame: {
    // The bullet, in the gutter before the text: in a box of the icons' size, centred as they are,
    // so that bullets and icons line up in one column, on the middle of the first line.
    "::before": {
      alignItems: "center",
      color: colorVars["--color-text-secondary"],
      content: '"•"',
      display: "flex",
      height: "1.5rem",
      insetBlockStart: "0.125rem",
      insetInlineStart: "0.125rem",
      justifyContent: "center",
      position: "absolute",
      width: "1rem",
    },
    // The `…` button's opacity, which `CardMenu` reads: shown under the pointer, on keyboard focus
    // within the card, and always when the pointer cannot hover, a touch screen.
    "--menu-opacity": {
      ":has(:focus-visible)": 1,
      ":hover": 1,
      "@media (hover: none)": 1,
      default: 0,
    },
    // The focus ring of the link, drawn on the row, from the pseudo-class alone: a default of the
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
    // offset it. The whole row is tappable: on a touch screen as tall as a control, the theme's
    // 44 px; with a mouse only as tall as its text.
    cursor: "pointer",
    minHeight: { "@media (hover: none)": sizeVars["--size-element-sm"], default: null },
    minWidth: 0,
    paddingBlock: "0.125rem",
    paddingInlineEnd: spacingVars["--spacing-2"],
    // The gutter: a 1 rem bullet or icon at the row's edge, and a little room before the text.
    paddingInlineStart: "1.5rem",
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
  // The marks, after the text: small, and apart from it.
  marks: {
    color: "var(--color-text-lavender)",
    fontSize: "0.85em",
    marginInlineStart: spacingVars["--spacing-2"],
  },
  // An icon takes the bullet's place in the gutter.
  iconed: { "::before": { content: "none" } },
  gutterIcon: {
    alignItems: "center",
    display: "flex",
    height: "1.5rem",
    insetBlockStart: "0.125rem",
    insetInlineStart: "0.125rem",
    justifyContent: "center",
    position: "absolute",
    width: "1rem",
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
  // The mauve tint of a selected row, apart from the pane's own background, with a bar at its start.
  selected: {
    "--menu-opacity": 1,
    backgroundColor: colorVars["--color-accent-muted"],
    boxShadow: `inset 2px 0 0 0 ${colorVars["--color-accent"]}`,
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
      color={row.isAdd ? "secondary" : row.isLinked ? "accent" : "primary"}
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
      xstyle={[styles.stretched, styles.text]}
    >
      {row.label ?? row.text}
      {row.marks !== undefined && <span {...stylex.props(styles.marks)}>{row.marks}</span>}
    </Link>
  );
  // What the list's keys find the row's control by: `useListKeys`.
  return onOpen ? <span data-row-link="">{link}</span> : link;
}

/**
 * One card. A card that moves is a sortable of its section, dragged from anywhere, with reduced
 * motion jumping to its place; a fixed one, such as a running entry, is only drawn. `index` is its
 * place among its section's cards.
 */
export function Card({
  index,
  isSelected,
  onHover,
  onHoverEnd,
  onOpen,
  row,
  section,
}: {
  index: number;
  isSelected: boolean;
  /** The mouse left the card. */
  onHoverEnd?: (row: WorkRow) => void;
  /** The mouse moved over the card: the selection and the focus follow it. */
  onHover?: (row: WorkRow) => void;
  /** Opens the card on a plain click or Enter, in place of following its link. */
  onOpen?: (row: WorkRow, isClick: boolean) => void;
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
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") {
          onHoverEnd?.(row);
        }
      }}
      // Only a mouse that moved: a card scrolled under a still pointer takes nothing.
      onPointerMove={(event) => {
        if (event.pointerType === "mouse" && (event.movementX !== 0 || event.movementY !== 0)) {
          onHover?.(row);
        }
      }}
      ref={row.isFixed ? undefined : ref}
      {...stylex.props(
        styles.frame,
        row.icon !== undefined && styles.iconed,
        isSelected && styles.selected,
        isDragging && styles.lifted,
      )}
    >
      {/* dnd-kit's accessibility attributes (a button role, a tab stop) go on its handle: an empty, hidden element, so the card stays a link and the sensor takes a press anywhere on it. */}
      {!row.isFixed && <span aria-hidden="true" ref={handleRef} tabIndex={-1} />}
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
      )}
    </li>
  );
}
