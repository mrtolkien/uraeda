// The list the priorities and the inbox share: sections under a coloured heading with their count,
// on wide screens a thin edge of the same colour, and a card for each line (see `Card`). A card
// drags from anywhere: past 5 px of a mouse press, or after half a second of a touch press. The
// keys move the selection, with the pane beside the list following (see `useListKeys`).
import { Divider } from "@astryxdesign/core/Divider";
import { Heading } from "@astryxdesign/core/Heading";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { DragDropProvider, useDroppable } from "@dnd-kit/react";
import * as stylex from "@stylexjs/stylex";
import { Fragment, type ReactNode, type Ref, use, useEffect } from "react";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { Card, type WorkRow } from "./Card.tsx";
import { ListPaneContext } from "./listPane.ts";
import { type OnMove, useDragOrder } from "./useDragOrder.ts";
import { useListKeys } from "./useListKeys.ts";

/**
 * A section's colour: the ongoing entries green, Now blue, Next and the inbox's categories
 * neutral, Later grey, Blocked orange.
 */
export type Tone = "green" | "blue" | "neutral" | "gray" | "orange";

export type { WorkRow };

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
  count: {
    color: colorVars["--color-text-secondary"],
    fontWeight: "normal",
  },
  edge: {
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: spacingVars["--spacing-1"],
    paddingInlineStart: spacingVars["--spacing-3"],
  },
  footer: {
    paddingBlock: spacingVars["--spacing-1"],
    paddingInlineStart: spacingVars["--spacing-2"],
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
  const hasEdge = !isNarrow(useWidthClass());
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
        // The cards' list: Astryx's `List` draws only its own rows, not a card.
        <ul aria-label={`${section.title} lines`} {...stylex.props(styles.cards)}>
          {rows.map((row, index) => (
            <Card
              index={index}
              isSelected={row.key === selected}
              key={row.key}
              row={section.isFixed ? { ...row, isFixed: true } : row}
              section={section.id}
            />
          ))}
        </ul>
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
  const pane = use(ListPaneContext);
  const drag = useDragOrder(sections, onMove);
  const byKey = new Map(
    drag.sections.flatMap((section) => section.rows.map((row) => [row.key, row] as const)),
  );
  const rowsOf = (section: WorkSection) =>
    section.isFixed
      ? section.rows
      : (drag.order[section.id] ?? []).flatMap((key) => byKey.get(key) ?? []);
  // The rows in the order they show, which the keys move along.
  const rows = drag.sections.flatMap(rowsOf);
  const { focusSelected, ref } = useListKeys({
    // Escape closes the pane beside the list: without one, it does nothing, and is not named.
    escapeLabel: pane ? "close" : null,
    onClose: () => {
      pane?.close();
      return pane !== null;
    },
    onEdit: () => pane?.edit() ?? false,
    // On wide screens the pane follows the selection; without a pane, only the focus moves.
    onSelect: (index) => pane?.follow(rows[index].href),
    selected: rows.findIndex((row) => row.key === selected),
  });
  useEffect(() => {
    if (isFocused && selected !== undefined) {
      focusSelected();
    }
  }, [isFocused, selected, focusSelected]);
  useEffect(() => pane?.setFocusRow(focusSelected), [pane, focusSelected]);
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
