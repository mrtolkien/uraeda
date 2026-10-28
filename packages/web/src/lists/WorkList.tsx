// The list the priorities and the inbox share: sections as titled panes with their count in the
// border, their context under the title, and a card for each line (see `Card`). `columns` sets the
// panes in one row that scrolls sideways, each at least 400 px wide, and a pane titled "Blocked"
// under it; the phone, and `stack`, set them one under the other. A card drags from anywhere: past
// 5 px of a mouse press, or after half a second of a touch press, its nested rows with it. The keys
// move the selection through every row, nested ones included, and Enter or a click edits a row in
// place, or opens it in its overlay (see `useListKeys`).
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
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Pane, type PaneTint } from "../layout/Pane.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { Card, RowStateContext, type WorkRow } from "./Card.tsx";
import { type OnDrop, type OnMove, useDragOrder } from "./useDragOrder.ts";
import { withMoves } from "./itemMoves.ts";
import { type Ahead, stillAhead, useItemMoves } from "./useItemMoves.ts";
import { type Columns, type ItemMove, useListKeys } from "./useListKeys.ts";
import { useRefocus } from "./useRefocus.ts";
import type { BarAction } from "./RowBar.tsx";
import { type RowAction, type SectionPicker, useRowKeys } from "./useRowKeys.ts";

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

