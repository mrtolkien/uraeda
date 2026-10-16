// The detail pane of an entry, a priority or a note, shared by both pages: a bar with its place
// and its actions, then its body, read-only on arrival. Opening it focuses nothing: the arrows keep
// moving through the list, and the entry reads as markdown. Edit, in the bar, turns its text into
// the one-line field, in place (Q4, Q5 of the redesign's first round).
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import {
  colorVars,
  fontWeightVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { Span } from "uraeda-binding";
import { LineField } from "../EditableLine.tsx";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { Spans } from "../Spans.tsx";
import type { useLineSave } from "../useLineSave.ts";

const styles = stylex.create({
  bar: {
    // The bar stays in view as the pane scrolls: Edit and Close are always one click away.
    backgroundColor: colorVars["--color-background-surface"],
    position: "sticky",
    top: 0,
    zIndex: 1,
  },
  barContent: {
    boxSizing: "border-box",
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-4"],
  },
  barWide: {
    paddingInline: spacingVars["--spacing-6"],
  },
  body: {
    boxSizing: "border-box",
    overflowWrap: "anywhere",
    paddingBlock: spacingVars["--spacing-4"],
    paddingInline: spacingVars["--spacing-4"],
  },
  bodyWide: {
    paddingBlock: spacingVars["--spacing-6"],
    paddingInline: spacingVars["--spacing-6"],
  },
  child: {
    paddingBlock: spacingVars["--spacing-0-5"],
  },
  children: {
    listStyleType: "disc",
    margin: 0,
    paddingInlineStart: spacingVars["--spacing-6"],
  },
  text: {
    // The entry's line, the pane's title.
    fontSize: typeScaleVars["--text-heading-2-size"],
    fontWeight: fontWeightVars["--font-weight-semibold"],
    lineHeight: typeScaleVars["--text-heading-2-leading"],
    margin: 0,
    textWrap: "pretty",
  },
});

/** The pane's bar: where the entry is, then Edit, Open draft when it links one, and Close. */
function PaneBar({
  draftHref,
  isEditing,
  location,
  onClose,
  onEdit,
}: {
  draftHref?: string;
  isEditing: boolean;
  location: string;
  onClose?: () => void;
  onEdit: () => void;
}) {
  const wide = useWidthClass() === "wide";
  return (
    <div {...stylex.props(styles.bar)}>
      <div {...stylex.props(styles.barContent, wide && styles.barWide)}>
        <HStack align="center" gap={2} justify="between" wrap="wrap">
          <Text color="secondary" type="supporting">
            {location}
          </Text>
          <HStack align="center" gap={2}>
            <Button isDisabled={isEditing} label="Edit" onClick={onEdit} variant="secondary" />
            {draftHref && <Button href={draftHref} label="Open draft" variant="secondary" />}
            {wide && onClose && (
              <Button
                icon={<Icon icon="close" />}
                isIconOnly
                label="Close"
                onClick={onClose}
                variant="ghost"
              />
            )}
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
        <p {...stylex.props(styles.text)}>
          {marks}
          <Spans spans={spans} />
        </p>
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
 * Delete button, and ‹ Previous / Next ›. On wide screens it sits beside the list, with Close; on
 * narrow ones it is the page itself, and Back leaves it.
 */
export function EntryPane({
  children,
  draftHref,
  line,
  location,
  onClose,
  onDelete,
  steps,
  text,
}: {
  children: ReactNode;
  draftHref?: string;
  line: ReturnType<typeof useLineSave>;
  location: string;
  onClose?: () => void;
  onDelete: () => Promise<void> | void;
  steps: ReactNode;
  text: ReactNode;
}) {
  const wide = useWidthClass() === "wide";
  return (
    <VStack gap={0}>
      <PaneBar
        draftHref={draftHref}
        isEditing={line.open}
        location={location}
        onClose={onClose}
        onEdit={line.openLine}
      />
      <div {...stylex.props(styles.body, wide && styles.bodyWide)}>
        <VStack gap={4}>
          {text}
          {children}
          <HStack gap={2}>
            <Button clickAction={onDelete} label="Delete" variant="destructive" />
          </HStack>
          <Divider />
          {steps}
        </VStack>
      </div>
    </VStack>
  );
}
