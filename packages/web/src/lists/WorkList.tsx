// The list the priorities and the inbox share: sections as titled panes with their count in the
// border, their context under the title, and a card for each line (see `Card`). `columns` sets the
// panes in one row that scrolls sideways, each at least 400 px wide, and a pane titled "Blocked"
// under it; the phone, and `stack`, set them one under the other. A card drags from anywhere: past
// 5 px of a mouse press, or after half a second of a touch press. The keys move the selection, and
// Enter or a click opens the card in its overlay (see `useListKeys`).
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { DragDropProvider, useDroppable } from "@dnd-kit/react";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, type Ref, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Pane, type PaneTint } from "../layout/Pane.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { Card, RowStateContext, type WorkRow } from "./Card.tsx";
import { type OnMove, useDragOrder } from "./useDragOrder.ts";
import { isLayerOpen } from "../keys/layers.ts";
import { itemTarget, type Placed } from "./itemMoves.ts";
import { type Columns, type ItemMove, useListKeys } from "./useListKeys.ts";
import { useRowKeys } from "./useRowKeys.ts";

/** A section's colour: the ongoing entries green, Now blue, Later grey, the rest neutral. */
export type Tone = "green" | "blue" | "neutral" | "gray";

export type { WorkRow };

/** A section of the list: a heading of the file, the ongoing entries, or a category of the inbox. */
export interface WorkSection {
  /** Its context, a line under its title. */
  context?: string;
  /** What ends it, like its Add row. */
  footer?: ReactNode;
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

/** The title of the section that is drawn under the row of columns. */
const BELOW = "Blocked";

const styles = stylex.create({
  // The cards, a gap apart so each one's marks have room over its border.
  cards: {
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-3"],
    listStyle: "none",
    margin: 0,
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: 0,
  },
  // A column of the row: at least 400 px, growing to share the row's width.
  column: {
    "--column-least": "400px",
    flexBasis: "var(--column-least)",
    flexGrow: 1,
    flexShrink: 0,
    minWidth: 0,
  },
  context: {
    color: colorVars["--color-text-secondary"],
    paddingBlockEnd: spacingVars["--spacing-1"],
  },
  footer: {
    paddingBlock: spacingVars["--spacing-1"],
    paddingInlineStart: spacingVars["--spacing-2"],
  },
  // The panes of the row, side by side, whose row scrolls sideways.
  row: {
    alignItems: "flex-start",
    display: "flex",
    gap: spacingVars["--spacing-3"],
    overflowX: "auto",
    paddingBlockEnd: spacingVars["--spacing-2"],
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
  onOpen,
  ref,
  rows,
  section,
  selected,
}: {
  isColumn: boolean;
  onOpen: (row: WorkRow) => void;
  ref?: Ref<HTMLDivElement>;
  rows: ReadonlyArray<WorkRow>;
  section: WorkSection;
  selected?: string;
}) {
  return (
    <div ref={ref} {...stylex.props(isColumn && styles.column)}>
      <Pane
        actions={section.menu}
        count={rows.length}
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
                index={index}
                isSelected={row.key === selected}
                key={row.key}
                onOpen={onOpen}
                row={section.isFixed ? { ...row, isFixed: true } : row}
                section={section.id}
              />
            ))}
          </ul>
        )}
        {section.footer && <div {...stylex.props(styles.footer)}>{section.footer}</div>}
      </Pane>
    </div>
  );
}

