// The list the priorities and the inbox share: sections as titled panes with their count in the
// border, their context under the title, and a card for each line (see `Card`). `columns` sets the
// panes in one row that scrolls sideways, each at least 400 px wide, and a pane titled "Blocked"
// under it; the phone, and `stack`, set them one under the other. A card drags from anywhere: past
// 5 px of a mouse press, or after half a second of a touch press. The keys move the selection, and
// Enter or a click opens the card in its overlay (see `useListKeys`).
import type { HeadingLevel } from "@astryxdesign/core/Heading";
import type { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { DragDropProvider, useDroppable } from "@dnd-kit/react";
import * as stylex from "@stylexjs/stylex";
import {
  type ComponentProps,
  type ReactNode,
  type Ref,
  useEffect,
  useRef,
  useState,
} from "react";
import { Pane, type PaneTint } from "../layout/Pane.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { Card, RowStateContext, type WorkRow } from "./Card.tsx";
import { Peek } from "./Peek.tsx";
import { type OnMove, useDragOrder } from "./useDragOrder.ts";
import { useItemMoves } from "./useItemMoves.ts";
import { type Columns, useListKeys } from "./useListKeys.ts";
import { useRefocus } from "./useRefocus.ts";
import { useRowKeys } from "./useRowKeys.ts";

/** A section's colour: the ongoing entries green, Now blue, Later grey, the rest neutral. */
export type Tone = "green" | "blue" | "neutral" | "gray";

export type { WorkRow };

/** A section of the list: a heading of the file, the ongoing entries, or a category of the inbox. */
export interface WorkSection {
  /** What goes under its pane, in its column: Home's Recent under the inbox. */
  below?: ReactNode;
  /** Its context, a line under its title. */
  context?: string;
  /** The count in its title, where it is not its rows': Home's inbox lists three of its nine. */
  count?: number;
  /** What ends it, like its Add row. */
  footer?: ReactNode;
  /** An icon before its title. */
  icon?: ComponentProps<typeof Icon>["icon"];
  id: string;
  /** Whether its rows stay where they are, and nothing is dropped in it, as the ongoing entries. */
  isFixed?: boolean;
  /** Its menu, in the top border at its end. */
  menu?: ReactNode;
  rows: ReadonlyArray<WorkRow>;
  title: string;
  /** What draws its title's words, as a title renamed in place: `title` still names it. */
  titleNode?: ReactNode;
  tone: Tone;
}

/** How the sections are arranged: panes in a row that scrolls, or one under the other. */
export type WorkLayout = "columns" | "stack";

/** How long the mouse rests on a row before its pane shows, and how long after it leaves it stays. */
const HOVER_MS = 600;
const LEAVE_MS = 150;

/** The title of the section that is drawn under the row of columns. */
const BELOW = "Blocked";

const styles = stylex.create({
  // The cards, a gap apart so each one's marks have room over its border.
  cards: {
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-1"],
    listStyle: "none",
    margin: 0,
    paddingBlock: spacingVars["--spacing-1"],
    paddingInline: 0,
  },
  // A column of the row: at least 400 px, growing to share the row's width; a row of more columns
  // than fit scrolls sideways, and brings the selection's column into view.
  column: {
    "--column-least": "400px",
    flexBasis: "var(--column-least)",
    flexGrow: 1,
    flexShrink: 0,
    minWidth: 0,
  },
  // A column of a list whose lines are long, as the priorities': at least 500 px.
  roomy: { "--column-least": "500px" },
  // The pane's side room, which its text, its rows, and its footer share: a bullet sits near the
  // border, as a list's does.
  snug: { "--pane-inset": spacingVars["--spacing-1"] },
  // The section's note, as the file writes it, `> [!NOTE]`: drawn as a callout, a blue bar at its
  // start on a surface of its own.
  context: {
    backgroundColor: colorVars["--color-background-surface"],
    borderInlineStartColor: colorVars["--color-text-blue"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: "3px",
    color: colorVars["--color-text-secondary"],
    marginBlockEnd: spacingVars["--spacing-1"],
    paddingBlock: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-2"],
  },
  footer: {
    paddingBlock: spacingVars["--spacing-1"],
    paddingInlineStart: spacingVars["--spacing-2"],
  },
  // The panes of the row, side by side, whose row scrolls sideways. It runs to both edges of the
  // page, past its inset, so a scrolled column is not cut off short of the sidebar or the window;
  // the inset is kept before the first one and after the last one.
  row: {
    alignItems: "flex-start",
    display: "flex",
    gap: spacingVars["--spacing-3"],
    marginInline: "var(--page-bleed, 0px)",
    overflowX: "auto",
    paddingBlockEnd: spacingVars["--spacing-2"],
    paddingInline: "var(--page-inset, 0px)",
  },
  // The panes one under the other.
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-1"],
  },
});

/** Each tone's title colour. */
const TINTS: Record<Tone, PaneTint | undefined> = {
  blue: "blue",
  gray: "gray",
  green: "green",
  neutral: undefined,
};

/** A section as a pane: its title and count, its context, its cards, and its footer. */
function SectionBody({
  isColumn,
  isRoomy,
  level,
  onHover,
  onHoverEnd,
  onOpen,
  ref,
  rows,
  section,
  selected,
}: {
  isColumn: boolean;
  isRoomy?: boolean;
  level?: HeadingLevel | undefined;
  onHover: (row: WorkRow) => void;
  onHoverEnd: (row: WorkRow) => void;
  onOpen: (row: WorkRow) => void;
  ref?: Ref<HTMLDivElement>;
  rows: ReadonlyArray<WorkRow>;
  section: WorkSection;
  selected?: string;
}) {
  return (
    <div
      // What the list brings into view, whole, when its selection is in it.
      data-column={isColumn ? "" : undefined}
      ref={ref}
      {...stylex.props(isColumn && styles.column, isColumn && isRoomy && styles.roomy)}
    >
      <Pane
        actions={section.menu}
        count={section.count ?? rows.filter((row) => !row.isAdd).length}
        {...(section.icon ? { icon: section.icon } : {})}
        {...(level ? { level } : {})}
        tint={TINTS[section.tone]}
        title={section.title}
        titleNode={section.titleNode}
        xstyle={[styles.snug]}
      >
        {section.context && (
          <Text color="secondary" display="block" xstyle={styles.context}>
            {section.context}
          </Text>
        )}
        {rows.length > 0 && (
          // The cards' list: Astryx's `List` draws only its own rows, not a card.
          <ul aria-label={`${section.title} lines`} {...stylex.props(styles.cards)}>
            {rows.map((row, index) => (
              <Card
                index={index}
                isSelected={row.key === selected}
                key={row.key}
                onHover={onHover}
                onHoverEnd={onHoverEnd}
                onOpen={onOpen}
                row={section.isFixed ? { ...row, isFixed: true } : row}
                section={section.id}
              />
            ))}
          </ul>
        )}
        {section.footer && <div {...stylex.props(styles.footer)}>{section.footer}</div>}
      </Pane>
      {section.below}
    </div>
  );
}

/** A section rows are dropped in, even when it is empty. */
function DropSection(props: {
  isColumn: boolean;
  isRoomy?: boolean;
  level?: HeadingLevel | undefined;
  onHover: (row: WorkRow) => void;
  onHoverEnd: (row: WorkRow) => void;
  onOpen: (row: WorkRow) => void;
  rows: ReadonlyArray<WorkRow>;
  section: WorkSection;
  selected?: string;
}) {
  const { ref } = useDroppable({
    accept: "line",
    id: props.section.id,
    type: "section",
    // The rows in it win over the section itself.
    collisionPriority: 1,
  });
  return <SectionBody ref={ref} {...props} />;
}

/** The columns of the keys: each section's rows as indexes into all the rows, without the empty. */
function columnsOf(sections: ReadonlyArray<ReadonlyArray<WorkRow>>): Columns {
  let start = 0;
  return sections
    .map((rows) => {
      const indexes = rows.map((_, at) => start + at);
      start += rows.length;
      return indexes;
    })
    .filter((indexes) => indexes.length > 0);
}

/**
 * The selection of the list: the key the address names, once it names one, and that card after the
 * address stops naming it, as the overlay closes. It moves with the keys and with a click.
 */
function useSelection(named: string | undefined, initial: string | undefined) {
  const [selected, setSelected] = useState(named ?? initial);
  const [seen, setSeen] = useState(named);
  if (named !== seen) {
    setSeen(named);
    if (named !== undefined) {
      setSelected(named);
    }
  }
  return [selected, setSelected] as const;
}

/**
 * What the list shows, in order: the `drag`'s sections with the rows as a drag left them (`rowsOf`),
 * the ones `inRow` and the ones `below` it, the rows of each in the order they show (`shown`), all
 * of them (`rows`), and each section's id and rows (`placed`), which the keys move along.
 */
function useShown(
  sections: ReadonlyArray<WorkSection>,
  layout: WorkLayout,
  onMove: OnMove | undefined,
) {
  // The rows that add are no lines: a drag knows none of them, and they stay at the section's end.
  const drag = useDragOrder(
    sections.map((section) => ({
      ...section,
      rows: section.rows.filter((row) => !row.isAdd),
    })),
    onMove,
  );
  const byKey = new Map(
    drag.sections.flatMap((section) => section.rows.map((row) => [row.key, row] as const)),
  );
  const addsOf = (section: WorkSection) =>
    sections.find((one) => one.id === section.id)?.rows.filter((row) => row.isAdd) ?? [];
  const rowsOf = (section: WorkSection) => [
    ...(section.isFixed
      ? section.rows
      : (drag.order[section.id] ?? []).flatMap((key) => byKey.get(key) ?? [])),
    ...addsOf(section),
  ];
  const isNarrowScreen = isNarrow(useWidthClass());
  const asColumns = layout === "columns" && !isNarrowScreen;
  const below = asColumns ? drag.sections.filter((section) => section.title === BELOW) : [];
  const inRow = drag.sections.filter((section) => !below.includes(section));
  const shown = [...inRow, ...below].map(rowsOf);
  const placed = [...inRow, ...below].map((section, at) => ({
    id: section.id,
    isFixed: section.isFixed,
    rows: shown[at],
  }));
  return { asColumns, below, drag, inRow, placed, rows: shown.flat(), rowsOf, shown };
}

/** How long the row of columns takes to glide sideways to the selection's column. */
const GLIDE_MS = 200;

/**
 * Glides `scroller` sideways from `glide.rest`, where it rested, to where it is now, over
 * `GLIDE_MS`, easing out; at once for a human who asked for less motion. A scroll by anything else,
 * a wheel or a drag, ends the glide.
 */
function glideAcross(scroller: HTMLElement, glide: { frame: number; rest: number }) {
  const from = glide.rest;
  const to = scroller.scrollLeft;
  cancelAnimationFrame(glide.frame);
  glide.frame = 0;
  if (to === from || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    glide.rest = to;
    return;
  }
  scroller.scrollLeft = from;
  const start = performance.now();
  const tick = (now: number) => {
    // Moved by something else since the last frame: it takes over.
    if (Math.abs(scroller.scrollLeft - glide.rest) > 2) {
      glide.frame = 0;
      glide.rest = scroller.scrollLeft;
      return;
    }
    const done = Math.min((now - start) / GLIDE_MS, 1);
    scroller.scrollLeft = from + (to - from) * (1 - (1 - done) ** 3);
    glide.rest = scroller.scrollLeft;
    glide.frame = done < 1 ? requestAnimationFrame(tick) : 0;
  };
  glide.frame = requestAnimationFrame(tick);
}

/**
 * The sections as panes, in the `layout`'s arrangement. `selected` is the key of the row the
 * address names, an open overlay's: the selection starts there and stays on it once the overlay
 * closes, with the focus. With `isFocused`, the keyboard's focus is put on it, with its ring.
 * `onOpen` opens a card, from a click or Enter, with its link's address. `onAddBeside(section, row)`
 * is what `o` calls for the selected row, where the list adds in a place; a row's `editor` is what
 * `i` shows in its place, and its `menu` is what `m` opens. A drop calls `onMove` with
 * the row's key, its section, and its index among that section's rows on screen; until it
 * resolves, the list stays as the drag left it.
 */
export function WorkList({
  initial,
  isFocused = false,
  isRoomy = false,
  layout = "stack",
  level,
  onAddBeside,
  onDelete,
  onMove,
  onOpen,
  onPromote,
  sections,
  selected: named,
}: {
  /** The key of the row selected until another is, where the address names none. */
  initial?: string;
  isFocused?: boolean;
  /** The columns start at 500 px, not 400: for lines that run long, as the priorities'. */
  isRoomy?: boolean;
  layout?: WorkLayout;
  /** The level of its panes' titles, where the page's headings put them. */
  level?: HeadingLevel;
  onAddBeside?: (section: string, row: WorkRow) => void;
  /** What `d` calls for the selected row, once the human confirmed: it deletes the line. */
  onDelete?: (row: WorkRow) => void;
  onMove?: OnMove;
  onOpen?: (href: string) => void;
  /** What `p` calls for the selected row; returning `false` says it has nothing to promote. */
  onPromote?: (row: WorkRow) => boolean | void;
  sections: ReadonlyArray<WorkSection>;
  selected?: string;
}) {
  const [selected, setSelected] = useSelection(named, initial);
  const { asColumns, below, drag, inRow, placed, rows, rowsOf, shown } = useShown(
    sections,
    layout,
    onMove,
  );
  const isOpen = named !== undefined;
  // Whether the pane of the selected row shows: Enter on a row that peeks, and it follows the
  // selection, as the keys and the mouse move it, until Escape or Enter again.
  const [isPeeking, setPeeking] = useState(false);
  const peeked = isPeeking ? rows.find((row) => row.key === selected) : undefined;
  // The pane of the row the mouse rests on: it goes when the mouse leaves, or the selection moves.
  const [hoverKey, setHoverKey] = useState<string>();
  const dwelling = useRef<ReturnType<typeof setTimeout>>(undefined);
  const leaving = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (hoverKey !== undefined && hoverKey !== selected) {
      setHoverKey(undefined);
    }
  }, [hoverKey, selected]);
  useEffect(
    () => () => {
      clearTimeout(dwelling.current);
      clearTimeout(leaving.current);
    },
    [],
  );
  const hovered = hoverKey === undefined ? undefined : rows.find((row) => row.key === hoverKey);
  const own = useRowKeys(placed, onAddBeside, setSelected, {
    canMoveItems: onMove !== undefined,
    onDelete,
    onPromote,
  });
  const onMoveItem = useItemMoves(onMove, placed, setSelected);
  // The selection's column comes into view whole, any part of it outside the window moves the page
  // or the row: a key that changes column may land beyond the edge. The row glides there sideways
  // from where it rested, which the focus moved to the new column has already jumped from.
  const sideways = useRef({ frame: 0, rest: 0 });
  useEffect(() => {
    const glide = sideways.current;
    if (!asColumns || selected === undefined) {
      glide.rest = 0;
      return;
    }
    const row = document.querySelector(`[data-row-key="${CSS.escape(selected)}"]`);
    const scroller = row?.closest<HTMLElement>("[data-list-page]");
    row?.closest("[data-column]")?.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (scroller) {
      glideAcross(scroller, glide);
    }
  }, [asColumns, selected]);
  const { focusSelected, ref } = useListKeys({
    columns: asColumns ? columnsOf(shown) : undefined,
    // Enter opens the focused card's link; the overlay, once open, has its own Escape.
    escapeLabel: isOpen || peeked ? "close" : null,
    isOff: isOpen,
    keys: rows.map((row) => row.key),
    onClose: () => {
      if (!peeked) {
        return false;
      }
      setPeeking(false);
      return true;
    },
    onEdit: () => false,
    onMoveItem,
    onSelect: (index) => setSelected(rows[index].key),
    rowKeys: own.keys,
    selected: rows.findIndex((row) => row.key === selected),
  });
  useRefocus({
    focusSelected,
    held: own.held,
    isFocused,
    named,
    onRefocused: own.onRefocused,
    renamed: own.renamed,
    selected,
  });
  const open = (row: WorkRow) => {
    setSelected(row.key);
    if (row.peek) {
      // Enter again, on the row whose pane shows, closes it.
      setPeeking(!(isPeeking && selected === row.key));
      return;
    }
    onOpen?.(row.href);
  };
  // The mouse moving over a card selects it and takes the focus to it, so the keys act on what the
  // pointer is on. Not while a card is edited or its menu is open, nor during a drag.
  const hover = (row: WorkRow) => {
    clearTimeout(leaving.current);
    const isBusy =
      own.state.editing !== undefined ||
      own.state.menu !== undefined ||
      document.querySelector("[data-dragging], [data-dnd-dragging]") !== null;
    // A pointer that rests on a row that peeks brings up its pane after `HOVER_MS`; one that moves
    // starts the wait again.
    if (row.peek && !isBusy && hoverKey !== row.key) {
      clearTimeout(dwelling.current);
      dwelling.current = setTimeout(() => setHoverKey(row.key), HOVER_MS);
    }
    if (row.key === selected || isBusy) {
      return;
    }
    setSelected(row.key);
    document
      .querySelector<HTMLElement>(
        `[data-row-key="${CSS.escape(row.key)}"] :is([data-row-link] button, a[href])`,
      )
      ?.focus({ preventScroll: true });
  };
  /** The pointer left a row, or the pane: the pane goes soon after, unless it is on the other. */
  const unhover = () => {
    clearTimeout(dwelling.current);
    clearTimeout(leaving.current);
    leaving.current = setTimeout(() => setHoverKey(undefined), LEAVE_MS);
  };
  const drawn = (section: WorkSection, isColumn: boolean) => {
    const Body = section.isFixed ? SectionBody : DropSection;
    return (
      <Body
        isColumn={isColumn}
        isRoomy={isRoomy}
        key={section.id}
        level={level}
        onHover={hover}
        onHoverEnd={unhover}
        onOpen={open}
        rows={rowsOf(section)}
        section={section}
        selected={selected}
      />
    );
  };
  return (
    <RowStateContext value={own.state}>
      <div ref={ref}>
        <DragDropProvider {...drag.provider}>
          {/* The row scrolls sideways: a region the keyboard can scroll, which its panes' links reach. */}
          <div
            aria-label={asColumns ? "Columns" : undefined}
            // A click in the room under a short column focuses this region: the list's keys still
            // act there, as on the page itself (see `useListKeys`).
            data-list-page={asColumns ? "" : undefined}
            // A wheel, a drag, or a jump with no glide: where the row rests now.
            onScroll={(event) => {
              if (sideways.current.frame === 0) {
                sideways.current.rest = event.currentTarget.scrollLeft;
              }
            }}
            role={asColumns ? "region" : undefined}
            tabIndex={asColumns ? 0 : undefined}
            {...stylex.props(asColumns ? styles.row : styles.stack)}
          >
            {inRow.map((section) => drawn(section, asColumns))}
          </div>
          {below.map((section) => drawn(section, false))}
        </DragDropProvider>
        {(peeked ?? hovered) && (
          <Peek
            onPointerEnter={() => clearTimeout(leaving.current)}
            onPointerLeave={unhover}
            row={(peeked ?? hovered)!}
          />
        )}
      </div>
    </RowStateContext>
  );
}
