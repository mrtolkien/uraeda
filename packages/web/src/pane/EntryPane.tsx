// The detail pane of an entry, a priority or a note, shared by both pages and drawn in their
// overlay: a bar with its place and its actions, then its body, read-only on arrival, the entry
// read as markdown. Edit, in the bar, turns its text into
// the one-line field, in place (Q4, Q5 of the redesign's first round), and a drafted entry's
// draft into its text, under it (C2).
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { Span } from "uraeda-binding";
import { LineField } from "../EditableLine.tsx";
import { Spans } from "../Spans.tsx";
import type { useLineSave } from "../useLineSave.ts";
import { Heading } from "@astryxdesign/core/Heading";

const styles = stylex.create({
  bar: {
    // The bar stays in view as the pane scrolls: Edit and Close are always one click away.
    backgroundColor: colorVars["--color-background-surface"],
    position: "sticky",
    top: 0,
    zIndex: 1,
  },
  // The overlay it is drawn in insets it: the bar and the body take no inset of their own.
  barContent: {
    boxSizing: "border-box",
    paddingBlock: spacingVars["--spacing-2"],
  },
  body: {
    boxSizing: "border-box",
    overflowWrap: "anywhere",
    paddingBlock: spacingVars["--spacing-4"],
  },
  // Previous and Next stay in view as the pane scrolls, under the body, as the bar stays over it.
  child: {
    paddingBlock: spacingVars["--spacing-0-5"],
  },
  children: {
    listStyleType: "disc",
    margin: 0,
    paddingInlineStart: spacingVars["--spacing-6"],
  },
  footer: {
    backgroundColor: colorVars["--color-background-surface"],
    bottom: 0,
    paddingBlock: spacingVars["--spacing-2"],
    position: "sticky",
    zIndex: 1,
  },
  footerSteps: {
    paddingBlockStart: spacingVars["--spacing-2"],
  },
});

/** The pane's bar: where the entry is, then Edit and Open draft when it links one. */
function PaneBar({
  draftHref,
  isEditing,
  location,
  onEdit,
}: {
  draftHref?: string;
  isEditing: boolean;
  location: string;
  onEdit: () => void;
}) {
  return (
    <div {...stylex.props(styles.bar)}>
      <div {...stylex.props(styles.barContent)}>
        <HStack align="center" gap={2} justify="between" wrap="wrap">
          <Text color="secondary" type="supporting">
            {location}
          </Text>
          <HStack align="center" gap={2}>
            <Button isDisabled={isEditing} label="Edit" onClick={onEdit} variant="secondary" />
            {draftHref && <Button href={draftHref} label="Open draft" variant="secondary" />}
          </HStack>
        </HStack>
      </div>
      {/* Astryx's divider: a border of the app's own would write the atomic rule of a list's
          dividers again, unlayered, and every list's last row would keep its divider. */}
      <Divider />
    </div>
  );
}

/**
 * The entry's text, rendered with its links, and its children as a list; while it is edited, the
 * one-line field in its place, its children still shown under it, as Q5 edits the first line only.
 */
export function EntryText({
  label,
  line,
  marks,
  nested,
  spans,
}: {
  label: string;
  line: ReturnType<typeof useLineSave>;
  marks?: ReactNode;
  nested: ReadonlyArray<ReadonlyArray<Span>>;
  spans: ReadonlyArray<Span>;
}) {
  return (
    <VStack gap={2}>
      {line.open ? (
        <LineField label={label} line={line} />
      ) : (
        // The pane's title: a heading, read at a heading's size.
        <Heading level={2}>
          {marks}
          <Spans spans={spans} />
        </Heading>
      )}
      {nested.length > 0 && (
        <ul {...stylex.props(styles.children)}>
          {nested.map((child, at) => (
            // A child has no key of its own: its place is its identity, as in the file.
            <li key={at} {...stylex.props(styles.child)}>
              <Spans spans={child} />
            </li>
          ))}
        </ul>
      )}
    </VStack>
  );
}

/** A priority whose feature is started: a green Running badge, its step, and the way to it. */
export function RunningPart({ href, step }: { href: string; step: string }) {
  return (
    <HStack align="center" gap={2} wrap="wrap">
      <Badge label="Running" variant="success" />
      <Text color="secondary">{step}</Text>
      <Link hasUnderline href={href}>
        Open the feature
      </Link>
    </HStack>
  );
}

/** ‹ Previous and Next ›, through the entries of the same section or category. */
export function Steps({
  count,
  index,
  onStep,
}: {
  count: number;
  index: number;
  onStep: (to: number) => void;
}) {
  return (
    <HStack gap={2} justify="between">
      <Button isDisabled={index === 0} label="‹ Previous" onClick={() => onStep(index - 1)} />
      <Button isDisabled={index >= count - 1} label="Next ›" onClick={() => onStep(index + 1)} />
    </HStack>
  );
}

/**
 * The pane: its bar, then its body, `text` first, then `children`, what the entry's kind adds, a
 * Delete button; then ‹ Previous / Next ›, pinned to the pane's foot. The overlay it is drawn in has the Close. `onEdit`, from
 * Edit, opens what the pane edits; `isEditing` says it is open.
 */
export function EntryPane({
  children,
  draftHref,
  isEditing,
  location,
  onDelete,
  onEdit,
  steps,
  text,
}: {
  children: ReactNode;
  draftHref?: string;
  isEditing: boolean;
  location: string;
  onDelete: () => Promise<void> | void;
  onEdit: () => void;
  steps: ReactNode;
  text: ReactNode;
}) {
  return (
    <VStack gap={0}>
      <PaneBar draftHref={draftHref} isEditing={isEditing} location={location} onEdit={onEdit} />
      <div {...stylex.props(styles.body)}>
        <VStack gap={4}>
          {text}
          {children}
          <HStack gap={2}>
            <Button clickAction={onDelete} label="Delete" variant="destructive" />
          </HStack>
        </VStack>
      </div>
      <div {...stylex.props(styles.footer)}>
        <Divider />
        <div {...stylex.props(styles.footerSteps)}>{steps}</div>
      </div>
    </VStack>
  );
}
