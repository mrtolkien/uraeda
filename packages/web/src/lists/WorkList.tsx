// The list the priorities and the inbox share: sections under a coloured heading with their count,
// a thin edge of the same colour, and rows with the drag handle on the left, their text, their
// children as grey lines, and their marks on the right. Each row is one link.
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Kbd } from "@astryxdesign/core/Kbd";
import { List, ListItem } from "@astryxdesign/core/List";
import { StatusDot } from "@astryxdesign/core/StatusDot";
import { Text } from "@astryxdesign/core/Text";
import {
  borderVars,
  colorVars,
  focusVars,
  sizeVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { Fragment, type ReactNode, useEffect, useRef } from "react";

/** A section's colour: Now blue, Next and the inbox's categories neutral, Later grey, Blocked orange. */
export type Tone = "blue" | "neutral" | "gray" | "orange";

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

/** A section of the list: a heading of the file, or a category of the inbox. */
export interface WorkSection {
  /** What ends it, like its Add row. */
  footer?: ReactNode;
  id: string;
  /** Whether its heading stands out, as Now's does. */
  isLarge?: boolean;
  rows: ReadonlyArray<WorkRow>;
  title: string;
  tone: Tone;
}

const styles = stylex.create({
  below: {
    display: "block",
    paddingBlockStart: spacingVars["--spacing-1"],
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
    paddingBlock: spacingVars["--spacing-2"],
    paddingInlineStart: spacingVars["--spacing-2"],
  },
  large: {
    fontSize: typeScaleVars["--text-heading-1-size"],
    lineHeight: typeScaleVars["--text-heading-1-leading"],
  },
  line: {
    // The divider between rows, none under the last, as Astryx's list draws it: an unlayered rule
    // of the app's, the same atomic class, wins over Astryx's `:last-child` in its layer.
    borderBlockEndWidth: { ":last-child": 0, default: borderVars["--border-width"] },
    // The keyboard's focus ring of a row, as Astryx draws it. Astryx's own rule is in its layer,
    // and an unlayered `outlineStyle: "none"` of the app's (`Selection.tsx`), the same atomic
    // class, wins over it: the row's ring never shows without this. Inside the row, since the list
    // clips its rows' sides.
    outlineColor: focusVars["--focus-outline-color"],
    outlineOffset: `calc(-1 * ${focusVars["--focus-outline-width"]})`,
    outlineStyle: { ":has(:focus-visible)": focusVars["--focus-outline-style"], default: "none" },
    outlineWidth: focusVars["--focus-outline-width"],
    // The long press on a phone does not open the link's menu.
    userSelect: "none",
    // oxlint-disable-next-line stylex/valid-styles -- WebKit's own property, missing from StyleX's list: a long press that starts a drag must not open the link's menu
    WebkitTouchCallout: "none",
  },
  section: {
    paddingBlock: spacingVars["--spacing-2"],
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
  neutral: {
    borderInlineStartColor: colorVars["--color-border-emphasized"],
    color: colorVars["--color-text-primary"],
  },
  orange: {
    borderInlineStartColor: colorVars["--color-border-orange"],
    color: colorVars["--color-text-orange"],
  },
});

/** One row: tapped, it opens its view; its handle moves it, unless it is fixed. */
function Row({ isSelected, row }: { isSelected: boolean; row: WorkRow }) {
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
      startContent={
        row.isFixed ? (
          <span {...stylex.props(styles.fixed)}>
            <StatusDot label="Running" variant="success" />
          </span>
        ) : (
          <Button
            icon={<span aria-hidden="true">⠿</span>}
            isIconOnly
            label={`Move ${row.text}`}
            size="sm"
            variant="ghost"
          />
        )
      }
      xstyle={styles.line}
    />
  );
}

/** A section: its coloured heading with its count, its rows, then its footer. */
function Section({ section, selected }: { section: WorkSection; selected?: string }) {
  return (
    <section
      {...stylex.props(styles.section, styles.edge, tones[section.tone])}
      aria-label={section.title}
    >
      <Heading level={2}>
        <span {...stylex.props(tones[section.tone], section.isLarge && styles.large)}>
          {section.title} <span {...stylex.props(styles.count)}>· {section.rows.length}</span>
        </span>
      </Heading>
      {section.rows.length > 0 && (
        <List aria-label={`${section.title} lines`} hasDividers>
          {section.rows.map((row) => (
            <Row isSelected={row.key === selected} key={row.key} row={row} />
          ))}
        </List>
      )}
      {section.footer && <div {...stylex.props(styles.footer)}>{section.footer}</div>}
    </section>
  );
}

/**
 * The sections, one under the other, a separator between two. `selected` is the key of the row
 * open beside the list; with `isFocused`, the keyboard's focus is put on it, with its ring.
 */
export function WorkList({
  isFocused = false,
  sections,
  selected,
}: {
  isFocused?: boolean;
  sections: ReadonlyArray<WorkSection>;
  selected?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isFocused && selected !== undefined) {
      ref.current?.querySelector<HTMLElement>('[aria-current="true"] a, a[aria-current]')?.focus();
    }
  }, [isFocused, selected]);
  return (
    <div ref={ref}>
      {sections.map((section, index) => (
        <Fragment key={section.id}>
          {index > 0 && <Divider />}
          <Section section={section} selected={selected} />
        </Fragment>
      ))}
    </div>
  );
}

/** Words between keys, in the hint. */
function words(text: string) {
  return <Text color="secondary">{text}</Text>;
}

/** The keys that move through a list, shown once: "↑ ↓ or j k to move · Enter to edit · Esc to close". */
export function KeysHint() {
  return (
    <HStack align="center" gap={1} wrap="wrap">
      <Kbd keys="up" />
      <Kbd keys="down" />
      {words("or")}
      <Kbd keys="j" />
      <Kbd keys="k" />
      {words("to move ·")}
      <Kbd keys="enter" />
      {words("to edit ·")}
      <Kbd keys="escape" />
      {words("to close")}
    </HStack>
  );
}