/** An edit of a row's place in its outline, from the keys: Tab, Shift+Tab, and a nested row's moves. */
export type OutlineMove = "indent" | "outdent" | "up" | "down";

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
  // than fit scrolls sideways, and brings the selection's column into view. Never wider than the
  // row shows: on the phone, a column is the screen's width.
  column: {
    "--column-least": "400px",
    flexBasis: "min(var(--column-least), 100%)",
    flexGrow: 1,
    flexShrink: 0,
    minWidth: 0,
  },
  // A column of a list whose lines are long, as the priorities': at least 500 px.
  roomy: { "--column-least": "500px" },
  // The table of a list whose lines are long, centred in the page: 80 characters a line at most, the
  // measure of prose, with room for the bullet and the pane's sides. Its panes read its width (see
  // `wide`).
  roomyStack: {
    containerName: "list",
    containerType: "inline-size",
    marginInline: "auto",
    maxWidth: "calc(80ch + 4rem)",
    width: "100%",
  },
  // The pane's side room, which its text, its rows, and its footer share: a bullet sits near the
  // border, as a list's does.
  snug: { "--pane-inset": spacingVars["--spacing-1"] },
  // A table's pane past 600 px has room to spare: the pane's own side room.
  wide: {
    "--pane-inset": {
      "@container list (min-width: 600px)": spacingVars["--spacing-3"],
      default: spacingVars["--spacing-1"],
    },
  },
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
  // the inset is kept before the first one and after the last one, and beside the column it
  // brings into view. A column scrolled past an edge fades out in the inset, not cut short there.
  row: {
    alignItems: "flex-start",
    display: "flex",
    gap: spacingVars["--spacing-3"],
    marginInline: "var(--page-bleed, 0px)",
    maskImage:
      "linear-gradient(to right, transparent, black var(--page-inset, 0px), black calc(100% - var(--page-inset, 0px)), transparent)",
    overflowX: "auto",
    paddingBlockEnd: spacingVars["--spacing-2"],
    paddingInline: "var(--page-inset, 0px)",
    scrollPaddingInline: "var(--page-inset, 0px)",
  },
  // On the phone, room under an outline's last row for the bar floating at the screen's bottom,
  // which a row scrolls clear of.
  underBar: { paddingBlockEnd: "6rem" },
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
  canNest,
  isColumn,
  isRoomy,
  level,
  onHover,
  onOpen,
  ref,
  rows,
  section,
  selected,
}: {
  /** Its nested rows drag on their own, as its lines do. */
  canNest: boolean;
  isColumn: boolean;
  isRoomy?: boolean;
  level?: HeadingLevel | undefined;
  onHover: (row: WorkRow) => void;
  onOpen: (row: WorkRow, isClick: boolean) => void;
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
      // The pane's side room, which it inherits: Astryx's `xstyle` takes no custom property.
      {...stylex.props(
        isColumn && styles.column,
        isColumn && isRoomy && styles.roomy,
        isColumn || !isRoomy ? styles.snug : styles.wide,
      )}
    >
      <Pane
        actions={section.menu}
        count={
          section.count ??
          rows.filter((row) => !row.isAdd && !row.isFresh && row.depth === undefined).length
        }
        {...(section.icon ? { icon: section.icon } : {})}
        {...(level ? { level } : {})}
        tint={TINTS[section.tone]}
        title={section.title}
        titleNode={section.titleNode}
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
                canNest={canNest}
                index={index}
                isSelected={row.key === selected}
                key={row.key}
                onHover={onHover}
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
  canNest: boolean;
  isColumn: boolean;
  isRoomy?: boolean;
  level?: HeadingLevel | undefined;
  onHover: (row: WorkRow) => void;
  onOpen: (row: WorkRow, isClick: boolean) => void;
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

/**
 * The columns of the keys: each section's rows, nested ones included, as indexes into all the rows,
 * without the empty.
 */
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
  { canNest, onDrop }: { canNest: boolean; onDrop: OnDrop | undefined },
  ahead: ReadonlyArray<Ahead>,
  isLayoutChosen: boolean,
) {
  // The rows that add are no lines: a drag knows none of them, and they stay at the section's end.
  // A drag reorders every row, a line's nested rows after it, each a row of its own.
  const drag = useDragOrder(
    sections.map((section) => ({
      ...section,
      rows: withNested(section.rows.filter((row) => !row.isAdd)),
    })),
    onDrop,
    canNest,
  );
  // A row a drop placed at another depth, under another line, shows there until the file has it.
  const byKey = new Map(
    drag.sections.flatMap((section) =>
      section.rows.map((row) => {
        const placed = drag.placed.get(row.key);
        if (placed === undefined) {
          return [row.key, row] as const;
        }
        const { depth: _, parent: __, ...rest } = row;
        return [
          row.key,
          {
            ...rest,
            ...(placed.depth === 0 ? {} : { depth: placed.depth }),
            ...(placed.parent === undefined ? {} : { parent: placed.parent }),
          },
        ] as const;
      }),
    ),
  );
  const addsOf = (section: WorkSection) =>
    sections.find((one) => one.id === section.id)?.rows.filter((row) => row.isAdd) ?? [];
  const isNarrowScreen = isNarrow(useWidthClass());
  // The phone stacks the columns, unless the human chose them.
  const asColumns = layout === "columns" && (isLayoutChosen || !isNarrowScreen);
  const below = asColumns ? drag.sections.filter((section) => section.title === BELOW) : [];
  const inRow = drag.sections.filter((section) => !below.includes(section));
  const rowsIn = (order: Record<string, ReadonlyArray<string>>) => (section: WorkSection) => [
    ...(section.isFixed
      ? section.rows
      : (order[section.id] ?? []).flatMap((key) => byKey.get(key) ?? [])),
    ...addsOf(section),
  ];
  // The keys go through every row, a line's nested rows after it.
  const placedIn = (rowsOf: (section: WorkSection) => ReadonlyArray<WorkRow>) =>
    [...inRow, ...below].map((section) => ({
      id: section.id,
      isFixed: section.isFixed,
      rows: rowsOf(section),
    }));
  // The file's order, then the moves the keys made ahead of their writes.
  const live = placedIn(rowsIn(drag.order));
  const moves = stillAhead(ahead, live);
  const rowsOf = rowsIn(moves.length > 0 ? withMoves(drag.order, live, moves) : drag.order);
  const shown = [...inRow, ...below].map(rowsOf);
  const placed = placedIn(rowsOf);
  return {
    asColumns,
    below,
    drag,
    inRow,
    live,
    placed,
    rows: shown.flat(),
    rowsOf,
    shown,
  };
}

/** Rows, each followed by its nested rows: the order the keys go through them. */
function withNested(rows: ReadonlyArray<WorkRow>) {
  return rows.flatMap((row) => [row, ...(row.children ?? [])]);
}

