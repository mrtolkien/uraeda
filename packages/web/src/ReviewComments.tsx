import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useMemo } from "react";
import type { CommentItem, Document } from "uraeda-binding";
import { Paragraph } from "./layout/Paragraph.tsx";
import { statusStyles } from "./Question.tsx";
import { holderOf } from "./reviewField.ts";

const styles = stylex.create({
  pending: {
    // A pending comment under its block: a bar down its side.
    borderInlineStartColor: colorVars["--color-warning"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: spacingVars["--spacing-1"],
    marginBlockEnd: spacingVars["--spacing-2"],
    marginBlockStart: spacingVars["--spacing-0-5"],
    marginInlineStart: spacingVars["--spacing-6"],
    overflowWrap: "anywhere",
    paddingInlineStart: spacingVars["--spacing-3"],
  },
});

/** Where a comment points: `C2 · lines 4–6`, or `C3 · general`. */
export function where(comment: CommentItem) {
  if (comment.general) {
    return `C${comment.number} · general`;
  }
  return comment.startLine === comment.endLine
    ? `C${comment.number} · line ${comment.startLine}`
    : `C${comment.number} · lines ${comment.startLine}–${comment.endLine}`;
}

/** The comments on lines, by the block each shows under: the smallest tappable block holding its last line. */
export function usePlacedComments(comments: ReadonlyArray<CommentItem>, tree: Document) {
  return useMemo(() => {
    const map = new Map<number, Array<CommentItem>>();
    for (const comment of comments.filter((c) => !c.general)) {
      const holder = holderOf(tree, comment.endLine);
      if (holder) {
        map.set(holder.id, [...(map.get(holder.id) ?? []), comment]);
      }
    }
    return map;
  }, [comments, tree]);
}

/** A pending comment, with Edit and Remove. */
export function PendingComment({
  comment,
  onEdit,
  onRemove,
}: {
  comment: CommentItem;
  onEdit: () => void;
  onRemove: () => void;
}) {
  return (
    <CommentNote
      label={where(comment)}
      name={where(comment)}
      onEdit={onEdit}
      onRemove={onRemove}
      text={comment.text}
    />
  );
}

/**
 * A comment under what it is on, a bar down its side: `label` above its text, the group named
 * `name`, and Edit and Remove when given, as a pending review comment or a comment on a settled
 * point has. `error` is what refused its removal.
 */
export function CommentNote({
  error,
  label,
  name,
  onEdit,
  onRemove,
  text,
}: {
  error?: string;
  label: string;
  name: string;
  onEdit?: () => void;
  onRemove?: () => void;
  text: string;
}) {
  return (
    <div aria-label={name} role="group" {...stylex.props(styles.pending)}>
      <HStack align="center" gap={2} justify="between" wrap="wrap">
        <Text color="secondary" type="supporting">
          {label}
        </Text>
        <HStack gap={1}>
          {onEdit && (
            <Button
              label="Edit"
              onClick={(event: React.MouseEvent) => {
                event.stopPropagation();
                onEdit();
              }}
              size="sm"
              variant="ghost"
            />
          )}
          {onRemove && (
            <Button
              label="Remove"
              onClick={(event: React.MouseEvent) => {
                event.stopPropagation();
                onRemove();
              }}
              size="sm"
              variant="ghost"
            />
          )}
        </HStack>
      </HStack>
      <Paragraph>{text}</Paragraph>
      {error && <span {...stylex.props(statusStyles.error)}>{error}</span>}
    </div>
  );
}
