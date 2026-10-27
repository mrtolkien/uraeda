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
import { type ComponentProps, type ReactNode, type Ref, useState } from "react";
import { Pane, type PaneTint } from "../layout/Pane.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { Card, RowStateContext, type WorkRow } from "./Card.tsx";
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
  level,
  onOpen,
  ref,
  rows,
  section,
  selected,
}: {
  isColumn: boolean;
  level?: HeadingLevel | undefined;
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
        count={section.count ?? rows.length}
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
  level?: HeadingLevel | undefined;
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
  const shown = [...inRow, ...below].map(rowsOf);
  const placed = [...inRow, ...below].map((section, at) => ({
    id: section.id,
    isFixed: section.isFixed,
    rows: shown[at],
  }));
  return { asColumns, below, drag, inRow, placed, rows: shown.flat(), rowsOf, shown };
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
  level,
  onAddBeside,
  onMove,
  onOpen,
  sections,
  selected: named,
}: {
  isFocused?: boolean;
  layout?: WorkLayout;
  /** The level of its panes' titles, where the page's headings put them. */
  level?: HeadingLevel;
  onAddBeside?: (section: string, row: WorkRow) => void;
  onMove?: OnMove;
  onOpen?: (href: string) => void;
  sections: ReadonlyArray<WorkSection>;
  selected?: string;
}) {
  const [selected, setSelected] = useSelection(named);
  const { asColumns, below, drag, inRow, placed, rows, rowsOf, shown } = useShown(
    sections,
    layout,
    onMove,
  );
  const isOpen = named !== undefined;
  const own = useRowKeys(placed, onAddBeside, setSelected);
  const onMoveItem = useItemMoves(onMove, placed, setSelected);
  const { focusSelected, ref } = useListKeys({
    columns: asColumns ? columnsOf(shown) : undefined,
    // Enter opens the focused card's link; the overlay, once open, has its own Escape.
    escapeLabel: isOpen ? "close" : null,
    isOff: isOpen,
    keys: rows.map((row) => row.key),
    onClose: () => false,
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
    onOpen?.(row.href);
  };
  const drawn = (section: WorkSection, isColumn: boolean) => {
    const Body = section.isFixed ? SectionBody : DropSection;
    return (
      <Body
        isColumn={isColumn}
        key={section.id}
        level={level}
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