/** The rows a nested row at `at` of `rows`, a line's nested rows, is under, nearest first. */
function ancestorsOf(rows: ReadonlyArray<WorkRow>, at: number) {
  const found: Array<WorkRow> = [];
  let depth = rows[at]?.depth ?? 0;
  for (let index = at - 1; index >= 0 && depth > 1; index -= 1) {
    const row = rows[index];
    if ((row.depth ?? 0) < depth) {
      found.push(row);
      depth = row.depth ?? 0;
    }
  }
  return found;
}

/** The rows nested under `row` among `rows`, in order: none for a row that has none. */
function nestedUnder(rows: ReadonlyArray<WorkRow>, row: WorkRow) {
  const at = rows.indexOf(row);
  const depth = row.depth ?? 0;
  const after = rows.slice(at + 1);
  const end = after.findIndex(
    (other) => other.parent !== (row.parent ?? row.key) || (other.depth ?? 0) <= depth,
  );
  return end === -1 ? after : after.slice(0, end);
}

/** How long the row of columns takes to glide sideways to the selection's column. */
const GLIDE_MS = 200;

/** The glide of a row that changed place: as a key moved it, or a row before it went. */
const SHIFT = { duration: 200, easing: "cubic-bezier(0.25, 1, 0.5, 1)" };

/** Where each row of a list was, by key, in the list's own content, and the glides that run. */
type Shifts = {
  places: Map<string, { x: number; y: number }>;
  running: WeakMap<Element, Animation>;
};

/**
 * Reads where each row of `root` is now, and with `isMoving`, glides each that changed place from
 * where it was. A row gliding starts again from where it shows; without `isMoving`, it glides on,
 * and its place is read where it lands.
 */
function shiftRows(root: HTMLElement, shifts: Shifts, isMoving: boolean) {
  const origin = root.getBoundingClientRect();
  const left = root.querySelector("[data-list-page]")?.scrollLeft ?? 0;
  const next = new Map<string, { x: number; y: number }>();
  for (const row of root.querySelectorAll<HTMLElement>("[data-row-key]")) {
    const key = row.dataset.rowKey ?? "";
    const placeOf = (box: DOMRect) => ({ x: box.left - origin.left + left, y: box.top - origin.top });
    const running = shifts.running.get(row);
    const isGliding = running?.playState === "running";
    if (!isMoving && isGliding) {
      next.set(key, shifts.places.get(key) ?? placeOf(row.getBoundingClientRect()));
      continue;
    }
    const seen = isGliding ? placeOf(row.getBoundingClientRect()) : undefined;
    // A glide toward the same place runs on: where the row lands is where it shows, its glide aside.
    if (seen) {
      const [x = 0, y = 0] = getComputedStyle(row).translate.split(" ").map(parseFloat);
      const lands = shifts.places.get(key);
      if (lands && Math.abs(seen.x - x - lands.x) < 1 && Math.abs(seen.y - y - lands.y) < 1) {
        next.set(key, lands);
        continue;
      }
    }
    running?.cancel();
    const at = placeOf(row.getBoundingClientRect());
    next.set(key, at);
    const before = seen ?? shifts.places.get(key);
    if (!isMoving || !before) {
      continue;
    }
    const dx = before.x - at.x;
    const dy = before.y - at.y;
    if (Math.abs(dx) >= 1 || Math.abs(dy) >= 1) {
      shifts.running.set(row, row.animate({ translate: [`${dx}px ${dy}px`, "0 0"] }, SHIFT));
    }
  }
  shifts.places = next;
}

/**
 * Glides each row of `list` that changed place since the last render from where it was, as a drag
 * does: dnd-kit animates only during one. Where it was is read in the list's own content, so the
 * page's scroll and the columns' are no move. Nothing glides while `isStill`, during a drag and as
 * it ends, nor as `layout` changes or the list resizes, nor for a human who asked for less motion.
 */
