// A section of a list of work as a pane (see `WorkList`): its title and count in the border, its
// context under the title, its cards, and its footer; one rows are dropped in, even empty.
import type { HeadingLevel } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { useDroppable } from "@dnd-kit/react";
import * as stylex from "@stylexjs/stylex";
import type { Ref } from "react";
import { Pane, type PaneTint } from "../layout/Pane.tsx";
import { Card, type WorkRow } from "./Card.tsx";
import type { Tone, WorkSection } from "./workSection.ts";

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
    // Its basis, a custom property: StyleX's values for it list no length.
    "--list-column-basis": "min(var(--column-least), 100%)",
    flexBasis: "var(--list-column-basis)",
    flexGrow: 1,
    flexShrink: 0,
    minWidth: 0,
  },
  // A column of a list whose lines are long, as the priorities': at least 500 px.
  roomy: { "--column-least": "500px" },
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
    // Its bar's width, a custom property: StyleX's values for it list no length.
    "--list-context-bar": "3px",
    borderInlineStartWidth: "var(--list-context-bar)",
    color: colorVars["--color-text-secondary"],
    marginBlockEnd: spacingVars["--spacing-1"],
    paddingBlock: spacingVars["--spacing-1"],
    paddingInline: spacingVars["--spacing-2"],
  },
  // What ends the section, as its Add row, in line with its cards' text.
  footer: {
    paddingBlock: spacingVars["--spacing-1"],
    paddingInlineStart: spacingVars["--spacing-2"],
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
export function SectionBody({
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
export function DropSection(props: {
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
