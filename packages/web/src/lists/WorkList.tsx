// The list the priorities and the inbox share: sections as titled panes with their count in the
// border, their context under the title, and a card for each line (see `Card`). `columns` sets the
// panes in one row that scrolls sideways, each at least 400 px wide, and a pane titled "Blocked"
// under it; the phone, and `stack`, set them one under the other. A card drags from anywhere: past
// 5 px of a mouse press, or after half a second of a touch press, its nested rows with it. The keys
// move the selection through every row, nested ones included, and Enter or a click edits a row in
// place, or opens it in its overlay (see `useListKeys`).
import { DragDropProvider } from "@dnd-kit/react";
import * as stylex from "@stylexjs/stylex";
import { listVars } from "./list.stylex.ts";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { type ReactNode, type UIEvent, useState } from "react";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { RowStateContext, type WorkRow } from "./Card.tsx";
import { useColumnGlide } from "./columnGlide.ts";
import { deleteAheadOf, useGone } from "./deleteAhead.ts";
import { moveBarOf, rowPointer } from "./rowPointer.ts";
import { DropSection, SectionBody } from "./SectionBody.tsx";
import type { OnDrop } from "./useDragOrder.ts";
import type { Ahead } from "./useItemMoves.ts";
import { useFollow, useListSelection } from "./useListSelection.ts";
import { useRowCommands } from "./useRowCommands.ts";
import { useShown } from "./useShown.ts";
import { useWorkListKeys } from "./useWorkListKeys.ts";
import type { WorkListProps, WorkSection } from "./workSection.ts";

export type { WorkRow };
export type { Tone, WorkLayout, WorkSection } from "./workSection.ts";

const styles = stylex.create({
  // The table of a list whose lines are long, centred in the page: 80 characters a line at most, the
  // measure of prose, with room for the bullet and the pane's sides. Its panes read its width (see
  // `wide` in `SectionBody`).
  roomyStack: {
    containerName: "list",
    containerType: "inline-size",
    marginInline: "auto",
    // A page of rows' text column, its rows' markers and the selection inside its panes.
    maxWidth: "var(--size-reading-pane)",
    width: "100%",
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
  underBar: { paddingBlockEnd: listVars["--list-bar-room"] },
  // The panes one under the other.
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-1"],
  },
});

/** A drop that leaves a line a line moves it; any other nests a row, or takes it out. */
function dropOf(
  sections: ReadonlyArray<WorkSection>,
  { onMove, onNest }: Pick<WorkListProps, "onMove" | "onNest">,
): OnDrop | undefined {
  const lines = new Set(sections.flatMap((section) => section.rows.map((row) => row.key)));
  return onMove || onNest
    ? (key, to) =>
        to.depth === 0 && lines.has(key) ? onMove?.(key, to.section, to.index) : onNest?.(key, to)
    : undefined;
}

/**
 * A section of the list as a pane, `Body`: one rows are dropped in, unless its rows stay where they
 * are.
 */
function ListSection(props: Omit<Parameters<typeof SectionBody>[0], "ref">) {
  const Body = props.section.isFixed ? SectionBody : DropSection;
  return <Body {...props} />;
}

/**
 * The panes, `drawn`: the ones `inRow`, in the row of columns or one under the other, and the ones
 * `below` it.
 */
function Panes({
  asColumns,
  below,
  drawn,
  inRow,
  isRoomy,
  onScroll,
}: {
  asColumns: boolean;
  below: ReadonlyArray<WorkSection>;
  drawn: (section: WorkSection, isColumn: boolean) => ReactNode;
  inRow: ReadonlyArray<WorkSection>;
  isRoomy: boolean;
  onScroll: (event: UIEvent<HTMLElement>) => void;
}) {
  return (
    <>
      {/* The row scrolls sideways: a region the keyboard can scroll, which its panes' links reach. */}
      <div
        aria-label={asColumns ? "Columns" : undefined}
        // A click in the room under a short column focuses this region: the list's keys still
        // act there, as on the page itself (see `useListKeys`).
        data-list-page={asColumns ? "" : undefined}
        onScroll={onScroll}
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
    </>
  );
}

