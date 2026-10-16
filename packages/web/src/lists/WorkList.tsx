// The list the priorities and the inbox share: sections under a coloured heading with their count,
// on wide screens a thin edge of the same colour, and compact rows with the drag handle on the
// left, their text, their children as grey lines, and their marks on the right. Each row is one
// link; its handle, a press of half a second on a touch screen, or the keyboard moves it.
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { Heading } from "@astryxdesign/core/Heading";
import { useMediaQuery } from "@astryxdesign/core/hooks";
import { List, ListItem } from "@astryxdesign/core/List";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import {
  colorVars,
  focusVars,
  shadowVars,
  sizeVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import { DragDropProvider, useDroppable } from "@dnd-kit/react";
import { useSortable } from "@dnd-kit/react/sortable";
import * as stylex from "@stylexjs/stylex";
import { Fragment, type ReactNode, type Ref, useEffect, useRef } from "react";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { type OnMove, useDragOrder } from "./useDragOrder.ts";

/**
 * A section's colour: the ongoing entries green, Now blue, Next and the inbox's categories
 * neutral, Later grey, Blocked orange.
 */
export type Tone = "green" | "blue" | "neutral" | "gray" | "orange";

/** A row of the list. */
export interface WorkRow {
  /** Where a tap on the row leads. */
  href: string;
  /** Whether it stays where it is: a running entry, with no handle, which moving would not move. */
  isFixed?: boolean;
  key: string;
  /** Its text as drawn, with its formatting. */
  label?: ReactNode;
  /** Its children, each a grey line under its text. */
  lines: ReadonlyArray<string>;
  /** Its marks, on the right. */
  marks?: ReactNode;
  /** Its text, plain: the handle's label, and the row's label when `label` is absent. */
  text: string;
}

/** A section of the list: a heading of the file, the ongoing entries, or a category of the inbox. */
export interface WorkSection {
  /** What ends it, like its Add row. */
  footer?: ReactNode;
  id: string;
  /** Whether its rows stay where they are, and nothing is dropped in it, as the ongoing entries. */
  isFixed?: boolean;
  rows: ReadonlyArray<WorkRow>;
  title: string;
  tone: Tone;
}

const styles = stylex.create({
  below: {
    display: "block",
    paddingBlockStart: spacingVars["--spacing-0-5"],
  },
  count: {
    color: colorVars["--color-text-secondary"],
    fontWeight: "normal",
  },
  edge: {
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: spacingVars["--spacing-1"],
    paddingInlineStart: spacingVars["--spacing-3"],
  },
  fixed: {
    // The place of the handle, so a running entry's text lines up with the others'.
    alignItems: "center",
    display: "flex",
    height: sizeVars["--size-element-sm"],
    justifyContent: "center",
    width: sizeVars["--size-element-sm"],
  },
  footer: {
    paddingBlock: spacingVars["--spacing-1"],
    paddingInlineStart: spacingVars["--spacing-2"],
  },
  lifted: {
    // A row lifts while it is dragged.
    backgroundColor: colorVars["--color-background-card"],
    boxShadow: shadowVars["--shadow-med"],
    position: "relative",
    zIndex: 1,
  },
  line: {
    // Astryx's focus ring of the row, drawn inside it: the list clips its rows' sides. Only the
    // offset is the app's, a value of its own, so no rule of Astryx's is written again unlayered.
    outlineOffset: {
      ":has(:focus-visible)": `calc(-1 * ${focusVars["--focus-outline-width"]})`,
      default: null,
    },
    // The long press on a phone does not open the link's menu.
    userSelect: "none",
    // oxlint-disable-next-line stylex/valid-styles -- WebKit's own property, missing from StyleX's list: a long press that starts a drag must not open the link's menu
    WebkitTouchCallout: "none",
  },
  section: {
    paddingBlock: spacingVars["--spacing-1"],
  },
});

/** Each tone's heading and edge, from Astryx's colour tokens. */
const tones = stylex.create({
  blue: {
    borderInlineStartColor: colorVars["--color-border-blue"],
    color: colorVars["--color-text-blue"],
  },
  gray: {
    borderInlineStartColor: colorVars["--color-border-gray"],
    color: colorVars["--color-text-secondary"],
  },
  green: {
    borderInlineStartColor: colorVars["--color-border-green"],
    color: colorVars["--color-text-green"],
  },
  neutral: {
    borderInlineStartColor: colorVars["--color-border-emphasized"],
    color: colorVars["--color-text-primary"],
  },
  orange: {
    borderInlineStartColor: colorVars["--color-border-orange"],
    color: colorVars["--color-text-orange"],
  },
});

/** How a row is drawn: its item, with its handle when it moves. */
function RowItem({
  handleRef,
  isDragging = false,
  isSelected,
  ref,
  row,
}: {
  handleRef?: Ref<HTMLButtonElement>;
  isDragging?: boolean;
  isSelected: boolean;
  ref?: Ref<HTMLLIElement>;
  row: WorkRow;
}) {
  // On a phone, the marks go under the text, which keeps the width of the screen.
  const isNarrow = useWidthClass() === "narrow";
  const hasMarksBelow = isNarrow && row.marks !== undefined;
  return (
    <ListItem
      description={
        row.lines.length > 0 || hasMarksBelow ? (
          <>
            {row.lines.map((line, index) => (
              <Text color="secondary" display="block" key={index}>
                {line}
              </Text>
            ))}
            {hasMarksBelow && <span {...stylex.props(styles.below)}>{row.marks}</span>}
          </>
        ) : undefined
      }
      endContent={isNarrow ? undefined : row.marks}
      href={row.href}
      isSelected={isSelected}
      // A node, not a string, so a long line wraps instead of being cut.
      label={<>{row.label ?? row.text}</>}
      ref={ref}
      startContent={
        handleRef === undefined ? (
          // The dot repeats the row's "Running" mark: screen readers hear the mark alone.
          <span aria-hidden="true" {...stylex.props(styles.fixed)}>
            <StatusDot label="Running" variant="success" />
          </span>
        ) : (
          <Button
            icon={<span aria-hidden="true">⠿</span>}
            isIconOnly
            label={`Move ${row.text}`}
            ref={handleRef}
            size="sm"
            variant="ghost"
          />
        )
      }
      xstyle={[styles.line, isDragging && styles.lifted]}
    />
  );
}

/** A row that moves: dragged by its handle, or held on a touch screen. */
function SortableRow({
  index,
  isSelected,
  row,
  section,
}: {
  index: number;
  isSelected: boolean;
  row: WorkRow;
  section: string;
}) {
  const isReduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { handleRef, isDragging, ref } = useSortable({
    accept: "line",
    data: { text: row.text },
    group: section,
    id: row.key,
    index,
    type: "line",
    // With reduced motion, the rows jump to their places instead of sliding.
    transition: isReduced ? null : undefined,
  });
  return (
    <RowItem
      handleRef={handleRef}
      isDragging={isDragging}
      isSelected={isSelected}
      ref={ref}
      row={row}
    />
  );
}

/** A section's heading, rows, and footer, in its colour. */
function SectionBody({
  ref,
  rows,
  section,
  selected,
}: {
  ref?: Ref<HTMLElement>;
  rows: ReadonlyArray<WorkRow>;
  section: WorkSection;
  selected?: string;
}) {
  // On a phone, the heading alone carries the colour: a side edge makes wrapped lines hard to read.
  const hasEdge = useWidthClass() !== "narrow";
  return (
    <section
      ref={ref}
      {...stylex.props(styles.section, hasEdge && [styles.edge, tones[section.tone]])}
      aria-label={section.title}
    >
      <Heading level={2}>
        <span {...stylex.props(tones[section.tone])}>
          {section.title} <span {...stylex.props(styles.count)}>· {rows.length}</span>
        </span>
      </Heading>
      {rows.length > 0 && (
        <List aria-label={`${section.title} lines`} density="compact" hasDividers>
          {rows.map((row, index) =>
            section.isFixed || row.isFixed ? (
              <RowItem isSelected={row.key === selected} key={row.key} row={row} />
            ) : (
              <SortableRow
                index={index}
                isSelected={row.key === selected}
                key={row.key}
                row={row}
                section={section.id}
              />
            ),
          )}
        </List>
      )}
      {section.footer && <div {...stylex.props(styles.footer)}>{section.footer}</div>}
    </section>
  );
}

/** A section rows are dropped in, even when it is empty. */
function DropSection(props: {
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
 * The sections, one under the other, a separator between two. `selected` is the key of the row
 * open beside the list; with `isFocused`, the keyboard's focus is put on it, with its ring. A drop
 * calls `onMove` with the row's key, its section, and its index among that section's rows on
 * screen; until it resolves, the list stays as the drag left it.
 */
export function WorkList({
  isFocused = false,
  onMove,
  sections,
  selected,
}: {
  isFocused?: boolean;
  onMove?: OnMove;
  sections: ReadonlyArray<WorkSection>;
  selected?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isFocused && selected !== undefined) {
      ref.current?.querySelector<HTMLElement>('[aria-current="true"] a, a[aria-current]')?.focus();
    }
  }, [isFocused, selected]);
  const drag = useDragOrder(sections, onMove);
  const byKey = new Map(
    drag.sections.flatMap((section) => section.rows.map((row) => [row.key, row] as const)),
  );
  const rowsOf = (section: WorkSection) =>
    section.isFixed
      ? section.rows
      : (drag.order[section.id] ?? []).flatMap((key) => byKey.get(key) ?? []);
  return (
    <div ref={ref}>
      <DragDropProvider {...drag.provider}>
        {drag.sections.map((section, index) => (
          <Fragment key={section.id}>
            {index > 0 && <Divider />}
            {section.isFixed ? (
              <SectionBody rows={rowsOf(section)} section={section} selected={selected} />
            ) : (
              <DropSection rows={rowsOf(section)} section={section} selected={selected} />
            )}
          </Fragment>
        ))}
      </DragDropProvider>
    </div>
  );
}