function useRowShifts(list: RefObject<HTMLElement | null>, isStill: boolean, layout: string) {
  const shifts = useRef<Shifts>({ places: new Map(), running: new WeakMap() });
  const last = useRef({ isStill, layout });
  useLayoutEffect(() => {
    const isMoving =
      !isStill &&
      !last.current.isStill &&
      last.current.layout === layout &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    last.current = { isStill, layout };
    if (list.current) {
      shiftRows(list.current, shifts.current, isMoving);
    }
  });
  // A resize moves every row with no render: their places are read again, still.
  useLayoutEffect(() => {
    const root = list.current;
    if (!root) {
      return undefined;
    }
    const observer = new ResizeObserver(() => shiftRows(root, shifts.current, false));
    observer.observe(root);
    return () => observer.disconnect();
  }, [list]);
}

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
 * Moves the row of columns, scrolled to bring `column` into view from `rest`, to whole columns: the
 * first one it shows starts at the row's inset. Brought in from the end, `column` is the last whole
 * one, the most that fit with it shown; from the start, the first. Columns wider than the row show
 * one at a time.
 */
function alignColumns(scroller: HTMLElement, column: HTMLElement, rest: number) {
  if (scroller.scrollLeft === rest) {
    return;
  }
  const inset = Number.parseFloat(getComputedStyle(scroller).scrollPaddingInlineStart) || 0;
  const view = scroller.clientWidth - 2 * inset;
  const origin = scroller.getBoundingClientRect().left - scroller.scrollLeft;
  const columns = [...scroller.querySelectorAll<HTMLElement>("[data-column]")];
  const spans = columns.map((one) => {
    const box = one.getBoundingClientRect();
    return { left: box.left - origin, right: box.right - origin };
  });
  const at = columns.indexOf(column);
  const target = spans[at];
  if (!target) {
    return;
  }
  const first =
    scroller.scrollLeft > rest
      ? (spans.slice(0, at).find((span) => target.right - span.left <= view) ?? target)
      : target;
  scroller.scrollLeft = first.left - inset;
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
  isLayoutChosen = false,
  isRoomy = false,
  layout = "stack",
  level,
  follow,
  onAddBeside,
  onDelete,
  onMove,
  onNest,
  onOpen,
  onOutline,
  onPromote,
  onStart,
  rowActions,
  sectionPicker,
  sections,
  selected: named,
}: {
  /** A row to select, with the focus, as a write placed it: each new object selects it again. */
  follow?: { key: string };
  /** The key of the row selected until another is, where the address names none. */
  initial?: string;
  isFocused?: boolean;
  /** `layout` is the human's choice: kept at every width, the phone's too. */
  isLayoutChosen?: boolean;
  /**
   * For lines that run long, as the priorities': the columns start at 500 px, not 400, and the
   * table is centred, 80 characters a line at most, its panes roomier inside past 600 px.
   */
  isRoomy?: boolean;
  layout?: WorkLayout;
  /** The level of its panes' titles, where the page's headings put them. */
  level?: HeadingLevel;
  /** What `o` calls for the selected row, and `O` with `isAbove`. */
  onAddBeside?: (section: string, row: WorkRow, isAbove?: boolean) => void;
  /**
   * What `d` calls for the selected row, once the human confirmed: it deletes the line, and may
   * resolve with `false` when the write is refused, for the row to come back.
   */
  onDelete?: (row: WorkRow) => Promise<boolean | void> | void;
  onMove?: OnMove;
  /**
   * A drop that nests a row, moves a nested row, or makes one a line: the list then drags every
   * row, nested ones too, to the depth it is dragged to sideways.
   */
  onNest?: OnDrop;
  onOpen?: (href: string) => void;
  /**
   * An edit of the outline of the selected row: Tab indents it, Shift+Tab outdents it, and the keys
   * that move a nested row move it up or down among its siblings.
   */
  onOutline?: (row: WorkRow, edit: OutlineMove) => void;
  /** What `p` calls for the selected row; returning `false` says it has nothing to promote. */
  onPromote?: (row: WorkRow) => boolean | void;
  /** What `s` calls for the selected row: it starts from it. */
  onStart?: (row: WorkRow) => void;
  /** The list's own keys on the selected row, in its bar, as the inbox's `p` and `v`. */
  rowActions?: ReadonlyArray<RowAction>;
  /**
   * A key that opens a picker of the sections for the selected line, as the inbox's `c`: `open` is
   * given the row and what moves it to the end of the section chosen, by its id, as a key's move.
   */
  sectionPicker?: Omit<SectionPicker, "open"> & {
    open: (row: WorkRow, moveTo: (section: string) => void) => void;
  };
  sections: ReadonlyArray<WorkSection>;
  selected?: string;
}) {
  const [selected, setSelected] = useSelection(named, initial);
  const isPhone = isNarrow(useWidthClass());
  // The row whose bar shows: the one the keys, a click, or a write picked, while it is selected. The
  // mouse passing over a row selects it with no bar, which would push the rows under it as it goes.
  const [barred, setBarred] = useState<string>();
  const pick = useCallback(
    (key: string) => {
      setSelected(key);
      setBarred(key);
    },
    [setSelected],
  );
  // The moves the keys made, and the rows `d` deleted, that show before their writes do.
  const [ahead, setAhead] = useState<ReadonlyArray<Ahead>>([]);
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  // A row deleted goes with its nested rows: they follow it in its line's rows.
  const without = (rows: ReadonlyArray<WorkRow>) =>
    rows.filter(
      (row, at) =>
        !gone.has(row.key) && !ancestorsOf(rows, at).some((above) => gone.has(above.key)),
    );
  const kept =
    gone.size === 0
      ? sections
      : sections.map((section) => ({
          ...section,
          rows: section.rows
            .filter((row) => !gone.has(row.key))
            .map((row) =>
              row.children === undefined ? row : { ...row, children: without(row.children) },
            ),
        }));
  // A drop that leaves a line a line moves it; any other nests a row, or takes it out.
  const lines = new Set(kept.flatMap((section) => section.rows.map((row) => row.key)));
  const onDrop: OnDrop | undefined =
    onMove || onNest
      ? (key, to) =>
          to.depth === 0 && lines.has(key)
            ? onMove?.(key, to.section, to.index)
            : onNest?.(key, to)
      : undefined;
  const { asColumns, below, drag, inRow, live, placed, rows, rowsOf, shown } = useShown(
    kept,
    layout,
    { canNest: onNest !== undefined, onDrop },
    ahead,
    isLayoutChosen,
  );
  // A row deleted ahead stops being hidden once the file no longer has it.
  useLayoutEffect(() => {
    const all = new Set(
      sections.flatMap((section) => withNested(section.rows).map((row) => row.key)),
    );
    if ([...gone].some((key) => !all.has(key))) {
      setGone(new Set([...gone].filter((key) => all.has(key))));
    }
  }, [gone, sections]);
  /**
   * `d`, confirmed: the row goes at once, and the selection to the row after it, or before it; it
   * comes back if the write is refused.
   */
  const deleteAhead =
    onDelete &&
    ((row: WorkRow) => {
      const section = placed.find((one) => one.rows.some((other) => other.key === row.key));
      const lines = section?.rows.filter((other) => !other.isAdd) ?? [];
      const at = lines.findIndex((other) => other.key === row.key);
      // The row after it and its nested rows, which go with it, or else the one before it.
      const after = at + 1 + nestedUnder(lines, lines[at]).length;
      const next = lines[after] ?? lines[at - 1] ?? section?.rows.find((other) => other.isAdd);
      setGone((before) => new Set([...before, row.key]));
      if (next) {
        pick(next.key);
        // With the focus, once drawn: the question gave it back to the row that went.
        requestAnimationFrame(() =>
          document
            .querySelector<HTMLElement>(
              `[data-row-key="${CSS.escape(next.key)}"] :is([data-row-link] button, a[href])`,
            )
            ?.focus({ preventScroll: true }),
        );
      }
      // Written, the file no longer has it; refused, it comes back. Either way it is hidden no more:
      // a row that took its key since is another row.
      void Promise.resolve(onDelete(row)).then((isDeleted) => {
        if (isDeleted !== undefined) {
          setGone((before) => new Set([...before].filter((key) => key !== row.key)));
        }
      });
    });
  const isOpen = named !== undefined;
  // The row `m` put in the move mode, while it stays selected: the keys move it until it ends.
  const [moving, setMoving] = useState<string>();
  // What a picker's choice moves, as the list is when it is made.
  const moves = useRef<{ onMoveItem?: (move: ItemMove, at: number) => void; rows: WorkRow[] }>({
    rows: [],
  });
  const own = useRowKeys(placed, onAddBeside, pick, {
    onDelete: deleteAhead,
    onMoveMode:
      onMove &&
      ((row) => {
        pick(row.key);
        setMoving(row.key);
      }),
    // The bar's `⏎ open`, as Enter or a click opens the row.
    onOpen: onOpen && ((row) => open(row)),
    onOutline,
    onPickSection: sectionPicker && {
      ...sectionPicker,
      open: (row) =>
        sectionPicker.open(row, (section) => {
          const { onMoveItem: move, rows: now } = moves.current;
          const at = now.findIndex((one) => one.key === row.key);
          if (at !== -1) {
            move?.(`to:${section}`, at);
          }
        }),
    },
    onPromote,
    onStart,
    ...(rowActions ? { rowActions } : {}),
  });
  const onMoveLine = useItemMoves(onMove, placed, pick, { live, setAhead });
  // A nested row moves among its siblings, up or down, in its line's outline; a line, as a drop
  // would move it.
  const onMoveItem =
    onMoveLine &&
    ((move: ItemMove, at: number) => {
      const row = rows[at];
      if (row?.parent === undefined) {
        onMoveLine(move, at);
      } else if (move === "up" || move === "down") {
        onOutline?.(row, move);
      }
    });
  moves.current = { onMoveItem, rows };
  // A row a write placed elsewhere, as an indent did, is selected again where it went, with the
  // focus, once it is drawn there.
  // Not while a field is open, edited or new: the focus is the human's there.
  const isTyping = own.state.editing !== undefined || rows.some((row) => row.isFresh);
  const typing = useRef(isTyping);
  typing.current = isTyping;
  // The move mode ends as another row is selected, or a field opens.
  const isMoving = moving !== undefined && moving === selected && !isTyping && !!onMoveItem;
  if (moving !== undefined && !isMoving) {
    setMoving(undefined);
  }
  useEffect(() => {
    if (follow === undefined || typing.current) {
      return;
    }
    pick(follow.key);
    requestAnimationFrame(() =>
      document
        .querySelector<HTMLElement>(
          `[data-row-key="${CSS.escape(follow.key)}"] :is([data-row-link] button, a[href])`,
        )
        ?.focus({ preventScroll: true }),
    );
  }, [follow, pick]);
  // The selection's column comes into view whole, any part of it outside the window moves the page
  // or the row: a key that changes column may land beyond the edge. The row glides there sideways
  // from where it rested, which the focus moved to the new column has already jumped from.
  const sideways = useRef({ frame: 0, rest: 0 });
  useLayoutEffect(() => {
    const glide = sideways.current;
    if (!asColumns || selected === undefined) {
      glide.rest = 0;
      return;
    }
    const row = document.querySelector(`[data-row-key="${CSS.escape(selected)}"]`);
    const scroller = row?.closest<HTMLElement>("[data-list-page]");
    const column = row?.closest<HTMLElement>("[data-column]");
    column?.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (scroller && column) {
      alignColumns(scroller, column, glide.rest);
      glideAcross(scroller, glide);
    }
  }, [asColumns, selected]);
  const { focusSelected, ref } = useListKeys({
    columns: asColumns ? columnsOf(shown) : undefined,
    // Enter opens the focused card's link; the overlay, once open, has its own Escape.
    escapeLabel: isOpen ? "close" : null,
    isOff: isOpen,
    keys: rows.map((row) => row.key),
    onClose: () => false,
    onEdit: () => false,
    ...(isMoving ? { onMoveEnd: () => setMoving(undefined) } : {}),
    onMoveItem,
    onSelect: (index) => pick(rows[index].key),
    rowKeys: own.keys,
    selected: rows.findIndex((row) => row.key === selected),
  });
  useRowShifts(ref, drag.isDragging, asColumns ? "columns" : "stack");
  useRefocus({
    focusSelected,
    held: own.held,
    isFocused,
    named,
    onRefocused: own.onRefocused,
    renamed: own.renamed,
    selected,
  });
  // Enter or a click: a row edited in place opens its field, any other its page.
  const open = (row: WorkRow) => {
    pick(row.key);
    if (row.editsInPlace && own.edit(row.key)) {
      return;
    }
    onOpen?.(row.href);
  };
  /**
   * A click on a row that can do more than open shows its bar first, and a click on it with its bar
   * shown opens it, as a double click does: the mouse reaches its actions before its field. Enter,
   * and a click on an Add row or a row that only opens, open it at once.
   */
  const clickOpen = (row: WorkRow, isClick: boolean) => {
    const isBarShown = !isTyping && barred === row.key && selected === row.key;
    if (isClick && !row.isAdd && !isBarShown && own.barOf(row).length > 1) {
      pick(row.key);
      return;
    }
    open(row);
  };
  // The mouse moving over a card selects it and takes the focus to it, so the keys act on what the
  // pointer is on. Not while a card is edited or its menu is open, nor during a drag.
  const hover = (row: WorkRow) => {
    const isBusy =
      own.state.editing !== undefined ||
      own.state.menu !== undefined ||
      rows.some((one) => one.isFresh) ||
      document.querySelector("[data-dragging], [data-dnd-dragging]") !== null;
    if (row.key === selected || isBusy) {
      return;
    }
    setSelected(row.key);
    setBarred(undefined);
    document
      .querySelector<HTMLElement>(
        `[data-row-key="${CSS.escape(row.key)}"] :is([data-row-link] button, a[href])`,
      )
      ?.focus({ preventScroll: true });
  };
  /**
   * The bar of the row in the move mode: its keys, which move it, and the one that ends it. A press
   * on one moves it too. In columns, the sideways keys go to the next column; one under the other,
   * to the next section.
   */
  const moveBarOf = (row: WorkRow): ReadonlyArray<BarAction> => {
    const step = (move: ItemMove) => () => {
      const at = rows.findIndex((one) => one.key === row.key);
      if (at !== -1) {
        onMoveItem?.(move, at);
      }
    };
    const across = asColumns ? "column" : "section";
    return [
      { keys: "k", label: "up", run: step("up") },
      { keys: "j", label: "down", run: step("down") },
      ...(row.parent === undefined
        ? [
            { keys: "h", label: `previous ${across}`, run: step("left") },
            { keys: "l", label: `next ${across}`, run: step("right") },
          ]
        : []),
      { keys: "⏎", label: "done", run: () => setMoving(undefined) },
    ];
  };
  const drawn = (section: WorkSection, isColumn: boolean) => {
    const Body = section.isFixed ? SectionBody : DropSection;
    return (
      <Body
        canNest={onNest !== undefined}
        isColumn={isColumn}
        isRoomy={isRoomy}
        key={section.id}
        level={level}
        onHover={hover}
        onOpen={clickOpen}
        rows={rowsOf(section)}
        section={section}
        selected={selected}
      />
    );
  };
  return (
    // While a field is open, its own bar is the only one.
    <RowStateContext
      value={{
        ...own.state,
        barOf: (row) => (isMoving && row.key === moving ? moveBarOf(row) : own.barOf(row)),
        moving: isMoving ? moving : undefined,
        // Only under the row selected: the address may have selected another since.
        barred: isTyping || barred !== selected ? undefined : barred,
        isTyping,
        onBarAway: () => setBarred(undefined),
      }}
    >
      <div ref={ref} {...stylex.props(isPhone && onOutline !== undefined && styles.underBar)}>
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
            {...stylex.props(
              asColumns ? styles.row : styles.stack,
              !asColumns && isRoomy && styles.roomyStack,
            )}
          >
            {inRow.map((section) => drawn(section, asColumns))}
          </div>
          {below.map((section) => drawn(section, false))}
        </DragDropProvider>
      </div>
    </RowStateContext>
  );
}