/** A section rows are dropped in, even when it is empty. */
function DropSection(props: {
  isColumn: boolean;
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
function useSelection(named: string | undefined) {
  const [selected, setSelected] = useState(named);
  const [seen, setSeen] = useState(named);
  if (named !== seen) {
    setSeen(named);
    if (named !== undefined) {
      setSelected(named);
    }
  }
  return [selected, setSelected] as const;
}

/** How long a move waits for the list to show it before the next key's move goes on (R30). */
const SETTLE_MS = 2000;

/** The order the rows show in, as text: what a written move changes. */
const orderOfSections = (sections: ReadonlyArray<Placed>) =>
  JSON.stringify(sections.map((section) => [section.id, section.rows.map((row) => row.key)]));

/**
 * What the keys that move an item do: the move a drop would ask `onMove` for, one at a time. A key
 * pressed while an earlier move is being written waits for it, and for the list to show it, and
 * its target is read from the list as that move left it, so a held `J` goes down one place at a
 * time; a move the list never shows (refused, or a no-op) holds the keys after it for `SETTLE_MS`
 * at most. A move whose write fails is dropped, and the ones after it still run. `sections` are
 * those on screen, in order, and the moved row is selected. Absent where the list has no
 * `onMove`: its items cannot move.
 */
function useItemMoves(
  onMove: OnMove | undefined,
  sections: ReadonlyArray<Placed>,
  select: (key: string) => void,
) {
  const latest = useRef({ onMove, order: orderOfSections(sections), sections });
  const shown = useRef<Array<() => void>>([]);
  useLayoutEffect(() => {
    const order = orderOfSections(sections);
    const isChanged = order !== latest.current.order;
    latest.current = { onMove, order, sections };
    if (isChanged) {
      shown.current.splice(0).forEach((resolve) => resolve());
    }
  });
  const waiting = useRef<Array<() => Promise<void>>>([]);
  const isWriting = useRef(false);
  if (onMove === undefined) {
    return undefined;
  }
  const run = async (key: string, move: ItemMove) => {
    const { onMove: write, order, sections: now } = latest.current;
    const target = itemTarget(now, key, move);
    if (target === undefined) {
      return;
    }
    select(key);
    await write?.(key, target.section, target.index);
    await new Promise<void>((resolve) => {
      if (latest.current.order !== order) {
        resolve();
        return;
      }
      shown.current.push(resolve);
      setTimeout(resolve, SETTLE_MS);
    });
  };
  const drain = async () => {
    if (isWriting.current) {
      return;
    }
    isWriting.current = true;
    try {
      for (let next = waiting.current.shift(); next; next = waiting.current.shift()) {
        // A refused write is the caller's to show (see `onMoveRefused`): here it only ends the move.
        await next().catch(() => undefined);
      }
    } finally {
      isWriting.current = false;
    }
  };
  return (move: ItemMove, row: number) => {
    const key = sections.flatMap((section) => section.rows)[row]?.key;
    if (key !== undefined) {
      waiting.current.push(() => run(key, move));
      void drain();
    }
  };
}

/**
 * Puts the keyboard's focus on the selected card: at the start with `isFocused`, and once the overlay
 * of a card closed (`named` turns undefined), which leaves the page a moment after, so the focus
 * waits for the layer rule to say it left. The same once the editor or the menu a key opened on a
 * card closed (`held` turns undefined).
 */
function useRefocus({
  focusSelected,
  held,
  isFocused,
  named,
  selected,
}: {
  focusSelected: () => void;
  held: string | undefined;
  isFocused: boolean;
  named: string | undefined;
  selected: string | undefined;
}) {
  const wasNamed = useRef(named !== undefined);
  const wasHeld = useRef(held !== undefined);
  useEffect(() => {
    // The overlay closed: the card it showed is selected, and has the focus once the overlay's
    // layer, which leaves the page a moment after, no longer holds it.
    const closed =
      (wasNamed.current && named === undefined) || (wasHeld.current && held === undefined);
    wasNamed.current = named !== undefined;
    wasHeld.current = held !== undefined;
    if (!((isFocused && selected !== undefined) || closed)) {
      return undefined;
    }
    let frame = 0;
    const focus = () => {
      if (isLayerOpen()) {
        frame = requestAnimationFrame(focus);
      } else {
        focusSelected();
      }
    };
    focus();
    return () => cancelAnimationFrame(frame);
  }, [held, isFocused, named, selected, focusSelected]);
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
  isFocused = false,
  layout = "stack",
  onAddBeside,
  onMove,
  onOpen,
  sections,
  selected: named,
}: {
  isFocused?: boolean;
  layout?: WorkLayout;
  onAddBeside?: (section: string, row: WorkRow) => void;
  onMove?: OnMove;
  onOpen?: (href: string) => void;
  sections: ReadonlyArray<WorkSection>;
  selected?: string;
}) {
  const [selected, setSelected] = useSelection(named);
  const drag = useDragOrder(sections, onMove);
  const byKey = new Map(
    drag.sections.flatMap((section) => section.rows.map((row) => [row.key, row] as const)),
  );
  const rowsOf = (section: WorkSection) =>
    section.isFixed
      ? section.rows
      : (drag.order[section.id] ?? []).flatMap((key) => byKey.get(key) ?? []);
  const isNarrowScreen = isNarrow(useWidthClass());
  const asColumns = layout === "columns" && !isNarrowScreen;
  const below = asColumns ? drag.sections.filter((section) => section.title === BELOW) : [];
  const inRow = drag.sections.filter((section) => !below.includes(section));
  // The rows in the order they show, which the keys move along, and the indexes each column holds.
  const shown = [...inRow, ...below].map(rowsOf);
  const rows = shown.flat();
  const isOpen = named !== undefined;
  const placed = [...inRow, ...below].map((section, at) => ({ id: section.id, rows: shown[at] }));
  const own = useRowKeys(placed, onAddBeside, setSelected);
  const onMoveItem = useItemMoves(
    onMove,
    [...inRow, ...below].map((section, at) => ({
      id: section.id,
      isFixed: section.isFixed,
      rows: shown[at],
    })),
    setSelected,
  );
  const { focusSelected, ref } = useListKeys({
    columns: asColumns ? columnsOf(shown) : undefined,
    // Enter opens the focused card's link; the overlay, once open, has its own Escape.
    escapeLabel: isOpen ? "close" : null,
    isOff: isOpen,
    onClose: () => false,
    onEdit: () => false,
    onMoveItem,
    onSelect: (index) => setSelected(rows[index].key),
    rowKeys: own.keys,
    selected: rows.findIndex((row) => row.key === selected),
  });
  useRefocus({ focusSelected, held: own.held, isFocused, named, selected });
  const open = (row: WorkRow) => {
    setSelected(row.key);
    onOpen?.(row.href);
  };
  const drawn = (section: WorkSection, isColumn: boolean) => {
    const Body = section.isFixed ? SectionBody : DropSection;
    return (
      <Body
        isColumn={isColumn}
        key={section.id}
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
            role={asColumns ? "region" : undefined}
            tabIndex={asColumns ? 0 : undefined}
            {...stylex.props(asColumns ? styles.row : styles.stack)}
          >
            {inRow.map((section) => drawn(section, asColumns))}
          </div>
          {below.map((section) => drawn(section, false))}
        </DragDropProvider>
      </div>
    </RowStateContext>
  );
}