/**
 * The sections as panes, in the `layout`'s arrangement. `selected` is the key of the row the
 * address names, an open overlay's: the selection starts there and stays on it once the overlay
 * closes, with the focus. With `isFocused`, the keyboard's focus is put on it, with its ring.
 * `onOpen` opens a card, from a click or Enter, with its link's address. `onAddBeside(section, row)`
 * is what `o` calls for the selected row, where the list adds in a place; a row's `editor` is what
 * `i` shows in its place, and `m` puts it in the move mode, where the list moves its items. A drop
 * calls `onMove` with the row's key, its section, and its index among that section's rows on
 * screen; until it resolves, the list stays as the drag left it.
 */
export function WorkList(props: WorkListProps) {
  const { isFocused = false, isRoomy = false, layout = "stack", onNest, sections } = props;
  const named = props.selected;
  const { barred, pick, selected, setBarred, setSelected } = useListSelection({
    clear: props.clear,
    initial: props.initial,
    named,
    onSelected: props.onSelected,
  });
  const isPhone = isNarrow(useWidthClass());
  // The moves the keys made, and the rows `d` deleted, that show before their writes do.
  const [ahead, setAhead] = useState<ReadonlyArray<Ahead>>([]);
  const { kept, setGone } = useGone(sections);
  const { asColumns, below, drag, inRow, live, placed, rows, rowsOf, shown } = useShown(
    kept,
    layout,
    { canNest: onNest !== undefined, onDrop: dropOf(kept, props) },
    ahead,
    props.isLayoutChosen ?? false,
  );
  const deleteAhead = props.onDelete && deleteAheadOf(props.onDelete, placed, pick, setGone);
  const commands = useRowCommands(props, {
    deleteAhead,
    live,
    pick,
    placed,
    rows,
    selected,
    setAhead,
  });
  const { isMoving, isTyping, moving, onMoveItem, own, setMoving } = commands;
  useFollow(props.follow, isTyping, pick);
  const onScroll = useColumnGlide(asColumns, selected);
  const ref = useWorkListKeys({
    ...commands,
    asColumns,
    isDragging: drag.isDragging,
    isFocused,
    named,
    onEdge: props.onEdge,
    pick,
    placed,
    rows,
    selected,
    shown,
  });
  const { clickOpen, hover } = rowPointer({
    barOf: own.barOf,
    barred,
    isHeld: own.state.editing !== undefined,
    isTyping,
    open: commands.open,
    pick,
    rows,
    selected,
    setBarred,
    setSelected,
  });
  const pane = { canNest: onNest !== undefined, isRoomy, level: props.level, selected };
  const drawn = (section: WorkSection, isColumn: boolean) => (
    <ListSection
      {...pane}
      isColumn={isColumn}
      key={section.id}
      onHover={hover}
      onOpen={clickOpen}
      rows={rowsOf(section)}
      section={section}
    />
  );
  return (
    // While a field is open, its own bar is the only one.
    <RowStateContext
      value={{
        ...own.state,
        barOf: (row) =>
          isMoving && row.key === moving
            ? moveBarOf(row, rows, { asColumns, onDone: () => setMoving(undefined), onMoveItem })
            : own.barOf(row),
        // Only under the row selected: the address may have selected another since.
        barred: isTyping || barred !== selected ? undefined : barred,
        isTyping,
        moving: isMoving ? moving : undefined,
        onBarAway: () => setBarred(undefined),
      }}
    >
      <div ref={ref} {...stylex.props(isPhone && props.onOutline !== undefined && styles.underBar)}>
        <DragDropProvider {...drag.provider}>
          <Panes {...{ asColumns, below, drawn, inRow, isRoomy, onScroll }} />
        </DragDropProvider>
      </div>
    </RowStateContext>
  );
}
